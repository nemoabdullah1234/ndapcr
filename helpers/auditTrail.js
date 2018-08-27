/* jshint esversion: 6 */

const auditTrailModel = require('../models/auditTrail');
const mongoose = require('mongoose');
const bluebirdPromise = require('bluebird');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');

const auditTrailService = function() {};

const actionTypeMap = {
  save: 'Create',
  findOneAndUpdate: 'Update',
  update: 'Update'
};

auditTrailService.prototype.auditTrail = function(schema, { model }) {
  schema.post('findOneAndUpdate', (result, next) => {
    const auditObject = new auditTrailModel();
    auditObject.model = model;
    auditObject.actionType = 'findOneAndUpdate';
    auditObject.object = result;
    auditObject.actionBy = currentUserHandler.getCurrentUser();
    auditObject.client = clientHandler.getClient();
    auditObject.save().then(() => {
      next();
    });
  });
  schema.post('save', (result, next) => {
    const auditObject = new auditTrailModel();
    auditObject.model = model;
    auditObject.actionType = 'save';
    auditObject.object = result;
    auditObject.actionBy = currentUserHandler.getCurrentUser();
    auditObject.client = clientHandler.getClient();
    auditObject.save().then(() => {
      next();
    });
  });
  schema.post('update', (result, next) => {
    const auditObject = new auditTrailModel();
    auditObject.model = model;
    auditObject.actionType = 'update';
    auditObject.object = result.result;
    auditObject.actionBy = currentUserHandler.getCurrentUser();
    auditObject.client = clientHandler.getClient();
    auditObject.save().then(() => {
      next();
    });
  });
};

/**
 * Set client of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
auditTrailService.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};
/**
 * Query the database to fetch auditTrails on the basis of search parameters and other parameters
 * 
 * @param {Object} searchParams search filters
 * @param {Object} otherParams pagination, sorting etc other params.
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */

auditTrailService.prototype.get = function(searchParams, otherParams) {
  return auditTrailModel
    .find(searchParams)
    .sort(otherParams.sort)
    .skip(otherParams.pageParams.offset)
    .limit(otherParams.pageParams.limit)
    .collation({
      locale: 'en_US',
      caseLevel: false
    })
    .exec()
    .then(result => {
      const list = [];
      if (result) {
        for (let i = 0; i < result.length; i++) {
          list.push(this.formatResponse(result[i], otherParams.isDropdown));
        }
      }
      return list;
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

/**
 * Fetch a particular auditTrail by providing its ID
 * 
 * @param {String} auditTrailId ID of the auditTrail to Fetch
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
auditTrailService.prototype.getById = function(auditTrailId = 'default') {
  if (!mongoose.Types.ObjectId.isValid(auditTrailId)) {
    return bluebirdPromise.reject();
  }
  // if (!forSearch) {
  //   return search.searchById('auditTrails', auditTrailId + '');
  // } else {
  let conditions = { _id: mongoose.Types.ObjectId(auditTrailId) };
  conditions = clientHandler.addClientFilterToConditions(conditions);

  return auditTrailModel
    .find(conditions)
    .exec()
    .then(result => {
      if (result.length > 0) {
        return bluebirdPromise.resolve(this.formatResponse(result[0]));
      }
      return bluebirdPromise.reject();
    });
  // }
};

/**
 * Fetch a particular auditTrail by providing its Code
 * 
 * @param {String} code Code of the auditTrail to Fetch
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
auditTrailService.prototype.getByCode = function(code = '') {
  let conditions = { code };
  conditions = clientHandler.addClientFilterToConditions(conditions);

  return auditTrailModel
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
 * Count auditTrails on the basis of some search conditions.
 * 
 * @param {Object} searchParams Search Conditions
 * @return {Promise<Number>} Number of matching auditTrails.
 * 
 */
auditTrailService.prototype.count = function(searchParams = {}) {
  return auditTrailModel.count(searchParams).exec();
};

/**
 * Performs response from DB operations to return as API response.
 * 
 * @param {Object} data Database operation result.
 * @param {Boolean} isDropdown Whether the APi is requesting a dropdown.
 * @return {Promise} formattedResponse Formatted Response
 * 
 */
auditTrailService.prototype.formatResponse = function(data, isDropdown = false) {
  const formattedResponse = {};
  if (!isDropdown) {
    formattedResponse.id = data._id;
    formattedResponse.model = data.model.replace(
      /\w\S*/g,
      txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
    formattedResponse.actionType = actionTypeMap[data.actionType];
    formattedResponse.object = data.object;
    formattedResponse.updatedOn = data.updatedOn;
    formattedResponse.actionBy = `${((data || {}).actionBy || '').firstName} ${((data || {})
      .actionBy || ''
    ).lastName}`;
    formattedResponse.actionTime = data.actionTime;
    formattedResponse.client = data.client;
    return formattedResponse;
  }
  formattedResponse.id = data._id;
  formattedResponse.name = data.name;
  return formattedResponse;
};

/**
 * Generate the search conditions for the GET operation.
 * 
 * @param {Object} event Lambda Event
 * @return {Object} filters.
 * 
 */
auditTrailService.prototype.getFilterParams = function(event) {
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
auditTrailService.prototype.getExtraParams = function(event) {
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
    params.sort.actionTime = -1;
  }

  return params;
};

auditTrailService.prototype.getColumnMap = function getColumnMap(key) {
  const map = {
    id: '_id',
    actionType: 'actionType',
    model: 'model',
    actionTime: 'actionTime'
  };

  if (key) {
    return map[key] || key;
  }
  return map;
};
module.exports = new auditTrailService();
