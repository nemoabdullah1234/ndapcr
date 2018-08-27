const notificationModel = require('../models/notification');
const emailHelper = require('../helpers/emails');
const appSettingHelper = require('../helpers/appSettings');
const mongoose = require('mongoose');
const bluebirdPromise = require('bluebird');
const clientHandler = require('../lib/clientHandler');
const uaLib = require('../lib/pushClient');
const uaPayloadCreator = require('../lib/pushClient/payloadCreators');
const akUtils = require('../lib/utility');
const currentUserHandler = require('../lib/currentUserHandler');

class NotificationService {
  getById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return bluebirdPromise.reject('ak-notification-unexist');
    }

    return notificationModel
      .findOne(
        clientHandler.addClientFilterToConditions({
          _id: mongoose.Types.ObjectId(id)
        })
      )
      .then(result => {
        if (!result) {
          return bluebirdPromise.reject('ak-notification-unexist');
        }
        return bluebirdPromise.resolve(result);
      });
  }

  sendNotification(notificationId) {
    return bluebirdPromise.all([
      this.sendPush(notificationId)
        .then(() => this.markPushNotified(notificationId))
        .catch(err => {
          if (err.response) {
            // console.log(JSON.stringify(err.response.data));
          } else {
            // console.log(err);
          }
        }),
      this.sendEmail(notificationId)
        .then(() => this.markEmailNotified(notificationId))
        .catch(err => {
          // console.log('err');
          // console.log(err);
        })
    ]);
  }

  sendPush(notificationId) {
    return this.getById(notificationId).then(data =>
      uaLib.getInstanceByAppNamePromisified(data.recieverData.appType).then(instance =>
        this.isSendingNotificationAllowed({
          notificationType: data.type,
          sendType: data.recieverData.sendType,
          appType: data.recieverData.appType,
          recieverUserData: data.recieverUserData
        }).then(isAllowed => {
          if (isAllowed === false) {
            return bluebirdPromise.reject('Not allowed to send Notification');
          }
          let payload;

          if (data.recieverData.sendType === 'device') {
            payload = uaPayloadCreator.createDevicePushPayload({
              os: data.recieverData.os,
              title: data.title,
              message: data.message,
              channelId: data.recieverData.channelId
            });
          } else if (data.recieverData.sendType === 'user') {
            payload = uaPayloadCreator.createNamedUserPushPayload({
              message: data.message,
              namedUser: data.recieverData.namedUserId
            });
          }
          return instance.sendPush(payload);
        })
      )
    );
  }

  sendEmail(notificationId) {
    return this.getById(notificationId).then(data =>
      this.isSendingEmailAllowed({
        notificationType: data.type,
        sendType: data.recieverData.sendType,
        appType: data.recieverData.appType,
        recieverUserData: data.recieverUserData
      }).then(isAllowed => {
        if (isAllowed === false) {
          return bluebirdPromise.reject('Not allowed to send Email');
        }
        // console.log((data.recieverUserData || {}).email);

        if (!(data.recieverUserData || {}).email) {
          return bluebirdPromise.reject('No email specified');
        }

        data = JSON.parse(JSON.stringify(data));
        data.params.name = `${data.recieverUserData.firstName || ''} ${data.recieverUserData
          .lastName || ''}`.trim();
        data.params.message = data.message;
        return emailHelper.sendEmail(
          data.recieverUserData.email,
          data.title,
          data.type,
          data.params
        );
      })
    );
  }

  markPushNotified(id) {
    // console.log('PUSH SENT');
    return notificationModel
      .findOneAndUpdate(
        clientHandler.addClientFilterToConditions({
          _id: mongoose.Types.ObjectId(id)
        }),
        {
          $set: {
            pushNotified: true
          }
        }
      )
      .exec();
  }

  markEmailNotified(id) {
    // console.log('EMAIL SENT');
    return notificationModel
      .findOneAndUpdate(
        clientHandler.addClientFilterToConditions({
          _id: mongoose.Types.ObjectId(id)
        }),
        {
          $set: {
            emailNotified: true
          }
        }
      )
      .exec();
  }

  get(filterParams, otherParams) {
    const aggregrateQuery = [];
    aggregrateQuery.push({ $match: filterParams });
    aggregrateQuery.push({
      $addFields: {
        actionByName: { $concat: ['$actionBy.firstName', ' ', '$actionBy.lastName'] }
      }
    });
    aggregrateQuery.push({ $sort: otherParams.sort });
    if (!otherParams.isForMobile) {
      aggregrateQuery.push({ $skip: otherParams.pageParams.offset });
      aggregrateQuery.push({ $limit: otherParams.pageParams.limit });
    }

    return bluebirdPromise
      .resolve()
      .then(() => {
        if (otherParams.markAsRead) {
          return this.markAsRead(filterParams);
        }
        return {};
      })
      .then(() =>
        notificationModel
          .aggregate(aggregrateQuery)
          .collation({
            locale: 'en_US',
            caseLevel: false
          })
          .exec()
          .then(result => {
            if ((result || []).length === 0 && !otherParams.isForMobile) {
              return bluebirdPromise.reject();
            }
            return result.map(x => this.formatResponse(x, otherParams.isForMobile));
          })
      );
  }

  markAsRead(conditions) {
    return notificationModel
      .update(
        clientHandler.addClientFilterToConditions(conditions),
        {
          $set: { read: true }
        },
        {
          upsert: false,
          multi: true
        }
      )
      .exec();
  }

  count(filterParams) {
    return notificationModel
      .find(filterParams)
      .exec()
      .then(result => result.length);
  }

  formatResponse(data, forMobile) {
    let formattedResponse = {};

    if (forMobile) {
      formattedResponse = {
        id: data._id,
        type: data.type,
        title: data.title,
        message: data.message,
        notificationTime: akUtils.convertDateToTimezone({
          dateToConvert: data.insertedOn,
          formatType: 'dt',
          timeZone: (currentUserHandler.getCurrentUser() || {}).timezone
        }),
        params: {}
      };
    } else {
      formattedResponse = {
        id: data._id,
        type: data.type,
        title: data.title,
        message: data.message,
        notificationTime: data.insertedOn,
        recieverUserData: data.recieverUserData,
        actionBy: data.actionBy,
        read: !!data.read,
        pushNotified: !!data.pushNotified,
        emailNotified: !!data.emailNotified,
        params: {}
      };
    }

    formattedResponse.params = this.generateNotificationParams(data, forMobile);
    return formattedResponse;
  }

  generateNotificationParams(notificationObj, forMobile) {
    const paramsObj = notificationObj.params;
    const params = {};
    const serviceTypeMap = {
      bluetooth: 0,
      gps: 1,
      all: 2
    };
    switch (notificationObj.type) {
      case 'GPSBluetoothDown':
        params.serviceType = serviceTypeMap[paramsObj.notificationFor];
        break;
      case 'OrderCreation':
        params.orderId = paramsObj.orderId;
        break;
      case 'ShipmentSoftDeliveredCR':
      case 'ShipmentHardDeliveredCR':
      case 'ShipmentPartialDeliveredCR':
      case 'ShipmentHardShippedCR':
      case 'ShipmentSoftShippedCR':
      case 'ShipmentPartialShippedCR':
      case 'ShipmentScheduledCR':
      case 'ShipmentDelayedCR':
        params.shipmentId = paramsObj.shipment.id;
        break;
      case 'ShipmentSoftDeliveredSR':
      case 'ShipmentHardDeliveredSR':
      case 'ShipmentPartialDeliveredSR':
      case 'ShipmentHardShippedSR':
      case 'ShipmentSoftShippedSR':
      case 'ShipmentPartialShippedSR':
      case 'ShipmentScheduledSR':
      case 'ShipmentDelayedSR':
        params.shipmentId = paramsObj.shipment.id;
        params.orderId = paramsObj.order.id;
        break;
      case 'CarrierAssignment':
        params.shipmentId = paramsObj.shipmentId;
        break;
      case 'SurgeryDateChange':
        params.orderId = paramsObj.orderId;
        break;
      case 'OrderAssignedFromSalesRep':
      case 'OrderAssignedToSalesRep':
        params.orderId = paramsObj.orderId;
        break;
      case 'IssueRespondedSR':
      case 'IssueCreatedSR':
        params.issueId = paramsObj.issueId;
        params.orderId = paramsObj.order.id;
        params.shipmentId = paramsObj.shipment.id;
        break;
      case 'IssueRespondedCR':
      case 'IssueCreatedCR':
        params.issueId = paramsObj.issueId;
        params.shipmentId = paramsObj.shipment.id;
        break;
      case 'BeaconServiceOff':
      default:
        break;
    }
    return params;
  }

  getFilterParams({ queryStringParameters }) {
    const filters = {};
    filters.archived = false;
    filters.$and = [
      {
        type: {
          $nin: ['DeviceSilentPush']
        }
      }
    ];

    if (queryStringParameters.filter) {
      filters.$or = [
        {
          message: new RegExp(queryStringParameters.filter, 'i')
        },
        {
          type: new RegExp(queryStringParameters.filter, 'i')
        },
        {
          actionByName: new RegExp(queryStringParameters.filter, 'i')
        }
      ];
    }
    // if (queryStringParameters.isArchived === '1') {
    //   filters.archived = true;
    // } else if (queryStringParameters.isArchived === '0') {
    //   filters.archived = false;
    // }
    if (queryStringParameters.mobile === '1') {
      filters['recieverUserData.uuid'] = currentUserHandler.getCurrentUser().uuid;
      filters.isForWeb = false;
    } else if (queryStringParameters.web === '1') {
      filters.isForWeb = true;
    } else if (queryStringParameters.web === '0') {
      filters.isForWeb = false;
    }

    if (queryStringParameters.user !== null && queryStringParameters.user !== undefined) {
      filters['recieverUserData.uuid'] = queryStringParameters.user;
    }

    if (
      currentUserHandler.getCurrentUser().preferredRole !==
      akUtils.getRoleFromGroupName(process.env.adminGroupName)
    ) {
      filters.isForWeb = false;
      filters['recieverUserData.uuid'] = currentUserHandler.getCurrentUser().uuid;
    }

    if (queryStringParameters.read === '1') {
      filters.read = true;
    } else if (queryStringParameters.read === '0') {
      filters.read = false;
    }

    if (queryStringParameters.pushNotified === '1') {
      filters.pushNotified = true;
    } else if (queryStringParameters.pushNotified === '0') {
      filters.pushNotified = false;
    }

    if (queryStringParameters.emailNotified === '1') {
      filters.emailNotified = true;
    } else if (queryStringParameters.emailNotified === '0') {
      filters.emailNotified = false;
    }

    if (queryStringParameters.title) {
      filters.title = new RegExp(queryStringParameters.title, 'i');
    }
    if (queryStringParameters.message) {
      filters.message = new RegExp(queryStringParameters.message, 'i');
    }
    if (queryStringParameters.type) {
      filters.type = queryStringParameters.type;
    }
    if (queryStringParameters.actionBy) {
      filters['actionBy.uuid'] = queryStringParameters.actionBy;
    }

    if (queryStringParameters.notificationTimeFrom || queryStringParameters.notificationTimeTo) {
      filters.insertedOn = {};
    }

    if (queryStringParameters.notificationTimeFrom) {
      filters.insertedOn.$gte = new Date(queryStringParameters.notificationTimeFrom);
    }

    if (queryStringParameters.notificationTimeTo) {
      filters.insertedOn.$lte = akUtils.formatToDateFilter(
        new Date(queryStringParameters.notificationTimeTo)
      );
    }
    return clientHandler.addClientFilterToConditions(filters);
  }

  getExtraParams(event) {
    const params = {};
    params.sort = {};
    if (!event.queryStringParameters) {
      params.pageParams = {
        offset: 0,
        limit: 20
      };
      params.sort.insertedOn = -1;
      return params;
    }
    const forMobile = event.queryStringParameters.mobile === '1';
    const offset = event.queryStringParameters.offset ? event.queryStringParameters.offset : 0;
    const limit = event.queryStringParameters.limit ? event.queryStringParameters.limit : 20;
    params.isForMobile = forMobile;
    params.pageParams = {
      offset: forMobile ? 0 : parseInt(offset, 10),
      limit: forMobile ? 0 : parseInt(limit, 10)
    };

    params.markAsRead = event.queryStringParameters.markAsRead !== '0';
    if (event.queryStringParameters.sort) {
      const sortQuery = event.queryStringParameters.sort;
      const sortColumns = sortQuery.split(',');
      sortColumns.forEach(col => {
        let sortOrder = 1;
        col = col.trim();
        const isValidColumn = this.getColumnMap(col) || this.getColumnMap(col.replace('-', ''));
        if (isValidColumn) {
          if (col.startsWith('-')) {
            sortOrder = -1;
            col = col.replace('-', '');
          }

          col = this.getColumnMap(col);
          params.sort[col] = sortOrder;
        }
      }, this);
    } else {
      params.sort.insertedOn = -1;
    }

    return params;
  }

  getColumnMap(key) {
    const map = {
      id: '_id',
      type: 'type',
      title: 'title',
      message: 'message',
      notificationTime: 'insertedOn',
      actionBy: 'actionByName',
      read: 'read',
      pushNotified: 'pushNotified',
      emailNotified: 'emailNotified'
    };

    if (key) {
      return map[key] || key;
    }
    return map;
  }

  archive({ notificationIdList, archiveAll }) {
    archiveAll = !!archiveAll;
    let conditions = {};
    if (!archiveAll) {
      notificationIdList = (notificationIdList || []).map(notificationId => {
        if (mongoose.Types.ObjectId.isValid(notificationId)) {
          return mongoose.Types.ObjectId(notificationId);
        }
        return notificationId;
      });
      conditions = {
        _id: {
          $in: notificationIdList
        }
      };
    } else {
      conditions = {
        'recieverUserData.uuid': currentUserHandler.getCurrentUser().uuid
      };
    }
    conditions = clientHandler.addClientFilterToConditions(conditions);
    const updateParams = {
      $set: {}
    };
    updateParams.$set.archived = true;
    return notificationModel.update(conditions, updateParams, {
      upsert: false,
      multi: true
    });
  }

  isSendingNotificationAllowed({ notificationType, sendType, appType, recieverUserData }) {
    if (sendType === 'device') {
      return bluebirdPromise.resolve(true);
    }
    return appSettingHelper
      .getUserAppSettings(recieverUserData.uuid, appType, 'general')
      .then(settings => {
        settings = settings || {};
        if (settings.notifications === false) {
          return settings.notifications;
        }
        return true;
      });
  }

  isSendingEmailAllowed({ notificationType, sendType, appType, recieverUserData }) {
    if (sendType === 'device') {
      return bluebirdPromise.resolve(false);
    }
    return appSettingHelper
      .getUserAppSettings(recieverUserData.uuid, appType, 'general')
      .then(settings => {
        settings = settings || {};
        if (settings.getEmailNotifications === false) {
          return settings.getEmailNotifications;
        }
        return true;
      });
  }
}

module.exports = new NotificationService();
