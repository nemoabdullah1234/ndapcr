const appSettingmodel = require('../models/appSettings');
const mongoose = require('mongoose');
const bluebirdPromise = require('bluebird');
const commonHelper = require('./common');
const appStatusHelper = require('./appStatus');
// const search = require('../services/search');
const validator = require('../lib/validatorAsync');
const akUtils = require('../lib/utility');
const jsTypeChecker = require('javascript-type-checker');
const currentUserHandler = require('../lib/currentUserHandler');
const clientHandler = require('../lib/clientHandler');

const dashboardDefaultView = ['All', 'Watched', 'Exceptions'];
const dashboardSortBy = ['code', 'etd', 'orderStatusUpdatedOn'];
const dashboardSortOrder = ['asc', 'desc'];
const appName = process.env.allowedAppNames.split(',');

const appSettingService = function() {};

/**
 * Set client of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
appSettingService.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

/**
 * Query the database to fetch appSettings on the basis of search parameters and other parameters
 * 
 * @param {Object} searchParams search filters
 * @param {Object} otherParams pagination, sorting etc other params.
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
appSettingService.prototype.get = function(searchParams, otherParams) {
  return appSettingmodel
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
};

/**
 * Query the database to fetch appSettings on the basis of search parameters and other parameters
 * 
 * @param {Object} searchParams search filters
 * @param {Object} otherParams pagination, sorting etc other params.
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
appSettingService.prototype.getById = function(configId = '') {
  if (!mongoose.Types.ObjectId.isValid(configId)) {
    return bluebirdPromise.reject();
  }
  let conditions = { _id: mongoose.Types.ObjectId(configId) };
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return appSettingmodel
    .find(conditions)
    .exec()
    .then(result => {
      if (result.length > 0) {
        return bluebirdPromise.resolve(this.formatResponse(result[0]));
      }
      return bluebirdPromise.reject();
    });
};

/**
 * Query the database to fetch appSettings on the basis of search parameters and other parameters
 * 
 * @param {Object} searchParams search filters
 * @param {Object} otherParams pagination, sorting etc other params.
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
appSettingService.prototype.getAppSettings = function(event, settingType) {
  settingType = settingType || 'general';
  const uId = currentUserHandler.getCurrentUser().uuid;
  const appName = event.headers.appname;
  let conditions = {
    'user.uuid': uId,
    appName
  };
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return appSettingmodel
    .find(conditions)
    .exec()
    .then(result => bluebirdPromise.resolve(this.formatResponse((result || [])[0])))
    .then(formattedResult => {
      switch (settingType) {
        case 'general':
          // formattedResult.trackingHours = undefined;
          // formattedResult.emergencyContacts = undefined;
          return formattedResult;
        default:
          if (formattedResult[settingType]) {
            return formattedResult[settingType];
          }
          return bluebirdPromise.reject(new Error('Invalid settingType'));
      }
    });
};
/**
 * Count appSettings on the basis of some search conditions.
 * 
 * @param {Object} searchParams Search Conditions
 * @return {Promise<Number>} Number of matching appSettings.
 * 
 */
appSettingService.prototype.count = function(searchParams = {}) {
  return appSettingmodel.count(searchParams).exec();
};

/**
 * Performs response from DB operations to return as API response.
 * 
 * @param {Object} data Database operation result.
 * @param {Boolean} isDropdown Whether the APi is requesting a dropdown.
 * @return {Promise} formattedResponse Formatted Response
 * 
 */
appSettingService.prototype.formatResponse = function(data) {
  const formattedResponse = {};
  data = data || {};
  formattedResponse.id = data._id || 'default';
  formattedResponse.user = (data || {}).user || currentUserHandler.getCurrentUser() || {};
  formattedResponse.appName = (data || {}).appName || '';

  formattedResponse.dashboardDefaultView = (data || {}).dashboardDefaultView
    ? data.dashboardDefaultView
    : dashboardDefaultView[0];
  formattedResponse.dashboardSortBy = (data || {}).dashboardSortBy
    ? data.dashboardSortBy
    : dashboardSortBy[0];
  formattedResponse.dashboardSortOrder = (data || {}).dashboardSortOrder
    ? data.dashboardSortOrder
    : dashboardSortOrder[0];
  formattedResponse.silentHrsFrom = (data || {}).silentHrsFrom || '';
  formattedResponse.silentHrsTo = (data || {}).silentHrsTo || '';
  formattedResponse.notifications = (data || {}).notifications !== false;
  formattedResponse.sound = !!(data || {}).sound;
  formattedResponse.vibration = !!(data || {}).vibration;
  formattedResponse.led = !!(data || {}).led;
  formattedResponse.getEmailNotifications = (data || {}).getEmailNotifications !== false;
  formattedResponse.beaconServiceStatus = (data || {}).beaconServiceStatus !== false;
  formattedResponse.trackingHours = (data || {}).trackingHours || {
    weekdays: [
      {
        from: '00:00:00',
        to: '23:59:59'
      }
    ],
    saturday: [
      {
        from: '00:00:00',
        to: '23:59:59'
      }
    ],
    sunday: [
      {
        from: '00:00:00',
        to: '23:59:59'
      }
    ]
  };

  formattedResponse.emergencyContacts = (data || {}).emergencyContacts || [];
  formattedResponse.updatedOn = (data || {}).updatedOn;
  formattedResponse.updatedBy = `${((data || {}).updatedBy || '').firstName || ''} ${((data || {})
    .updatedBy || ''
  ).lastName || ''}`;
  formattedResponse.client = (data || {}).client;
  return formattedResponse;
};

/**
 * Generate the search conditions for the GET operation.
 * 
 * @param {Object} event Lambda Event
 * @return {Object} filters.
 * 
 */
appSettingService.prototype.getFilterParams = function(event) {
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
};

/**
 * Generate the extra parameters for the GET operation like sorting, pagination etc.
 * 
 * @param {Object} request Lambda Event
 * @return {Object} extraParams
 * 
 */
appSettingService.prototype.getExtraParams = function(event) {
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
};

/**
 * Performs validations common in both update and save.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
appSettingService.prototype.commonValidations = function(event) {
  // console.log(event.body);
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
      bluebirdPromise.all([validator.type('boolean', event.body.notifications)]),
      bluebirdPromise.all([validator.type('boolean', event.body.sound)]),
      bluebirdPromise.all([validator.type('boolean', event.body.vibration)]),
      bluebirdPromise.all([validator.type('boolean', event.body.led)]),
      bluebirdPromise.all([validator.type('boolean', event.body.getEmailNotifications)]),
      bluebirdPromise.all([validator.type('boolean', event.body.beaconServiceStatus)]),
      bluebirdPromise.all([
        validator.type('object', event.body.trackingHours),
        validator.requiredKeyinObject(event.body.trackingHours, 'weekdays'),
        validator.requiredKeyinObject(event.body.trackingHours, 'saturday'),
        validator.requiredKeyinObject(event.body.trackingHours, 'sunday'),
        validator.type('array', (event.body.trackingHours || {}).weekdays),
        validator.type('array', (event.body.trackingHours || {}).saturday),
        validator.type('array', (event.body.trackingHours || {}).sunday),
        validator.requiredKeyinObject((event.body.trackingHours || {}).weekdays, 'from'),
        validator.requiredKeyinObject((event.body.trackingHours || {}).weekdays, 'to'),
        validator.requiredKeyinObject((event.body.trackingHours || {}).saturday, 'from'),
        validator.requiredKeyinObject((event.body.trackingHours || {}).saturday, 'to'),
        validator.requiredKeyinObject((event.body.trackingHours || {}).sunday, 'from'),
        validator.requiredKeyinObject((event.body.trackingHours || {}).sunday, 'to')
      ]),
      bluebirdPromise.all([
        validator.type('array', event.body.emergencyContacts),
        validator.arrayOfType('object', event.body.emergencyContacts),
        validator.requiredKeyinObject(event.body.emergencyContacts, 'name'),
        validator.requiredKeyinObject(event.body.emergencyContacts, 'number')
      ])
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
        beaconServiceStatus: { index: 9, fieldName: 'beaconServiceStatus' },
        trackingHours: { index: 10, fieldName: 'trackingHours' },
        emergencyContacts: { index: 11, fieldName: 'emergencyContacts' }
      };
      const errors = akUtils.mapAndGetValidationErrors(result, validatorErrorsMap);
      if (errors) {
        return bluebirdPromise.reject(errors);
      }
      return bluebirdPromise.resolve();
    });
};

/**
 * Performs update-specific validations before performing common validations.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
appSettingService.prototype.validateUpdate = function(event) {
  let errors = [];
  return this.getById(event.pathParameters.id)
    .catch(() => {
      errors.push({ code: 2500, message: 'Nothing to update' });
      return bluebirdPromise.reject(errors);
    })
    .then(result => {
      if (result.sysDefined === 1) {
        errors.push({ code: 2501, message: 'Cannot modify sysDefined appSetting.' });
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
};

/**
 * Checks if a give code already exists in the database.
 * 
 * @param {String} code Code to check
 * @param {String} excludedObjId Object ID of current object if checking while update.
 * @return {Promise} Resolved promise if duplicate code. Rejected promise otherwise
 * 
 */
appSettingService.prototype.isDuplicateCode = function(code = '', excludedObjId = null) {
  let conditions;
  if (excludedObjId !== null && mongoose.Types.ObjectId.isValid(excludedObjId)) {
    conditions = { code, _id: { $ne: mongoose.Types.ObjectId(excludedObjId) } };
  } else {
    conditions = { code };
  }
  conditions = clientHandler.addClientFilterToConditions(conditions);

  return appSettingmodel
    .findOne(conditions)
    .exec()
    .then(result => {
      if (result) {
        return bluebirdPromise.resolve();
      }
      return bluebirdPromise.reject();
    });
};

/**
 * Performs save-specific validations before performing common validations.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
appSettingService.prototype.validateRequest = function(event) {
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
};

/**
 * Save an appSetting
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of save operation.
 * 
 */
appSettingService.prototype.save = function save(event) {
  const appSettingObj = new appSettingmodel(); // create a new instance of the  model

  appSettingObj.user = currentUserHandler.getCurrentUser();
  appSettingObj.appName = event.headers.appname;

  appSettingObj.dashboardDefaultView = event.body.dashboardDefaultView
    ? event.body.dashboardDefaultView
    : dashboardDefaultView[0];
  appSettingObj.dashboardSortBy = event.body.dashboardSortBy
    ? event.body.dashboardSortBy
    : dashboardSortBy[0];
  appSettingObj.dashboardSortOrder = event.body.dashboardSortOrder
    ? event.body.dashboardSortOrder
    : dashboardSortOrder[0];
  appSettingObj.silentHrsFrom = event.body.silentHrsFrom || '';
  appSettingObj.silentHrsTo = event.body.silentHrsTo || '';
  appSettingObj.notifications = event.body.notifications ? 1 : 0;
  appSettingObj.sound = event.body.sound ? 1 : 0;
  appSettingObj.vibration = event.body.vibration ? 1 : 0;
  appSettingObj.led = event.body.led ? 1 : 0;
  appSettingObj.getEmailNotifications = event.body.getEmailNotifications ? 1 : 0;
  appSettingObj.beaconServiceStatus = event.body.beaconServiceStatus ? 1 : 0;

  appSettingObj.updatedOn = Date.now();
  appSettingObj.updatedBy = currentUserHandler.getCurrentUser();
  appSettingObj.client = clientHandler.getClient();

  return appSettingObj.save();
};

/**
 * Update an appSetting
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of update operation.
 * 
 */
appSettingService.prototype.update = function(event) {
  let conditions = {};
  const appName = event.headers.appname;
  conditions = clientHandler.addClientFilterToConditions(conditions);
  conditions['user.uuid'] = currentUserHandler.getCurrentUser().uuid || '_';
  conditions.appName = event.headers.appname;

  let appSettingUpdateObj = {};
  appSettingUpdateObj.user = currentUserHandler.getCurrentUser();
  appSettingUpdateObj.appName = event.headers.appname;

  // appSettingUpdateObj.dashboardDefaultView = event.body.dashboardDefaultView ? event.body.dashboardDefaultView : dashboardDefaultView[0];
  // appSettingUpdateObj.dashboardSortBy = event.body.dashboardSortBy ? event.body.dashboardSortBy : dashboardSortBy[0];
  // appSettingUpdateObj.dashboardSortOrder = event.body.dashboardSortOrder ? event.body.dashboardSortOrder : dashboardSortOrder[0];
  // appSettingUpdateObj.silentHrsFrom = event.body.silentHrsFrom || '';
  // appSettingUpdateObj.silentHrsTo = event.body.silentHrsTo || '';
  // appSettingUpdateObj.notifications = event.body.notifications === 'On' ? 1 : 0;
  // appSettingUpdateObj.sound = event.body.sound === 'On' ? 1 : 0;
  // appSettingUpdateObj.vibration = event.body.vibration === 'On' ? 1 : 0;
  // appSettingUpdateObj.led = event.body.led === 'On' ? 1 : 0;
  // appSettingUpdateObj.getEmailNotifications = event.body.getEmailNotifications === 'On' ? 1 : 0;
  // appSettingUpdateObj.beaconServiceStatus = event.body.beaconServiceStatus === 'On' ? 1 : 0;

  appSettingUpdateObj.updatedOn = Date.now();
  appSettingUpdateObj.updatedBy = currentUserHandler.getCurrentUser();
  appSettingUpdateObj.client = clientHandler.getClient();

  appSettingUpdateObj = Object.assign({}, event.body, appSettingUpdateObj);
  const updateParams = {
    $set: appSettingUpdateObj
  };
  return appSettingmodel
    .findOne(conditions)
    .exec()
    .then(res => {
      if (!res) {
        updateParams.$setOnInsert = { __v: 1 };
      } else {
        updateParams.$inc = { __v: 1 };
      }
      return appSettingmodel
        .findOneAndUpdate(conditions, updateParams, {
          upsert: true,
          new: true
        })
        .exec();
    })
    .then(res => {
      if (typeof appSettingUpdateObj.beaconServiceStatus === 'boolean') {
        return appStatusHelper
          .saveBeaconServiceStatusForUser({
            userEmail: currentUserHandler.getCurrentUser().email,
            beaconService: appSettingUpdateObj.beaconServiceStatus,
            appName
          })
          .then(() => res);
      }
      return res;
    });
};

appSettingService.prototype.getUserAppSettings = function(sub, appName) {
  return this.getAppSettings({
    headers: {
      authorizer: {
        sub
      },
      appname: appName
    }
  });
};

module.exports = new appSettingService();
