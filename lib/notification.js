const bluebirdPromise = require('bluebird');
const akUtils = require('./utility');
const sns = require('./aws/sns');
const lambdaLib = new (require('./aws/lambda'))();
const notificationModel = require('../models/notification');
const clientHandler = require('../lib/clientHandler');
const commonHelper = require('../helpers/common');
const configurationHelper = require('../helpers/configuration');
const currentUserHandler = require('../lib/currentUserHandler');
const mongoose = require('mongoose');

const userHelper = require('../helpers/users');

class Notification {
  sendShipmentSoftDeliveredNotification(shipmentId) {
    return this.sendShipmentNotifications('ShipmentSoftDelivered', shipmentId).catch(err => {
      akUtils.log(err);
    });
  }

  sendShipmentDelayedNotification(shipmentId) {
    return this.sendShipmentNotifications('ShipmentDelayed', shipmentId).catch(err => {
      akUtils.log(err);
    });
  }

  sendGPSBluetoothDownNotification(deviceCode) {
    const devicehelper = require('../helpers/device');

    return devicehelper
      .getByCode(deviceCode)
      .then(data => {
        if (data.locationStatus && data.bluetoothStatus) {
          return bluebirdPromise.resolve();
        }
        if (data.associatedUserId) {
          return this.sendGPSBluetoothDownUserNotification(data);
        }
        return this.sendGPSBluetoothDownDeviceNotification(data);
      })
      .catch(akUtils.log);
  }

  sendGPSBluetoothDownDeviceNotification(deviceData) {
    const params = {
      appType: deviceData.appName,
      locationStatus: deviceData.locationStatus,
      bluetoothStatus: deviceData.bluetoothStatus,
      deviceId: deviceData.deviceId,
      appCode: deviceData.code,
      deviceName: deviceData.name
    };
    const recieverData = {
      sendType: 'device',
      os: deviceData.os,
      channelId: deviceData.channelId,
      appType: deviceData.appName
    };

    // akUtils.log('sendGPSBluetoothDownDeviceNotification');
    // akUtils.log(deviceData.locationStatus);
    // akUtils.log('deviceData.locationStatus');
    // akUtils.log(deviceData.bluetoothStatus);
    // akUtils.log('deviceData.bluetoothStatus');

    if (deviceData.locationStatus === 0 && deviceData.bluetoothStatus === 0) {
      params.notificationFor = 'all';
    } else if (deviceData.locationStatus === 0) {
      params.notificationFor = 'gps';
    } else if (deviceData.bluetoothStatus === 0) {
      params.notificationFor = 'bluetooth';
    }

    return this.saveNotification(
      'GPSBluetoothDown',
      params,
      recieverData,
      currentUserHandler.getCurrentUser()
    );
  }

  sendGPSBluetoothDownUserNotification(deviceData) {
    const params = {
      appType: deviceData.appName,
      locationStatus: deviceData.locationStatus,
      bluetoothStatus: deviceData.bluetoothStatus,
      deviceId: deviceData.deviceId,
      appCode: deviceData.code,
      deviceName: deviceData.name,
      associatedUserId: deviceData.associatedUserId || ''
    };
    const recieverData = {
      namedUserId: deviceData.associatedUserId || '',
      sendType: 'user',
      appType: deviceData.appName
    };
    // akUtils.log('sendGPSBluetoothDownUserNotification');
    // akUtils.log(deviceData.locationStatus);
    // akUtils.log('deviceData.locationStatus');
    // akUtils.log(deviceData.bluetoothStatus);
    // akUtils.log('deviceData.bluetoothStatus');

    if (deviceData.locationStatus === 0 && deviceData.bluetoothStatus === 0) {
      params.notificationFor = 'all';
    } else if (deviceData.locationStatus === 0) {
      params.notificationFor = 'gps';
    } else if (deviceData.bluetoothStatus === 0) {
      params.notificationFor = 'bluetooth';
    }

    return this.saveNotification(
      'GPSBluetoothDown',
      params,
      recieverData,
      currentUserHandler.getCurrentUser()
    );
  }

  sendSilentPush(deviceCode) {
    const devicehelper = require('../helpers/device');

    return devicehelper
      .getByCode(deviceCode)
      .then(deviceData => {
        const params = {
          appType: deviceData.appName,
          deviceId: deviceData.deviceId,
          appCode: deviceData.code,
          deviceName: deviceData.name
        };
        const recieverData = {
          sendType: 'device',
          os: deviceData.os,
          channelId: deviceData.channelId,
          appType: deviceData.appName
        };

        return this.saveNotification(
          'DeviceSilentPush',
          params,
          recieverData,
          currentUserHandler.getCurrentUser()
        );
      })
      .catch(akUtils.log);
  }

  sendTestNotification(deviceCode) {
    const devicehelper = require('../helpers/device');

    return devicehelper.getByCode(deviceCode).then(deviceData => {
      const params = {
        appType: deviceData.appName,
        deviceId: deviceData.deviceId,
        appCode: deviceData.code,
        deviceName: deviceData.name
      };
      const recieverData = {
        sendType: 'device',
        os: deviceData.os,
        channelId: deviceData.channelId,
        appType: deviceData.appName
      };

      return this.saveNotification(
        'DeviceTestNotification',
        params,
        recieverData,
        currentUserHandler.getCurrentUser()
      );
    });
  }

  sendBeaconServiceNotification(beaconServiceStatus, appName) {
    if (beaconServiceStatus) {
      return bluebirdPromise.resolve({});
    }
    const params = {
      appType: appName
    };
    const recieverData = {
      namedUserId: currentUserHandler.getCurrentUser().email,
      appType: appName,
      sendType: 'user'
    };

    return this.saveNotification(
      'BeaconServiceOff',
      params,
      recieverData,
      currentUserHandler.getCurrentUser()
    ).catch(akUtils.log);
  }

  sendShipmentHardDeliveredNotification(shipmentId) {
    return this.sendShipmentNotifications('ShipmentHardDelivered', shipmentId).catch(err => {
      akUtils.log(err);
    });
  }

  sendShipmentPartialDeliveredNotification(shipmentId) {
    return this.sendShipmentNotifications('ShipmentPartialDelivered', shipmentId).catch(err => {
      akUtils.log(err);
    });
  }

  sendShipmentHardShippedNotification(shipmentId) {
    return this.sendShipmentNotifications('ShipmentHardShipped', shipmentId).catch(err => {
      akUtils.log(err);
    });
  }

  sendShipmentSoftShippedNotification(shipmentId) {
    return this.sendShipmentNotifications('ShipmentSoftShipped', shipmentId).catch(err => {
      akUtils.log(err);
    });
  }

  sendShipmentPartialShippedNotification(shipmentId) {
    return this.sendShipmentNotifications('ShipmentPartialShipped', shipmentId).catch(err => {
      akUtils.log(err);
    });
  }

  sendShipmentScheduledNotification(shipmentId) {
    return this.sendShipmentNotifications('ShipmentScheduled', shipmentId).catch(err => {
      akUtils.log(err);
    });
  }

  sendIssueCreatedNotification(issueId) {
    return this.sendIssueNotifications('IssueCreated', issueId).catch(err => {
      akUtils.log(err);
    });
  }

  sendIssueRespondedNotification(issueId) {
    return this.sendIssueNotifications('IssueResponded', issueId).catch(err => {
      akUtils.log(err);
    });
  }

  sendIssueNotifications(notificationTypePrefix, issueId) {
    const srNotificationType = `${notificationTypePrefix}SR`;
    const crNotificationType = `${notificationTypePrefix}CR`;
    const orderHelper = require('../helpers/order');
    const shipmentHelper = require('../helpers/shipment');
    const issueHelper = require('../helpers/issue');
    const dataForNotify = {};
    return issueHelper.getById(issueId, 'internal').then(result =>
      shipmentHelper.getById(result.shipment.id).then(shipmentObj => {
        dataForNotify.shipment = shipmentObj;
        dataForNotify.orderItemMap = {};
        const lastComment = result.comments.sort(
          (a, b) => (a.reportedOn < b.reportedOn ? 1 : -1)
        )[0];
        const lastCommentItems = lastComment.items || [];
        lastCommentItems.forEach(item => {
          if (!dataForNotify.orderItemMap[`${item.order}`]) {
            dataForNotify.orderItemMap[`${item.order}`] = {
              order: { items: [], salesRep: {} }
            };
          }
          dataForNotify.orderItemMap[`${item.order}`].order.items.push({
            id: mongoose.Types.ObjectId(item.id),
            code: item.code,
            name: item.name
          });
        }, this);

        return bluebirdPromise
          .map(Object.getOwnPropertyNames(dataForNotify.orderItemMap), orderId =>
            orderHelper.getById(orderId)
          )
          .then(orderResult => {
            akUtils.log(Object.getOwnPropertyNames(dataForNotify.orderItemMap));
            akUtils.log(orderResult[0].id);
            dataForNotify.orderItemMap[`${orderResult[0].id}`].order.id = mongoose.Types.ObjectId(
              orderResult[0].id
            );
            dataForNotify.orderItemMap[`${orderResult[0].id}`].order.code = orderResult[0].code;
            dataForNotify.orderItemMap[`${orderResult[0].id}`].order.salesRep =
              orderResult[0].consumer;
            const orders = akUtils.getObjectValues(dataForNotify.orderItemMap);
            dataForNotify.orders = orders;
            const crParams = {
              shipment: {
                id: mongoose.Types.ObjectId(dataForNotify.shipment.id),
                code: dataForNotify.shipment.code
              },
              addedBy: lastComment.reporter,
              issueId: mongoose.Types.ObjectId(issueId),
              orders: orders.map(x => x.order),
              carrier: dataForNotify.shipment.carrierUser
            };
            const srParams = orders.map(x => {
              const obj = {};
              obj.shipment = {
                id: mongoose.Types.ObjectId(dataForNotify.shipment.id),
                code: dataForNotify.shipment.code
              };
              obj.salesRep = x.order.salesRep;
              obj.issueId = mongoose.Types.ObjectId(issueId);
              obj.order = x.order;
              obj.addedBy = lastComment.reporter;

              return obj;
            });
            return bluebirdPromise.all([
              this.saveNotification(
                crNotificationType,
                crParams,
                {
                  sendType: 'user',
                  appType: 'carrier',
                  namedUserId: crParams.carrier.email
                },
                crParams.carrier
              ),

              bluebirdPromise.map(srParams, srParam =>
                this.saveNotification(
                  srNotificationType,
                  srParam,
                  {
                    sendType: 'user',
                    appType: 'salesRep',
                    namedUserId: srParam.salesRep.email
                  },
                  srParam.salesRep
                )
              )
            ]);
          });
      })
    );
  }

  sendShipmentNotifications(notificationTypePrefix, shipmentId, productFilterFn) {
    if (typeof productFilterFn !== 'function') {
      productFilterFn = product => true;
    }
    const srNotificationType = `${notificationTypePrefix}SR`;
    const crNotificationType = `${notificationTypePrefix}CR`;
    const orderHelper = require('../helpers/order');
    const shipmentHelper = require('../helpers/shipment');
    const shipmentOrchestrationHelper = require('../helpers/shipmentOrchestration');
    const dataForNotify = {};
    return shipmentHelper
      .getById(shipmentId)
      .then(result =>
        shipmentOrchestrationHelper
          .getOrchestrationDatesObject(shipmentId)
          .catch(e => {
            akUtils.log(e, 'sendShipmentNotifications - getOrchestrationDatesObject');
            return {};
          })
          .then(datesObj => {
            result.orchestrationDates = datesObj;
            return result;
          })
      )
      .then(result => {
        const client = result.client;
        dataForNotify.orderItemMap = {};
        dataForNotify.shipment = result;
        const filteredProducts = (result.products || []).filter(productFilterFn);
        for (const prod of filteredProducts) {
          if (!dataForNotify.orderItemMap[`${prod.orderDetails.id}`]) {
            dataForNotify.orderItemMap[`${prod.orderDetails.id}`] = {
              order: {
                id: mongoose.Types.ObjectId(`${prod.orderDetails.id}`),
                code: prod.orderDetails.code,
                products: []
              }
            };
          }
          dataForNotify.orderItemMap[`${prod.orderDetails.id}`].order.products.push({
            id: mongoose.Types.ObjectId(`${prod.id}`),
            code: `${prod.code}`,
            name: `${prod.name}`
          });
        }

        const orders = akUtils.getObjectValues(dataForNotify.orderItemMap);
        dataForNotify.orders = orders;
        let srParams = [];
        const crParams = {
          shipment: {
            id: mongoose.Types.ObjectId(dataForNotify.shipment.id),
            code: dataForNotify.shipment.code,
            etd: new Date(dataForNotify.shipment.etd),
            scheduledPickupDate: new Date(dataForNotify.shipment.scheduledPickupDate),
            orchestrationDates: dataForNotify.shipment.orchestrationDates
          },
          orders: orders.map(x => x.order),
          carrier: dataForNotify.shipment.carrierUser
        };
        srParams = orders.map(x => {
          x.shipment = {
            id: mongoose.Types.ObjectId(dataForNotify.shipment.id),
            code: dataForNotify.shipment.code,
            etd: dataForNotify.shipment.etd,
            scheduledPickupDate: dataForNotify.shipment.scheduledPickupDate,
            orchestrationDates: dataForNotify.shipment.orchestrationDates
          };
          return x;
        });
        return bluebirdPromise
          .map(Object.getOwnPropertyNames(dataForNotify.orderItemMap), orderId =>
            orderHelper.getById(orderId)
          )
          .then(res => {
            for (const data of res) {
              dataForNotify.orderItemMap[data.id].salesRep = data.consumer;
            }
            return bluebirdPromise.all([
              this.saveNotification(
                crNotificationType,
                crParams,
                {
                  sendType: 'user',
                  appType: 'carrier',
                  namedUserId: crParams.carrier.email
                },
                crParams.carrier,
                client
              ),

              bluebirdPromise.map(srParams, srParam =>
                this.saveNotification(
                  srNotificationType,
                  srParam,
                  {
                    sendType: 'user',
                    appType: 'salesRep',
                    namedUserId: srParam.salesRep.email
                  },
                  srParam.salesRep,
                  client
                )
              )
            ]);
          });
      });
  }

  saveNotification(notificationType, params, recieverData, recieverUserData, client) {
    return bluebirdPromise.all([
      this.saveMobileNotification(notificationType, params, recieverData, recieverUserData, client),
      this.saveWebNotification(notificationType, params, recieverData, recieverUserData, client)
    ]);
  }

  saveMobileNotification(notificationType, params, recieverData, recieverUserData, client) {
    return userHelper.getUserTimeZone((recieverUserData || {}).uuid || '').then(timezone => {
      let currentUser = currentUserHandler.getCurrentUser();
      if (!(currentUserHandler.getCurrentUser() || {}).uuid) {
        currentUser = commonHelper.getActionSourceUser({});
      }
      const notificationMessages = this.getNotificationMessages(notificationType, params, timezone);
      const notificationModelObject = new notificationModel();
      notificationModelObject.type = notificationType;
      notificationModelObject.client = client || clientHandler.getClient();
      notificationModelObject.params = params || {};
      notificationModelObject.insertedOn = new Date();
      notificationModelObject.recieverData = recieverData || {};
      notificationModelObject.recieverUserData = recieverUserData || {};
      notificationModelObject.archived = false;
      notificationModelObject.read = false;
      notificationModelObject.isForWeb = false;
      notificationModelObject.pushNotified = false;
      notificationModelObject.emailNotified = false;
      notificationModelObject.actionBy = currentUser;
      notificationModelObject.title = notificationMessages.title; // this.getNotificationTitle(notificationType, params);
      notificationModelObject.message = notificationMessages.message; // this.getNotificationMessage(notificationType, params);
      return notificationModelObject.save().then(result => {
        const data = {
          notificationId: result._id,
          client: clientHandler.getClient(),
          currentUser: currentUserHandler.getCurrentUser()
        };
        return lambdaLib
          .promisifiedExecuteAsync(process.env.sendNotificationLambdaName, data, process.env.stage)
          .then(result => {
            akUtils.log(result, 'promisifiedExecuteAsync');
          })
          .catch(error => {
            akUtils.log(error, 'promisifiedExecuteAsync');
          });
      });
    });
  }

  saveWebNotification(notificationType, params, recieverData, recieverUserData, client) {
    return configurationHelper.getConfigurations().then(config => {
      const timezone = config.timezone || 'UTC';
      let currentUser = currentUserHandler.getCurrentUser();
      if (!(currentUserHandler.getCurrentUser() || {}).uuid) {
        currentUser = commonHelper.getActionSourceUser({});
      }
      const notificationMessages = this.getWebNotificationMessages(
        notificationType,
        params,
        timezone,
        recieverUserData
      );
      const notificationModelObject = new notificationModel();
      notificationModelObject.type = notificationType;
      notificationModelObject.client = client || clientHandler.getClient();
      notificationModelObject.params = params || {};
      notificationModelObject.insertedOn = new Date();
      notificationModelObject.recieverData = recieverData || {};
      notificationModelObject.recieverUserData = recieverUserData || {};
      notificationModelObject.archived = false;
      notificationModelObject.read = false;
      notificationModelObject.isForWeb = true;
      notificationModelObject.pushNotified = false;
      notificationModelObject.emailNotified = false;
      notificationModelObject.actionBy = currentUser;
      notificationModelObject.title = notificationMessages.title; // this.getNotificationTitle(notificationType, params);
      notificationModelObject.message = notificationMessages.message; // this.getNotificationMessage(notificationType, params);
      return notificationModelObject.save();
    });
  }

  getNotificationMessages(notificationType, params, dateTimezone = 'UTC') {
    const messages = {
      title: '',
      message: ''
    };
    // const message = '';
    // let userType = '';
    let user = '';
    switch (notificationType) {
      // case 'IssueStateChanged':
      //   message = 'Note status changed for case no+ ' + params.caseNo + ' /Shipment# ' + params.shipmentNo;
      //   break;
      // case 'IssueClosed':
      //   message = 'Note closed for case no+ ' + params.caseNo + ' /Shipment# ' + params.shipmentNo;
      //   break;
      case 'IssueCreatedSR':
        messages.title = `Note created for Order# ${params.order.code} /Shipment# ${params.shipment
          .code}`;
        messages.message = `Note created for Order# ${params.order.code} and shipment# ${params
          .shipment.code}`;
        break;
      case 'IssueRespondedSR':
        user = `${params.addedBy.firstName} ${params.addedBy.lastName}`.trim();
        messages.title = `${user} responded on note for Order# ${params.order
          .code} /Shipment# ${params.shipment.code}`;
        messages.message = `${user} added a note for Order# ${params.order.code} Shipment# ${params
          .shipment.code}`; // +' and issue id '+params.issueId;

        break;

      case 'IssueCreatedCR':
        messages.title = `Note created for Shipment# ${params.shipment.code}`;
        messages.message = `Note created for shipment# ${params.shipment.code}`;
        break;
      case 'IssueRespondedCR':
        user = `${params.addedBy.firstName} ${params.addedBy.lastName}`.trim();
        messages.title = `${user} responded on note for Shipment# ${params.shipment.code}`;
        messages.message = `${user} responded on note for shipment# ${params.shipment.code}`; // +' and issue id '+params.issueId;

        break;

      case 'ShipmentScheduledCR':
        messages.title = `Shipment# ${params.shipment.code} is ready for pickup.`;
        messages.message = `Shipment# ${params.shipment.code} is ready for pickup.`;
        break;

      case 'ShipmentScheduledSR':
        messages.title = `Shipment is scheduled for Order# ${params.order.code} Shipment# ${params
          .shipment.code}`;
        messages.message = `Shipment is scheduled for Order# ${params.order.code} Shipment# ${params
          .shipment.code}`;
        break;

      case 'GPSBluetoothDown':
        // userType = !(userId) ? 'User's ' : '';
        if (params.notificationFor) {
          if (params.notificationFor === 'all') {
            messages.title = `Bluetooth and GPS services are off for ${params.deviceName}.`;
            messages.message = `Bluetooth and GPS services are currently off for ${params.deviceName}.`;
          } else if (params.notificationFor === 'bluetooth') {
            messages.title = `Bluetooth service is off for ${params.deviceName}.`;
            messages.message = `Bluetooth service is currently off for ${params.deviceName}.`;
          } else if (params.notificationFor === 'gps') {
            messages.title = `GPS service is off for ${params.deviceName}.`;
            messages.message = `GPS service is currently off for ${params.deviceName}.`;
          }

          messages.message += ` To use this app, kindly enable.`;
        }
        break;
      case 'CarrierAssignment':
        messages.title = `Shipment# ${params.shipmentCode} is ready for pickup.`;
        messages.message = `Shipment# ${params.shipmentCode} is ready for pickup.`;
        break;
      // case 'DelayedShipment':
      //   message = 'Shipment for case no+ ' + params.caseNo + ' /Shipment# ' + params.shipmentNo + ' is delayed';
      //   break;
      // case 'UnshippedItems':
      //   //message = 'Shipment for case no+ '+params.caseNo+' /Shipment# '+params.shipmentNo+' is delayed';
      //   message = 'Some item(s) not shipped for case number ' + params.caseNo + ' +';
      //   break;
      case 'BeaconServiceOff':
        messages.title = 'Your beacon service is off. To use this app, kindly enable.';
        messages.message = 'Your beacon service is off. To use this app, kindly enable.';

        break;
      case 'OrderCreation':
        messages.title = `Order# ${params.orderCode} has been assigned to you`;
        messages.message = `Order# ${params.orderCode} has been assigned to you`;
        break;
      case 'OrderAssignedFromSalesRep':
        messages.title = `Order# ${params.orderCode}'s assignee has been changed`;
        messages.message = `Order# ${params.orderCode} has been assigned from you to ${`${params
          .newConsumer.firstName} ${params.newConsumer.lastName}`.trim()}`;
        break;
      case 'OrderAssignedToSalesRep':
        messages.title = `Order# ${params.orderCode}'s assignee has been changed`;
        messages.message = `Order# ${params.orderCode} has been assigned from ${`${params
          .oldConsumer.firstName} ${params.oldConsumer.lastName}`.trim()} to you`;
        break;
      case 'SurgeryDateChange':
        messages.title = `Surgery for Order# ${params.orderCode} has been rescheduled`;
        messages.message = `Surgery for Order# ${params.orderCode} has been rescheduled from ${akUtils.convertDateToTimezone(
          {
            dateToConvert: params.oldSurgeryDate,
            timeZone: dateTimezone,
            formatType: 'dtz'
          }
        )} to ${akUtils.convertDateToTimezone({
          dateToConvert: params.newSurgeryDate,
          timeZone: dateTimezone,
          formatType: 'dtz'
        })}`;
        break;
      // case 'TestNotification':
      //   message = 'This is Test Notifications';
      //   break;
      case 'ShipmentSoftShippedCR':
        messages.title = `Shipment is Soft Shipped for Shipment# ${params.shipment.code}`;
        messages.message = `Shipment is Soft Shipped for Shipment# ${params.shipment.code}`;

        break;

      case 'ShipmentSoftShippedSR':
        messages.title = `Shipment is Soft Shipped for Order# ${params.order
          .code} Shipment# ${params.shipment.code}`;
        messages.message = `Shipment is Soft Shipped for Order# ${params.order
          .code} Shipment# ${params.shipment.code}`;
        break;

      case 'ShipmentPartialShippedCR':
        messages.title = `Shipment is Partial Shipped for Shipment# ${params.shipment.code}`;
        messages.message = `Shipment is Partial Shipped for Shipment# ${params.shipment.code}`;

        break;

      case 'ShipmentPartialShippedSR':
        messages.title = `Shipment is Partial Shipped for Order# ${params.order
          .code} Shipment# ${params.shipment.code}`;
        messages.message = `Shipment is Partial Shipped for Order# ${params.order
          .code} Shipment# ${params.shipment.code}`;
        break;

      case 'ShipmentHardShippedCR':
        messages.title = `Shipment is In Transit for Shipment# ${params.shipment.code}`;
        messages.message = `Shipment is In Transit for Shipment# ${params.shipment.code}`;

        break;

      case 'ShipmentHardShippedSR':
        messages.title = `Shipment is In Transit for Order# ${params.order.code} Shipment# ${params
          .shipment.code}`;
        messages.message = `Shipment is In Transit for Order# ${params.order
          .code} Shipment# ${params.shipment.code}`;
        break;

      case 'ShipmentPartialDeliveredCR':
        messages.title = `Shipment is Partial Delivered for Shipment# ${params.shipment.code}`;
        messages.message = `Shipment is Partial Delivered for Shipment# ${params.shipment.code}`;

        break;

      case 'ShipmentPartialDeliveredSR':
        messages.title = `Shipment is Partial Delivered for Order# ${params.order
          .code} Shipment# ${params.shipment.code}`;
        messages.message = `Shipment is Partial Delivered for Order# ${params.order
          .code} Shipment# ${params.shipment.code}`;
        break;

      case 'ShipmentHardDeliveredCR':
        messages.title = `Shipment is Delivered for Shipment# ${params.shipment.code}`;
        messages.message = `Shipment is Delivered for Shipment# ${params.shipment.code}`;

        break;

      case 'ShipmentHardDeliveredSR':
        messages.title = `Shipment is Delivered for Order# ${params.order.code} Shipment# ${params
          .shipment.code}`;
        messages.message = `Shipment is Delivered for Order# ${params.order.code} Shipment# ${params
          .shipment.code}`;
        break;

      case 'ShipmentSoftDeliveredCR':
        messages.title = `Shipment is Soft Delivered for Shipment# ${params.shipment.code}`;
        messages.message = `Shipment is Soft Delivered for Shipment# ${params.shipment.code}`;
        break;

      case 'ShipmentSoftDeliveredSR':
        messages.title = `Shipment is Soft Delivered for Order# ${params.order
          .code} Shipment# ${params.shipment.code}`;
        messages.message = `Shipment is Soft Delivered for Order# ${params.order
          .code} Shipment# ${params.shipment.code}`;
        break;

      case 'ShipmentDelayedCR':
        messages.title = `Shipment is Delayed for Shipment# ${params.shipment.code}.`;
        messages.message = `Shipment is Delayed for Shipment# ${params.shipment.code}.`;

        break;
      case 'ShipmentDelayedSR':
        messages.title = `Shipment is Delayed for Order# ${params.order.code} Shipment# ${params
          .shipment.code}.`;
        messages.message = `Shipment is Delayed for Order# ${params.order.code} Shipment# ${params
          .shipment.code}.`;
        break;

      case 'DeviceTestNotification':
        messages.title = `This is Test Notification Title for ${params.deviceName}`;
        messages.message = `This is Test Notification Message for ${params.deviceName}`;
        break;
      default:
        break;
    }
    return messages;
  }

  getWebNotificationMessages(notificationType, params, dateTimezone = 'UTC', recieverUserData) {
    const messages = {
      title: '',
      message: ''
    };
    let userName;
    if ((recieverUserData || {}).uuid) {
      userName = `${(recieverUserData || {}).firstName || ''} ${(recieverUserData || {}).lastName ||
        ''}`.trim();
    } else {
      userName = 'User';
    }

    // const message = '';
    // let userType = '';
    let user = '';
    switch (notificationType) {
      // case 'IssueStateChanged':
      //   message = 'Note status changed for case no+ ' + params.caseNo + ' /Shipment# ' + params.shipmentNo;
      //   break;
      // case 'IssueClosed':
      //   message = 'Note closed for case no+ ' + params.caseNo + ' /Shipment# ' + params.shipmentNo;
      //   break;
      case 'IssueCreatedSR':
        messages.title = `Note created for Order# ${params.order.code} /Shipment# ${params.shipment
          .code}`;
        messages.message = `Note created for Order# ${params.order.code} and shipment# ${params
          .shipment.code}`;
        break;
      case 'IssueRespondedSR':
        user = `${params.addedBy.firstName} ${params.addedBy.lastName}`.trim();
        messages.title = `${user} responded on note for Order# ${params.order
          .code} /Shipment# ${params.shipment.code}`;
        messages.message = `${user} added a note for shipment# ${params.shipment.code}`; // +' and issue id '+params.issueId;

        break;

      case 'IssueCreatedCR':
        messages.title = `Note created for Shipment# ${params.shipment.code}`;
        messages.message = `Note created for shipment# ${params.shipment.code}`;
        break;
      case 'IssueRespondedCR':
        user = `${params.addedBy.firstName} ${params.addedBy.lastName}`.trim();
        messages.title = `${user} responded on note for Shipment# ${params.shipment.code}`;
        messages.message = `${user} responded on note for shipment# ${params.shipment.code}`; // +' and issue id '+params.issueId;

        break;

      case 'ShipmentScheduledCR':
        messages.title = `Shipment# ${params.shipment.code} is ready for pickup`;
        messages.message = `Shipment# ${params.shipment.code} is ready for pickup`;

        break;

      case 'ShipmentScheduledSR':
        messages.title = `Shipment Scheduled for Order# ${params.order.code} Shipment# ${params
          .shipment.code}`;
        messages.message = `Shipment Scheduled for Order# ${params.order.code} Shipment# ${params
          .shipment.code}`;
        break;

      case 'GPSBluetoothDown':
        // userType = !(userId) ? 'User's ' : '';
        if (params.notificationFor) {
          if (params.notificationFor === 'all') {
            messages.title = `Bluetooth and GPS services are off for ${params.deviceName}`;
            messages.message = `Bluetooth and GPS services are currently off for ${params.deviceName}`;
          } else if (params.notificationFor === 'bluetooth') {
            messages.title = `Bluetooth service is off for ${params.deviceName}`;
            messages.message = `Bluetooth service is currently off for ${params.deviceName}`;
          } else if (params.notificationFor === 'gps') {
            messages.title = `GPS service is off for ${params.deviceName}`;
            messages.message = `GPS service is currently off for ${params.deviceName}`;
          }

          messages.message += ` To use this app, kindly enable.`;
        }
        break;
      case 'CarrierAssignment':
        messages.title = `Shipment# ${params.shipmentCode} is ready for pickup`;
        messages.message = `Shipment# ${params.shipmentCode} is ready for pickup`;

        break;
      // case 'DelayedShipment':
      //   message = 'Shipment for case no+ ' + params.caseNo + ' /Shipment# ' + params.shipmentNo + ' is delayed';
      //   break;
      // case 'UnshippedItems':
      //   //message = 'Shipment for case no+ '+params.caseNo+' /Shipment# '+params.shipmentNo+' is delayed';
      //   message = 'Some item(s) not shipped for case number ' + params.caseNo + ' +';
      //   break;
      case 'BeaconServiceOff':
        messages.title = `${userName}'s beacon service is off. Please Enable.`;
        messages.message = `${userName}'s beacon service is off. Please Enable.`;

        break;
      case 'OrderCreation':
        messages.title = `Order# ${params.orderCode} has been assigned to ${userName}`;
        messages.message = `Order# ${params.orderCode} has been assigned to ${userName}`;
        break;
      case 'OrderAssignedFromSalesRep':
        messages.title = `Order# ${params.orderCode}'s assignee has been changed`;
        messages.message = `Order# ${params.orderCode} has been assigned from ${userName} to ${`${params
          .newConsumer.firstName} ${params.newConsumer.lastName}`.trim()}`;
        break;
      case 'OrderAssignedToSalesRep':
        messages.title = `Order# ${params.orderCode}'s assignee has been changed`;
        messages.message = `Order# ${params.orderCode} has been assigned from ${`${params
          .oldConsumer.firstName} ${params.oldConsumer.lastName}`.trim()} to ${userName}`;
        break;
      case 'SurgeryDateChange':
        messages.title = `Surgery for Order# ${params.orderCode} has been rescheduled`;
        messages.message = `Surgery for Order# ${params.orderCode} has been rescheduled from ${akUtils.convertDateToTimezone(
          {
            dateToConvert: params.oldSurgeryDate,
            timeZone: dateTimezone,
            formatType: 'dtz'
          }
        )} to ${akUtils.convertDateToTimezone({
          dateToConvert: params.newSurgeryDate,
          timeZone: dateTimezone,
          formatType: 'dtz'
        })}`;
        break;
      // case 'TestNotification':
      //   message = 'This is Test Notifications';
      //   break;
      case 'ShipmentSoftShippedCR':
        messages.title = `Shipment is Soft Shipped for Shipment# ${params.shipment.code}`;
        messages.message = `Shipment is Soft Shipped for Shipment# ${params.shipment.code}`;

        break;

      case 'ShipmentSoftShippedSR':
        messages.title = `Shipment is Soft Shipped for Order# ${params.order
          .code} Shipment# ${params.shipment.code}`;
        messages.message = `Shipment is Soft Shipped for Order# ${params.order
          .code} Shipment# ${params.shipment.code}`;
        break;

      case 'ShipmentPartialShippedCR':
        messages.title = `Shipment is Partial Shipped for Shipment# ${params.shipment.code}`;
        messages.message = `Shipment is Partial Shipped for Shipment# ${params.shipment.code}`;

        break;

      case 'ShipmentPartialShippedSR':
        messages.title = `Shipment is Partial Shipped for Order# ${params.order
          .code} Shipment# ${params.shipment.code}`;
        messages.message = `Shipment is Partial Shipped for Order# ${params.order
          .code} Shipment# ${params.shipment.code}`;
        break;

      case 'ShipmentHardShippedCR':
        messages.title = `Shipment is In Transit for Shipment# ${params.shipment.code}`;
        messages.message = `Shipment is In Transit for Shipment# ${params.shipment.code}`;

        break;

      case 'ShipmentHardShippedSR':
        messages.title = `Shipment is In Transit for Order# ${params.order.code} Shipment# ${params
          .shipment.code}`;
        messages.message = `Shipment is In Transit for Order# ${params.order
          .code} Shipment# ${params.shipment.code}`;
        break;

      case 'ShipmentPartialDeliveredCR':
        messages.title = `Shipment is Partial Delivered for Shipment# ${params.shipment.code}`;
        messages.message = `Shipment is Partial Delivered for Shipment# ${params.shipment.code}`;

        break;

      case 'ShipmentPartialDeliveredSR':
        messages.title = `Shipment is Partial Delivered for Order# ${params.order
          .code} Shipment# ${params.shipment.code}`;
        messages.message = `Shipment is Partial Delivered for Order# ${params.order
          .code} Shipment# ${params.shipment.code}`;
        break;

      case 'ShipmentHardDeliveredCR':
        messages.title = `Shipment is Delivered for Shipment# ${params.shipment.code}`;
        messages.message = `Shipment is Delivered for Shipment# ${params.shipment.code}`;

        break;

      case 'ShipmentHardDeliveredSR':
        messages.title = `Shipment is Delivered for Order# ${params.order.code} Shipment# ${params
          .shipment.code}`;
        messages.message = `Shipment is Delivered for Order# ${params.order.code} Shipment# ${params
          .shipment.code}`;
        break;

      case 'ShipmentSoftDeliveredCR':
        messages.title = `Shipment is Soft Delivered for Shipment# ${params.shipment.code}`;
        messages.message = `Shipment is Soft Delivered for Shipment# ${params.shipment.code}`;
        break;

      case 'ShipmentSoftDeliveredSR':
        messages.title = `Shipment is Soft Delivered for Order# ${params.order
          .code} Shipment# ${params.shipment.code}`;
        messages.message = `Shipment is Soft Delivered for Order# ${params.order
          .code} Shipment# ${params.shipment.code}`;
        break;
      case 'ShipmentDelayedCR':
        messages.title = `Shipment is Delayed for Shipment# ${params.shipment.code}`;
        messages.message = `Shipment is Delayed for Shipment# ${params.shipment.code}`;
        break;

      case 'ShipmentDelayedSR':
        messages.title = `Shipment is Delayed for Order# ${params.order.code} Shipment# ${params
          .shipment.code}`;
        messages.message = `Shipment is Delayed for Order# ${params.order.code} Shipment# ${params
          .shipment.code}`;
        break;

      case 'DeviceTestNotification':
        messages.title = `This is Test Notification Title for ${params.deviceName}`;
        messages.message = `This is Test Notification Message for ${params.deviceName}`;
        break;

      default:
        break;
    }
    return messages;
  }
}

module.exports = new Notification();
