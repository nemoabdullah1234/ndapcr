const deviceTrackingModel = require('../models/deviceTracking');
const bluebirdPromise = require('bluebird');
const mongoose = require('mongoose');
const akUtils = require('../lib/utility');
const uaLib = require('../lib/pushClient/index');
const uaPayloadCreator = require('../lib/pushClient/payloadCreators');
const shipmentHelper = require('../helpers/shipment');
const notificationLib = require('../lib/notification');
const notificationModel = require('../models/notification');
const thingsModel = require('../models/things');
const clientHandler = require('../lib/clientHandler');
const confHelper = require('./configuration');
const orderModel = require('../models/order');
const orderHelper = require('../helpers/order');
const shipmentModel = require('../models/shipment');
const shipmentStatusMap = require('../mappings/shipmentStatus');
const orderStatusMap = require('../mappings/orderStatus');

class CronHelper {
  constructor() {
    this.config = {};

    this.config.secondsBeforeNotReporting = 5 * 60;
  }

  markNotReporting() {
    return deviceTrackingModel
      .update(
        clientHandler.addClientFilterToConditions({
          lastTracked: {
            $lte: akUtils.subtractSecondsFromDate(new Date(), this.config.secondsBeforeNotReporting)
          }
        }),
        { $set: { isReporting: 0 } },
        { upsert: false, multi: true }
      )
      .exec();
  }

  sendDelayedShipmentNotification() {
    return shipmentHelper
      .getDelayedShipments()
      .then(list =>
        bluebirdPromise.map(list, item =>
          notificationModel
            .find({
              type: 'ShipmentDelayedCR',
              'params.shipment.id': mongoose.Types.ObjectId(item.id)
            })
            .exec()
            .then(data => {
              // console.log(data.length);
              if (!data.length) {
                // console.log(`send ${item.id}`);
                return notificationLib.sendShipmentDelayedNotification(item.id);
              }
              // console.log(`dont send ${item.id}`);

              return {};
            })
        )
      )
      .catch(e => {
        // console.log(e);
      });
  }

  sendDeviceSilentPush() {
    const thingsModel = require('../models/things');
    const deviceTrackingModel = require('../models/deviceTracking');

    return thingsModel
      .find(
        clientHandler.addClientFilterToConditions({
          type: 'software',
          status: 1
        })
      )
      .select('code')
      .exec()
      .then(result => result.map(x => x.code))
      .then(codeList =>
        deviceTrackingModel
          .find(
            clientHandler.addClientFilterToConditions({
              isReporting: 0,
              'device.code': {
                $in: codeList
              }
            })
          )
          .select('device.code')
          .exec()
      )
      .then(result => result.map(x => (x.device || {}).code || ''))
      .then(activeNotReportingDeviceCodes =>
        bluebirdPromise.map(activeNotReportingDeviceCodes, code =>
          notificationLib.sendSilentPush(code)
        )
      )
      .then(() => this.removeOldDeviceSilentPushNotifications());
  }

  removeOldDeviceSilentPushNotifications() {
    const deleteSinceSeconds = 4 * 60 * 60; // 4 hours;
    return notificationModel.remove(
      clientHandler.addClientFilterToConditions({
        type: 'DeviceSilentPush',
        insertedOn: {
          $lte: akUtils.subtractSecondsFromDate(new Date(), deleteSinceSeconds)
        }
      })
    );
  }

  markDevicesInactive() {
    // mongoose.set('debug', true);
    const deviceHelper = require('./device');
    const secondsSinceInactive = 1 * 24 * 60 * 60 + 5 * 60; // 1 day 5 minutes
    const sinceTime = akUtils.subtractSecondsFromDate(new Date(), secondsSinceInactive);
    const allowedApps = process.env.allowedAppNames.split(',');
    return bluebirdPromise
      .map(allowedApps, appName =>
        uaLib.getInstanceByAppNamePromisified(appName).then(instance =>
          bluebirdPromise.all([
            instance
              .getDeviceTokensFeedback({
                since: sinceTime
              })
              .then(result => result.data),
            instance
              .getAPIDFeedback({
                since: sinceTime
              })
              .then(result => result.data)
          ])
        )
      )
      .then(res => {
        const inactivePushIdentifierList = res
          .map(x => [...x[0], ...x[1]])
          .map(x => x.map(y => y.device_token || y.apid))
          .reduce((all, list) => {
            all.push(...list);
            return all;
          }, []);
        const inactivePushIdentifierListRegexList = inactivePushIdentifierList.map(
          x => new RegExp(`^${x}$`, 'i')
        );
        const conditions = clientHandler.addClientFilterToConditions({
          type: 'software',
          $or: [
            {
              attributes: {
                $elemMatch: {
                  name: 'channelId',
                  value: {
                    $in: inactivePushIdentifierListRegexList
                  }
                }
              }
            },
            {
              attributes: {
                $elemMatch: {
                  name: 'pushIdentifier',
                  value: {
                    $in: inactivePushIdentifierListRegexList
                  }
                }
              }
            }
          ]
        });
        // console.log(conditions);
        return thingsModel
          .find(conditions)
          .exec()
          .then(result => deviceHelper.markDevicesInactive(result.map(x => x.code)))
          .catch(e => {
            // console.log(e);
          });
      });
  }

  disassociateNamedUsersFromOldChannels() {
    const allowedApps = process.env.allowedAppNames.split(',');
    return bluebirdPromise
      .map(allowedApps, appName =>
        uaLib.getInstanceByAppNamePromisified(appName).then(instance =>
          instance
            .getNamedUsers({})
            .then(res => res.data.named_users)
            .then(namedUsers => namedUsers.filter(x => x.channels.length > 17))
            .then(namedUsers =>
              namedUsers.map(x => {
                x.channels = x.channels.sort(
                  (a, b) => new Date(a.created).getTime() - new Date(b.created).getTime()
                );
                return x;
              })
            )
            .then(overLimitNamedUsers =>
              bluebirdPromise.map(overLimitNamedUsers, namedUser =>
                instance.disassociateNamedUsers(
                  uaPayloadCreator.createDisassociateNamedUserPayload({
                    channelId: namedUser.channels[0].channel_id
                  })
                )
              )
            )
        )
      )
      .then(() => '')
      .catch(e => {
        // console.log(e);
      });
  }
  markClosed() {
    return confHelper.getConfigurations().then(config => {
      // // console.log(config);
      const closeOrders = config.autocloseorder;
      const closeShipments = config.autocloseshipment;
      const closeOrdersAfter = config.autocloseorderafter;
      const closeShipmentsAfter = config.autocloseshipmentafter;

      return bluebirdPromise
        .all([
          bluebirdPromise.resolve().then(() => {
            akUtils.log(closeOrders, 'close orders settings');

            if (closeOrders) {
              akUtils.log('finding orders');
              const orderConditions = {
                etd: {
                  $lte: akUtils.subtractSecondsFromDate(new Date(), closeOrdersAfter)
                },
                orderStatus: { $in: [orderStatusMap.Delivered] }
              };
              return orderModel
                .find(orderConditions)
                .exec()
                .then(orders => {
                  akUtils.log(`${orders.length} -> Total orders`);

                  return bluebirdPromise.map(orders || [], order =>
                    // akUtils.log(order._id + ' -> order');

                    orderHelper.closeOrder(order._id)
                  );
                });
            }
          }),
          bluebirdPromise.resolve().then(() => {
            akUtils.log(closeShipments, 'close shipments settings');
            if (closeShipments) {
              akUtils.log('finding shipments');
              const shipmentConditions = {
                deliveryDate: {
                  $lte: akUtils.subtractSecondsFromDate(new Date(), closeShipmentsAfter)
                },
                shipmentStatus: { $in: [shipmentStatusMap.Delivered] }
              };
              return shipmentModel
                .find(shipmentConditions)
                .exec()
                .then(shipments => {
                  akUtils.log(`${shipments.length} -> Total shipments`);

                  return bluebirdPromise.map(shipments || [], shipment =>
                    // akUtils.log(shipment._id + ' -> shipment');
                    shipmentHelper.closeShipment(shipment._id)
                  );
                });
            }
          })
        ])
        .then(() => {
          akUtils.log('All Executions successfull');
        })
        .catch(err => {
          akUtils.log(err);
        });
    });
  }
}

module.exports = new CronHelper();
