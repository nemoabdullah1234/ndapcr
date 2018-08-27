const configurationmodel = require('../models/configuration');
const mongoose = require('mongoose');
const bluebirdPromise = require('bluebird');
const commonHelper = require('./common');
// const search = require('../services/search');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');
const akUtils = require('../lib/utility');

const configurationService = function() {};

/**
 * Set client of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
configurationService.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

/**
 * Query the database to fetch configurations on the basis of search parameters and other parameters
 * 
 * @param {Object} searchParams search filters
 * @param {Object} otherParams pagination, sorting etc other params.
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
configurationService.prototype.get = function(searchParams, otherParams) {
  return configurationmodel
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
 * Query the database to fetch configurations on the basis of search parameters and other parameters
 * 
 * @param {Object} searchParams search filters
 * @param {Object} otherParams pagination, sorting etc other params.
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
configurationService.prototype.getById = function(configId = '') {
  if (!mongoose.Types.ObjectId.isValid(configId)) {
    return bluebirdPromise.reject();
  }
  let conditions = { _id: mongoose.Types.ObjectId(configId) };
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return configurationmodel
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
 * Query the database to fetch configurations on the basis of search parameters and other parameters
 * 
 * @param {Object} searchParams search filters
 * @param {Object} otherParams pagination, sorting etc other params.
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
configurationService.prototype.getConfigurations = function() {
  let conditions = {};
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return configurationmodel
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
 * Count configurations on the basis of some search conditions.
 * 
 * @param {Object} searchParams Search Conditions
 * @return {Promise<Number>} Number of matching configurations.
 * 
 */
configurationService.prototype.count = function(searchParams = {}) {
  return configurationmodel.count(searchParams).exec();
};

/**
 * Performs response from DB operations to return as API response.
 * 
 * @param {Object} data Database operation result.
 * @param {Boolean} isDropdown Whether the APi is requesting a dropdown.
 * @return {Promise} formattedResponse Formatted Response
 * 
 */
configurationService.prototype.formatResponse = function(data) {
  const formattedResponse = {};

  formattedResponse.id = data._id;
  formattedResponse.date = data.date;
  formattedResponse.dateTime = data.dateTime;
  formattedResponse.timezone = data.timezone;
  formattedResponse.pagination = data.pagination;
  formattedResponse.measurement = data.measurement;
  formattedResponse.temperatureUnit = data.temperatureUnit;
  formattedResponse.kontaktApiKey = data.kontaktApiKey || '';
  if (!new Set([true, false]).has(data.isAutoDeliveryMode)) {
    data.isAutoDeliveryMode = true;
  }
  if (!new Set([true, false]).has(data.isAutoShipMode)) {
    data.isAutoShipMode = true;
  }
  if (!new Set([true, false]).has(data.autocloseorder)) {
    data.autocloseorder = false;
  }
  if (!new Set([true, false]).has(data.autocloseshipment)) {
    data.autocloseshipment = false;
  }
  formattedResponse.autocloseshipment = data.autocloseshipment;
  formattedResponse.autocloseorder = data.autocloseorder;
  formattedResponse.autocloseorderafter = data.autocloseorderafter;
  formattedResponse.autocloseshipmentafter = data.autocloseshipmentafter;
  formattedResponse.isAutoDeliveryMode = data.isAutoDeliveryMode;
  formattedResponse.isAutoShipMode = data.isAutoShipMode;
  formattedResponse.stationaryShipmentTimeSeconds = data.stationaryShipmentTimeSeconds || 600;
  formattedResponse.updatedOn = data.updatedOn;
  formattedResponse.kontaktSyncTimeSeconds = data.kontaktSyncTimeSeconds || 120;
  formattedResponse.updatedBy = `${((data || {}).updatedBy || '').firstName} ${((data || {})
    .updatedBy || ''
  ).lastName}`;
  formattedResponse.client = data.client;
  return formattedResponse;
};

/**
 * Generate the search conditions for the GET operation.
 * 
 * @param {Object} event Lambda Event
 * @return {Object} filters.
 * 
 */
configurationService.prototype.getFilterParams = function(event) {
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
configurationService.prototype.getExtraParams = function(event) {
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
configurationService.prototype.commonValidations = function(event) {
  const errors = [];

  const dateHelper = require('../helpers/dateFormat');
  const datetimeHelper = require('../helpers/dateTimeFormat');
  const timezoneHelper = require('../helpers/timezone');

  if (!event.body.date || !mongoose.Types.ObjectId.isValid(event.body.date)) {
    errors.push({ errorCode: 2100, message: 'Date Format is missing or Invalid' });
  }
  if (!event.body.dateTime || !mongoose.Types.ObjectId.isValid(event.body.dateTime)) {
    errors.push({ errorCode: 2101, message: 'Datetime Format is missing or Invalid' });
  }
  if (!event.body.timezone || !mongoose.Types.ObjectId.isValid(event.body.timezone)) {
    errors.push({ errorCode: 2102, message: 'Timezone is missing or Invalid' });
  }
  if (!event.body.pagination) {
    errors.push({ errorCode: 2103, message: 'Pagination is missing or Invalid' });
  }
  if (!event.body.measurement) {
    errors.push({ errorCode: 2104, message: 'Measurement is missing or Invalid' });
  }

  if (errors.length > 0) {
    return bluebirdPromise.reject(errors);
  }

  return bluebirdPromise
    .all([
      dateHelper.getById(event.body.date),
      datetimeHelper.getById(event.body.dateTime),
      timezoneHelper.getById(event.body.timezone)
    ])
    .then(resObj => {
      event.body.date = resObj[0];
      event.body.dateTime = resObj[1];
      event.body.timezone = resObj[2];
      return bluebirdPromise.resolve(event);
    })
    .catch(err => {
      errors.push({ code: 2178, message: 'Error in data resolution', error: err });
      return bluebirdPromise.reject(errors);
    });
};

/**
 * Performs update-specific validations before performing common validations.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
configurationService.prototype.validateUpdate = function(event) {
  let errors = [];
  return this.getById(event.pathParameters.id)
    .catch(() => {
      errors.push({ code: 2500, message: 'Nothing to update' });
      return bluebirdPromise.reject(errors);
    })
    .then(result => {
      if (result.sysDefined === 1) {
        errors.push({ code: 2501, message: 'Cannot modify sysDefined configuration.' });
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
configurationService.prototype.isDuplicateCode = function(code = '', excludedObjId = null) {
  let conditions;
  if (excludedObjId !== null && mongoose.Types.ObjectId.isValid(excludedObjId)) {
    conditions = { code, _id: { $ne: mongoose.Types.ObjectId(excludedObjId) } };
  } else {
    conditions = { code };
  }
  conditions = clientHandler.addClientFilterToConditions(conditions);

  return configurationmodel
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
configurationService.prototype.validateRequest = function(event) {
  return this.commonValidations(event);
};

/**
 * Save an configuration
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of save operation.
 * 
 */
configurationService.prototype.save = function save(event) {
  const configurationObj = new configurationmodel(); // create a new instance of the  model
  configurationObj.code = event.body.code;
  configurationObj.name = event.body.name;
  configurationObj.sysDefined = 0;
  configurationObj.status = event.body.status;
  configurationObj.updatedOn = Date.now();
  configurationObj.updatedBy = currentUserHandler.getCurrentUser();
  configurationObj.client = clientHandler.getClient();
  configurationObj.tags = event.body.tags;
  return configurationObj.save();
};

/**
 * Update an configuration
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of update operation.
 * 
 */
configurationService.prototype.update = function(event) {
  let conditions = {};
  conditions = clientHandler.addClientFilterToConditions(conditions);

  const configurationUpdateObj = {};
  configurationUpdateObj.date = event.body.date;
  configurationUpdateObj.dateTime = event.body.dateTime;
  configurationUpdateObj.timezone = event.body.timezone;
  configurationUpdateObj.temperatureUnit = event.body.temperatureUnit;
  configurationUpdateObj.measurement = event.body.measurement;
  configurationUpdateObj.pagination = event.body.pagination;
  if (!new Set([true, false]).has(event.body.isAutoDeliveryMode)) {
    event.body.isAutoDeliveryMode = true;
  }
  if (!new Set([true, false]).has(event.body.isAutoShipMode)) {
    event.body.isAutoShipMode = true;
  }
  if (!new Set([true, false]).has(event.body.autocloseorder)) {
    event.body.autocloseorder = false;
  }
  if (!new Set([true, false]).has(event.body.autocloseshipment)) {
    event.body.autocloseshipment = false;
  }
  configurationUpdateObj.autocloseshipment = event.body.autocloseshipment;
  configurationUpdateObj.autocloseorder = event.body.autocloseorder;
  configurationUpdateObj.autocloseorderafter = event.body.autocloseorderafter || 0;
  configurationUpdateObj.autocloseshipmentafter = event.body.autocloseshipmentafter || 0;
  configurationUpdateObj.isAutoDeliveryMode = event.body.isAutoDeliveryMode;
  configurationUpdateObj.kontaktApiKey = event.body.kontaktApiKey || '';
  configurationUpdateObj.isAutoShipMode = event.body.isAutoShipMode;
  configurationUpdateObj.stationaryShipmentTimeSeconds =
    event.body.stationaryShipmentTimeSeconds || 600;
  configurationUpdateObj.kontaktSyncTimeSeconds = event.body.kontaktSyncTimeSeconds || 120;
  configurationUpdateObj.client = clientHandler.getClient();
  configurationUpdateObj.updatedOn = Date.now();
  configurationUpdateObj.updatedBy = currentUserHandler.getCurrentUser();

  const updateParams = {
    $set: configurationUpdateObj
  };
  return configurationmodel
    .findOne(conditions)
    .exec()
    .then(res => {
      if (!res) {
        updateParams.$setOnInsert = { __v: 1 };
      } else {
        updateParams.$inc = { __v: 1 };
      }
      return configurationmodel
        .findOneAndUpdate(conditions, updateParams, {
          upsert: true,
          new: true
        })
        .exec();
    });
};

configurationService.prototype.getDateTimeFormat = function() {
  return this.getConfigurations()
    .then(config => ((config || {}).dateTime || {}).code)
    .catch(e => {
      akUtils.log(e, 'getDateTimeFormat');
    });
};

configurationService.prototype.getDateFormat = function() {
  return this.getConfigurations()
    .then(config => ((config || {}).date || {}).code)
    .catch(e => {
      akUtils.log(e, 'getDateFormat');
    });
};

module.exports = new configurationService();
