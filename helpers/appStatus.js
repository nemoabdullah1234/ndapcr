const appStatusmodel = require('../models/appStatus');
const mongoose = require('mongoose');
const bluebirdPromise = require('bluebird');
const commonHelper = require('./common');
// const search = require('../services/search');
const validator = require('../lib/validatorAsync');
const akUtils = require('../lib/utility');
const jsTypeChecker = require('javascript-type-checker');
const notificationLib = require('../lib/notification');

const dashboardDefaultView = ['All', 'Watched', 'Exceptions'];
const dashboardSortBy = ['ETD', 'CaseNo', 'Hospital', 'Doctor', 'SurgeryType', 'SurgeryDate'];
const dashboardSortOrder = ['asc', 'desc'];
const appName = process.env.allowedAppNames.split(',');
const onOffValues = ['On', 'Off'];
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');

class appStatusService {
  /**
   * Set client of the helper for use across all functions in the helper
   * 
   * @param {Object} clientObj
   * @return {Void}
   * 
   */
  setClient(clientObj) {
    this.client = clientObj;
  }

  /**
   * Query the database to fetch appStatus on the basis of search parameters and other parameters
   * 
   * @param {Object} searchParams search filters
   * @param {Object} otherParams pagination, sorting etc other params.
   * @return {Promise} Promise to represent the result of get operation.
   * 
   */
  get(searchParams, otherParams) {
    return appStatusmodel
      .find(searchParams)
      .sort(otherParams.sort)
      .skip(otherParams.pageParams.offset)
      .limit(otherParams.pageParams.limit)
      .exec()
      .then(result => {
        if (result.length > 0) {
          return bluebirdPromise.resolve(this.formatResponse(result[0]));
        }
        return bluebirdPromise.reject();
      });
  }

  /**
   * Query the database to fetch appStatus on the basis of search parameters and other parameters
   * 
   * @param {Object} searchParams search filters
   * @param {Object} otherParams pagination, sorting etc other params.
   * @return {Promise} Promise to represent the result of get operation.
   * 
   */
  getById(configId = '') {
    if (!mongoose.Types.ObjectId.isValid(configId)) {
      return bluebirdPromise.reject();
    }
    let conditions = { _id: mongoose.Types.ObjectId(configId) };
    conditions = clientHandler.addClientFilterToConditions(conditions);
    return appStatusmodel
      .find(conditions)
      .exec()
      .then(result => {
        if (result.length > 0) {
          return bluebirdPromise.resolve(this.formatResponse(result[0]));
        }
        return bluebirdPromise.reject();
      });
  }

  /**
   * Query the database to fetch appStatus on the basis of search parameters and other parameters
   * 
   * @param {Object} searchParams search filters
   * @param {Object} otherParams pagination, sorting etc other params.
   * @return {Promise} Promise to represent the result of get operation.
   * 
   */
  getAppStatus(event) {
    const uId = event.headers.authorizer.sub;
    const appName = event.headers.appname;
    let conditions = {
      'user.uuid': uId,
      appName
    };
    conditions = clientHandler.addClientFilterToConditions(conditions);
    return appStatusmodel
      .find(conditions)
      .exec()
      .then(result => bluebirdPromise.resolve(this.formatResponse((result || [])[0])));
  }

  /**
   * Count appStatus on the basis of some search conditions.
   * 
   * @param {Object} searchParams Search Conditions
   * @return {Promise<Number>} Number of matching appStatus.
   * 
   */
  count(searchParams = {}) {
    return appStatusmodel
      .find(searchParams)
      .exec()
      .then(result => result.length);
  }

  /**
   * Performs response from DB operations to return as API response.
   * 
   * @param {Object} data Database operation result.
   * @param {Boolean} isDropdown Whether the APi is requesting a dropdown.
   * @return {Promise} formattedResponse Formatted Response
   * 
   */
  formatResponse(data) {
    const formattedResponse = {};
    data = data || {};
    formattedResponse.id = data._id || 'default';
    formattedResponse.user = data.user || currentUserHandler.getCurrentUser() || {};
    formattedResponse.appName = data.appName || '';

    formattedResponse.dashboardDefaultView = data.dashboardDefaultView
      ? data.dashboardDefaultView
      : dashboardDefaultView[0];
    formattedResponse.dashboardSortBy = data.dashboardSortBy
      ? data.dashboardSortBy
      : dashboardSortBy[0];
    formattedResponse.dashboardSortOrder = data.dashboardSortOrder
      ? data.dashboardSortOrder
      : dashboardSortOrder[0];
    formattedResponse.silentHrsFrom = data.silentHrsFrom || '';
    formattedResponse.silentHrsTo = data.silentHrsTo || '';
    formattedResponse.notifications = data.notifications ? 'On' : 'Off';
    formattedResponse.sound = data.sound ? 'On' : 'Off';
    formattedResponse.vibration = data.vibration ? 'On' : 'Off';
    formattedResponse.led = data.led ? 'On' : 'Off';
    formattedResponse.getEmailNotifications = data.getEmailNotifications ? 'On' : 'Off';
    formattedResponse.beaconServiceStatus = data.beaconServiceStatus ? 'On' : 'Off';

    formattedResponse.updatedOn = data.updatedOn;
    formattedResponse.updatedBy = `${((data || {}).updatedBy || '').firstName || ''} ${((data || {})
      .updatedBy || ''
    ).lastName || ''}`;
    formattedResponse.client = data.client;
    return formattedResponse;
  }

  /**
   * Generate the search conditions for the GET operation.
   * 
   * @param {Object} event Lambda Event
   * @return {Object} filters.
   * 
   */
  getFilterParams(event) {
    let filters = {};
    filters = clientHandler.addClientFilterToConditions(filters);
    if (event.queryStringParameters && event.queryStringParameters.filter) {
      // filters._all = event.queryStringParameters.filter;
      filters.$or = [
        { name: new RegExp(event.queryStringParameters.filter, 'i') },
        { code: new RegExp(event.queryStringParameters.filter, 'i') }
      ];
    }

    if (event.queryStringParameters.id) {
      filters._id = mongoose.Types.ObjectId(event.queryStringParameters.id);
    }
    if (event.queryStringParameters.code) {
      filters.code = new RegExp(event.queryStringParameters.code, 'i');
    }
    if (event.queryStringParameters.name) {
      filters.name = new RegExp(event.queryStringParameters.name, 'i');
    }
    // if (request.queryStringParameters.status === '1' || request.queryStringParameters.status === '0') filters.status = request.queryStringParameters.status === '1';
    if (event.queryStringParameters.dd === '1') {
      filters.status = 1;
      filters.sysDefined = 0;
    }

    return filters;
  }

  /**
   * Generate the extra parameters for the GET operation like sorting, pagination etc.
   * 
   * @param {Object} request Lambda Event
   * @return {Object} extraParams
   * 
   */
  getExtraParams(event) {
    const params = {};
    params.sort = {};
    if (!event.queryStringParameters) {
      params.pageParams = {
        offset: 0,
        limit: 20
      };
      params.sort.updatedOn = -1;
      return params;
    }
    const dd = event.queryStringParameters.dd === '1';
    const offset = event.queryStringParameters.offset ? event.queryStringParameters.offset : 0;
    const limit = event.queryStringParameters.limit ? event.queryStringParameters.limit : 20;
    params.isDropdown = dd;
    params.pageParams = {
      offset: dd ? 0 : parseInt(offset, 10),
      limit: dd ? 65535 : parseInt(limit, 10)
    };
    if (event.queryStringParameters.sort) {
      const sortQuery = event.queryStringParameters.sort;
      const sortColumns = sortQuery.split(',');
      sortColumns.forEach(function(col) {
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
      params.sort.updatedOn = -1;
    }

    return params;
  }

  /**
   * Performs validations common in both update and save.
   * 
   * @param {Object} event Lambda Event
   * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
   * 
   */
  commonValidations(event) {
    return bluebirdPromise
      .all([
        bluebirdPromise.all([
          validator.required(event.headers.appname),
          validator.valueAllowed(appName, event.headers.appname)
        ]),
        bluebirdPromise.all([
          validator.valueAllowed(dashboardDefaultView, event.body.dashboardDefaultView)
        ]),
        bluebirdPromise.all([validator.valueAllowed(dashboardSortBy, event.body.dashboardSortBy)]),
        bluebirdPromise.all([
          validator.valueAllowed(dashboardSortOrder, event.body.dashboardSortOrder)
        ]),
        bluebirdPromise.all([validator.valueAllowed(onOffValues, event.body.notifications)]),
        bluebirdPromise.all([validator.valueAllowed(onOffValues, event.body.sound)]),
        bluebirdPromise.all([validator.valueAllowed(onOffValues, event.body.vibration)]),
        bluebirdPromise.all([validator.valueAllowed(onOffValues, event.body.led)]),
        bluebirdPromise.all([
          validator.valueAllowed(onOffValues, event.body.getEmailNotifications)
        ]),
        bluebirdPromise.all([validator.valueAllowed(onOffValues, event.body.beaconServiceStatus)])
      ])
      .then(result => {
        const validatorErrorsMap = {
          appName: { index: 0, fieldName: 'App Name' },
          dashboardDefaultView: { index: 1, fieldName: 'dashboardDefaultView' },
          dashboardSortBy: { index: 2, fieldName: 'dashboardSortBy' },
          dashboardSortOrder: { index: 3, fieldName: 'dashboardSortOrder' },
          notifications: { index: 4, fieldName: 'notifications' },
          sound: { index: 5, fieldName: 'sound' },
          vibration: { index: 6, fieldName: 'vibration' },
          led: { index: 7, fieldName: 'led' },
          getEmailNotifications: { index: 8, fieldName: 'getEmailNotifications' },
          beaconServiceStatus: { index: 9, fieldName: 'beaconServiceStatus' }
        };
        const errors = akUtils.mapAndGetValidationErrors(result, validatorErrorsMap);
        if (errors) {
          return bluebirdPromise.reject(errors);
        }
        return bluebirdPromise.resolve();
      });
  }

  /**
   * Performs update-specific validations before performing common validations.
   * 
   * @param {Object} event Lambda Event
   * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
   * 
   */
  validateUpdate(event) {
    let errors = [];
    return this.getById(event.pathParameters.id)
      .catch(() => {
        errors.push({ code: 2500, message: 'Nothing to update' });
        return bluebirdPromise.reject(errors);
      })
      .then(result => {
        if (result.sysDefined === 1) {
          errors.push({ code: 2501, message: 'Cannot modify sysDefined appStatus.' });
          return bluebirdPromise.reject(errors);
        }
        if (event.body.code && result.code !== event.body.code) {
          errors.push({ code: 2502, message: 'Code cannot be modified.' });
        }
        return this.commonValidations(event)
          .catch(errs => {
            errors = errors.concat(errs);
            return bluebirdPromise.reject(errors);
          })
          .then(event => {
            if (errors.length > 0) {
              return bluebirdPromise.reject(errors);
            }
            return bluebirdPromise.resolve(event);
          });
      });
  }

  /**
   * Checks if a give code already exists in the database.
   * 
   * @param {String} code Code to check
   * @param {String} excludedObjId Object ID of current object if checking while update.
   * @return {Promise} Resolved promise if duplicate code. Rejected promise otherwise
   * 
   */
  isDuplicateCode(code = '', excludedObjId = null) {
    let conditions;
    if (excludedObjId !== null && mongoose.Types.ObjectId.isValid(excludedObjId)) {
      conditions = { code, _id: { $ne: mongoose.Types.ObjectId(excludedObjId) } };
    } else {
      conditions = { code };
    }
    conditions = clientHandler.addClientFilterToConditions(conditions);

    return appStatusmodel
      .findOne(conditions)
      .exec()
      .then(result => {
        if (result) {
          return bluebirdPromise.resolve();
        }
        return bluebirdPromise.reject();
      });
  }

  /**
   * Performs save-specific validations before performing common validations.
   * 
   * @param {Object} event Lambda Event
   * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
   * 
   */
  validateRequest(event) {
    return this.commonValidations(event)
      .then(() => {})
      .catch(errors => {
        if (!jsTypeChecker.isEmptyObject(errors)) {
          return bluebirdPromise.reject(
            akUtils.getObjectValues(akUtils.sortErrorsObject(errors, 'attributes'))
          );
        }
        return bluebirdPromise.resolve();
      });
  }

  /**
   * Save an appStatus
   * 
   * @param {Object} event Lambda Event
   * @return {Promise} Promise to represent the result of save operation.
   * 
   */
  save(event) {
    const appStatusObj = new appStatusmodel(); // create a new instance of the  model

    appStatusObj.user = currentUserHandler.getCurrentUser();
    appStatusObj.appName = event.headers.appname;

    appStatusObj.dashboardDefaultView = event.body.dashboardDefaultView
      ? event.body.dashboardDefaultView
      : dashboardDefaultView[0];
    appStatusObj.dashboardSortBy = event.body.dashboardSortBy
      ? event.body.dashboardSortBy
      : dashboardSortBy[0];
    appStatusObj.dashboardSortOrder = event.body.dashboardSortOrder
      ? event.body.dashboardSortOrder
      : dashboardSortOrder[0];
    appStatusObj.silentHrsFrom = event.body.silentHrsFrom || '';
    appStatusObj.silentHrsTo = event.body.silentHrsTo || '';
    appStatusObj.notifications = event.body.notifications === 'On' ? 1 : 0;
    appStatusObj.sound = event.body.sound === 'On' ? 1 : 0;
    appStatusObj.vibration = event.body.vibration === 'On' ? 1 : 0;
    appStatusObj.led = event.body.led === 'On' ? 1 : 0;
    appStatusObj.getEmailNotifications = event.body.getEmailNotifications === 'On' ? 1 : 0;
    appStatusObj.beaconServiceStatus = event.body.beaconServiceStatus === 'On' ? 1 : 0;

    appStatusObj.updatedOn = Date.now();
    appStatusObj.updatedBy = currentUserHandler.getCurrentUser();
    appStatusObj.client = clientHandler.getClient();

    return appStatusObj.save();
  }

  /**
   * Save an appStatus
   * 
   * @param {Object} event Lambda Event
   * @return {Promise} Promise to represent the result of save operation.
   * 
   */
  saveAppStatus({ deviceCode, appName, updateStatus }) {
    const newStatus = {};

    return this.didStatusChange(deviceCode, updateStatus).then(didStatusChange => {
      if (!didStatusChange) {
        return bluebirdPromise.resolve({});
      }
      let conditions = { deviceCode };
      conditions = clientHandler.addClientFilterToConditions(conditions);
      return appStatusmodel.findOne(conditions).then(res => {
        const updateParams = {};
        const obj = {};
        obj.deviceCode = deviceCode;
        if (appName) {
          obj.appName = appName;
        }

        obj.updatedBy = currentUserHandler.getCurrentUser();
        obj.updatedOn = new Date();
        obj.client = clientHandler.getClient();
        if (!res) {
          const status = {};
          obj.status = [];

          status.statusTime = new Date();
          status.gps = updateStatus.gps ? parseInt(updateStatus.gps, 10) : 0;
          status.bluetooth = updateStatus.bluetooth ? parseInt(updateStatus.bluetooth, 10) : 0;
          status.beaconService = updateStatus.beaconService
            ? parseInt(updateStatus.beaconService, 10)
            : 1;

          obj.status.push(status);

          updateParams.$setOnInsert = { __v: 1 };
        } else {
          const lastStatus = res.status.slice(-1)[0];
          // console.log(lastStatus);
          newStatus.gps =
            parseInt(updateStatus.gps, 10) >= 0
              ? parseInt(updateStatus.gps, 10)
              : parseInt(lastStatus.gps, 10);
          newStatus.bluetooth =
            parseInt(updateStatus.bluetooth, 10) >= 0
              ? parseInt(updateStatus.bluetooth, 10)
              : parseInt(lastStatus.bluetooth, 10);
          newStatus.beaconService =
            parseInt(updateStatus.beaconService, 10) >= 0
              ? parseInt(updateStatus.beaconService, 10)
              : parseInt(lastStatus.beaconService, 10);
          // console.log(newStatus);
          // console.log('newStatus');
          updateParams.$push = {
            status: newStatus
          };
          updateParams.$inc = { __v: 1 };
        }
        updateParams.$set = obj;
        return appStatusmodel
          .findOneAndUpdate(conditions, updateParams, {
            upsert: true,
            new: true
          })
          .then(res =>
            notificationLib.sendGPSBluetoothDownNotification(deviceCode).then(() => res)
          );
      });
    });
  }

  /**
   * Save an appStatus
   * 
   * @param {Object} event Lambda Event
   * @return {Promise} Promise to represent the result of save operation.
   * 
   */
  saveBeaconServiceStatus({ deviceCode, appName, beaconService }) {
    const newStatus = {};
    // console.log(deviceCode);
    // console.log('deviceCode');
    // console.log(beaconService);
    // console.log('beaconService');
    return this.didStatusChange(deviceCode, { beaconService: Number(!!beaconService) })
      .then(didStatusChange => {
        // console.log(didStatusChange);
        if (!didStatusChange) {
          return bluebirdPromise.resolve({});
        }
        let conditions = { deviceCode };
        conditions = clientHandler.addClientFilterToConditions(conditions);
        return appStatusmodel.findOne(conditions).then(res => {
          const updateParams = {};
          const obj = {};
          obj.deviceCode = deviceCode;
          if (appName) {
            obj.appName = appName;
          }

          obj.updatedBy = currentUserHandler.getCurrentUser();
          obj.updatedOn = new Date();
          obj.client = clientHandler.getClient();

          const lastStatus = res.status.slice(-1)[0];
          newStatus.gps = parseInt(lastStatus.gps, 10) || 0;
          newStatus.bluetooth = parseInt(lastStatus.bluetooth, 10) || 0;
          newStatus.beaconService = Number(!!beaconService);
          // console.log(newStatus);
          // console.log('newStatus');
          updateParams.$push = {
            status: newStatus
          };
          updateParams.$inc = { __v: 1 };

          updateParams.$set = obj;
          // console.log('++++++');
          return appStatusmodel
            .findOneAndUpdate(conditions, updateParams, {
              upsert: true,
              new: true
            })
            .then(res =>
              notificationLib
                .sendBeaconServiceNotification(!!beaconService, appName)
                .then(() => res)
            );
        });
      })
      .catch(e => {
        // console.log(e);
      });
  }

  saveBeaconServiceStatusForUser({ userEmail, appName, beaconService }) {
    const deviceHelper = require('./device');
    // console.log(arguments);
    return deviceHelper
      .getUserApps(userEmail)
      .then(data => {
        data = data.filter(x => x.appName === appName);
        // console.log(data);
        // const deviceCodeList = data.map(x => x.code || '');
        // // console.log('data');
        // // console.log(deviceCodeList);
        // // console.log('beaconService');
        // // console.log(beaconService);
        return bluebirdPromise.map(data, device =>
          this.saveBeaconServiceStatus({
            deviceCode: device.code,
            beaconService,
            appName
          })
        );
      })
      .catch(e => {
        // console.log(e);
      });
  }

  getCurrentStatuses(deviceCode) {
    let conditions = { deviceCode };
    conditions = clientHandler.addClientFilterToConditions(conditions);
    return appStatusmodel.findOne(conditions).then(result => {
      if (!result) {
        return {};
      }
      return (result.toObject().status || []).slice(-1)[0] || {};
    });
  }

  didStatusChange(deviceCode, { bluetooth, beaconService, gps }) {
    return this.getCurrentStatuses(deviceCode).then(currentStatusObj => {
      bluetooth = parseInt(bluetooth, 10);
      gps = parseInt(gps, 10);
      beaconService = parseInt(beaconService, 10);

      if (!new Set([0, 1]).has(bluetooth)) {
        bluetooth = currentStatusObj.bluetooth || 0;
      }
      if (!new Set([0, 1]).has(gps)) {
        gps = currentStatusObj.gps || 0;
      }
      if (!new Set([0, 1]).has(beaconService)) {
        beaconService = currentStatusObj.beaconService || 0;
      }
      return !(
        bluetooth === currentStatusObj.bluetooth &&
        gps === currentStatusObj.gps &&
        beaconService === currentStatusObj.beaconService
      );
    });
  }
  /**
   * Update an appStatus
   * 
   * @param {Object} event Lambda Event
   * @return {Promise} Promise to represent the result of update operation.
   * 
   */
  update(event) {
    let conditions = {};
    conditions = clientHandler.addClientFilterToConditions(conditions);

    const appStatusUpdateObj = {};
    appStatusUpdateObj.user = currentUserHandler.getCurrentUser();
    appStatusUpdateObj.appName = event.headers.appname;

    appStatusUpdateObj.dashboardDefaultView = event.body.dashboardDefaultView
      ? event.body.dashboardDefaultView
      : dashboardDefaultView[0];
    appStatusUpdateObj.dashboardSortBy = event.body.dashboardSortBy
      ? event.body.dashboardSortBy
      : dashboardSortBy[0];
    appStatusUpdateObj.dashboardSortOrder = event.body.dashboardSortOrder
      ? event.body.dashboardSortOrder
      : dashboardSortOrder[0];
    appStatusUpdateObj.silentHrsFrom = event.body.silentHrsFrom || '';
    appStatusUpdateObj.silentHrsTo = event.body.silentHrsTo || '';
    appStatusUpdateObj.notifications = event.body.notifications === 'On' ? 1 : 0;
    appStatusUpdateObj.sound = event.body.sound === 'On' ? 1 : 0;
    appStatusUpdateObj.vibration = event.body.vibration === 'On' ? 1 : 0;
    appStatusUpdateObj.led = event.body.led === 'On' ? 1 : 0;
    appStatusUpdateObj.getEmailNotifications = event.body.getEmailNotifications === 'On' ? 1 : 0;
    appStatusUpdateObj.beaconServiceStatus = event.body.beaconServiceStatus === 'On' ? 1 : 0;

    appStatusUpdateObj.updatedOn = Date.now();
    appStatusUpdateObj.updatedBy = currentUserHandler.getCurrentUser();
    appStatusUpdateObj.client = clientHandler.getClient();

    const updateParams = {
      $set: appStatusUpdateObj
    };
    return appStatusmodel
      .findOne(conditions)
      .exec()
      .then(res => {
        if (!res) {
          updateParams.$setOnInsert = { __v: 1 };
        } else {
          updateParams.$inc = { __v: 1 };
        }
        return appStatusmodel
          .findOneAndUpdate(conditions, updateParams, {
            upsert: true,
            new: true
          })
          .exec();
      });
  }
}

module.exports = new appStatusService();
