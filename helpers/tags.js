/* jshint esversion: 6 */

const tagModel = require('../models/tags');
const bluebirdPromise = require('bluebird');
const mongoose = require('mongoose');
const commonHelper = require('./common');
const akUtils = require('../lib/utility');
const jsTypeChecker = require('javascript-type-checker');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');

const validator = require('../lib/validatorAsync');

const tagHelper = function tagHelper() {};

/**
 * Set client of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
tagHelper.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

/**
 * Performs response from DB operations to return as API response.
 * 
 * @param {Object} data Database operation result.
 * @param {Boolean} isDropdown Whether the APi is requesting a dropdown.
 * @return {Promise} formattedResponse Formatted Response
 * 
 */
tagHelper.prototype.formatResponse = function(data, isDropdown = false) {
  const formattedResponse = {};
  if (!isDropdown) {
    formattedResponse.id = data._id;
    formattedResponse.name = data.name;
    formattedResponse.sysDefined = data.sysDefined;
    formattedResponse.status = data.status;
    formattedResponse.updatedBy = `${((data || {}).updatedBy || '').firstName} ${((data || {})
      .updatedBy || ''
    ).lastName}`;
    formattedResponse.updatedOn = data.updatedOn;
    formattedResponse.client = data.client;
    // console.log(formattedResponse);
    return formattedResponse;
  }
  formattedResponse.id = data._id;
  formattedResponse.name = data.name;
  return formattedResponse;
};

/**
 * Performs save-specific validations before performing common validations.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
tagHelper.prototype.validateRequest = function(event) {
  return this.commonValidations(event)
    .then(() => {})
    .catch(errors => {
      if (!jsTypeChecker.isEmptyObject(errors)) {
        return bluebirdPromise.reject(
          akUtils.getObjectValues(akUtils.sortErrorsObject(errors, 'tags'))
        );
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
tagHelper.prototype.validateUpdate = function(event) {
  let basicErrors;
  return this.commonValidations(event)
    .catch(errors => errors)
    .then(errorsIfAny => {
      basicErrors = errorsIfAny || {};
      return bluebirdPromise.all([
        bluebirdPromise.all([
          validator.elementExists('tags', event.pathParameters.id),
          validator.notSysDefined('tags', event.pathParameters.id),
          validator.deactivationCheck('tags', event.body.status, event.pathParameters.id)
        ])
      ]);
    })
    .then(result => {
      const mapping = {
        global: { index: 0, fieldName: 'Tag' }
      };
      const validationResult = akUtils.mapAndGetValidationErrors(result, mapping);
      const combinedErrors = Object.assign({}, basicErrors, validationResult);
      if (!jsTypeChecker.isEmptyObject(combinedErrors)) {
        return bluebirdPromise.reject(
          akUtils.getObjectValues(akUtils.sortErrorsObject(combinedErrors, 'tags'))
        );
      }
      return bluebirdPromise.resolve();
    })
    .catch(errors => bluebirdPromise.reject(errors));
};

/**
 * Fetch a particular tag by providing its name
 * 
 * @param {String} name name of the tag to Fetch
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
tagHelper.prototype.getByName = function(name = '') {
  let conditions = { name };
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return tagModel.findOne(conditions).then(result => {
    if (result) {
      return bluebirdPromise.resolve(this.formatResponse(result));
    }
    return bluebirdPromise.reject();
  });
};

/**
 * Query the database to fetch collections on the basis of search parameters and other parameters
 * 
 * @param {Object} searchParams search filters
 * @param {Object} otherParams pagination, sorting etc other params.
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
tagHelper.prototype.get = function(searchParams, otherParams) {
  return tagModel
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
        for (const i in result) {
          if (result.hasOwnProperty(i)) {
            list.push(this.formatResponse(result[i], otherParams.isDropdown));
          }
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
 * Fetch a particular tag by providing its ID
 * 
 * @param {String} tagId ID of the product to Fetch
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
tagHelper.prototype.getById = function(tagId) {
  if (!mongoose.Types.ObjectId.isValid(tagId)) {
    return bluebirdPromise.reject();
  }
  let conditions = { _id: mongoose.Types.ObjectId(tagId) };
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return tagModel
    .findOne(conditions)
    .exec()
    .then(result => {
      if (result) {
        return bluebirdPromise.resolve(this.formatResponse(result));
      }
      return bluebirdPromise.reject();
    });
};

/**
 * Save a tag
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of save operation.
 * 
 */
tagHelper.prototype.save = function(event) {
  const tagObj = new tagModel();
  tagObj.name = event.body.name;
  tagObj.sysDefined = 0;
  tagObj.status = event.body.status;
  tagObj.updatedOn = Date.now();
  tagObj.updatedBy = currentUserHandler.getCurrentUser();
  tagObj.client = clientHandler.getClient();
  return tagObj.save();
};

/**
 * Update a tag
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of update operation.
 * 
 */
tagHelper.prototype.update = function(event) {
  let conditions = { _id: event.pathParameters.id };
  conditions = clientHandler.addClientFilterToConditions(conditions);
  const tagUpdateObj = {};
  tagUpdateObj.name = event.body.name;
  tagUpdateObj.status = event.body.status;
  tagUpdateObj.client = clientHandler.getClient();
  tagUpdateObj.updatedOn = Date.now();
  tagUpdateObj.updatedBy = currentUserHandler.getCurrentUser();
  tagUpdateObj.sysDefined = 0; // event.body.sysDefined;
  const updateParams = {
    $set: tagUpdateObj,
    $inc: { __v: 1 }
  };
  return tagModel
    .findOneAndUpdate(conditions, updateParams, {
      upsert: false,
      new: true
    })
    .exec();
};

/**
 * Count products on the basis of some search conditions.
 * 
 * @param {Object} searchParams Search Conditions
 * @return {Promise<Number>} Number of matching products.
 * 
 */
tagHelper.prototype.count = function(searchParams = {}) {
  return tagModel.count(searchParams).exec();
};

/**
 * Generate the search conditions for the GET operation.
 * 
 * @param {Object} event Lambda Event
 * @return {Object} filters.
 * 
 */
tagHelper.prototype.getFilterParams = function(event) {
  let filters = {};
  filters = clientHandler.addClientFilterToConditions(filters);
  if (event.queryStringParameters.filter) {
    filters.$or = [
      { name: new RegExp(event.queryStringParameters.filter, 'i') },
      { code: new RegExp(event.queryStringParameters.filter, 'i') }
    ];
  }
  if (event.queryStringParameters.id) {
    filters._id = event.queryStringParameters.id;
  }
  if (event.queryStringParameters.name) {
    filters.name = new RegExp(event.queryStringParameters.name, 'i');
  }
  if (event.queryStringParameters.status === '1' || event.queryStringParameters.status === '0') {
    filters.status = parseInt(event.queryStringParameters.status, 10);
  }

  if (event.queryStringParameters.updatedOnFrom || event.queryStringParameters.updatedOnTo) {
    filters.updatedOn = {};
  }

  if (event.queryStringParameters.updatedOnFrom) {
    filters.updatedOn.$gte = new Date(event.queryStringParameters.updatedOnFrom);
  }

  if (event.queryStringParameters.updatedOnTo) {
    filters.updatedOn.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.updatedOnTo)
    );
  }

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
tagHelper.prototype.getExtraParams = function(event) {
  const dd = event.queryStringParameters.dd === '1';
  const offset = event.queryStringParameters.offset ? event.queryStringParameters.offset : 0;
  const limit = event.queryStringParameters.limit
    ? event.queryStringParameters.limit
    : process.env.defaultRecordsPerPage;

  const params = {};
  params.sort = {};

  params.isDropdown = dd;
  params.pageParams = {
    offset: dd ? 0 : parseInt(offset, 10),
    limit: dd ? 0 : parseInt(limit, 10)
  };

  if (event.queryStringParameters.sort) {
    const sortQuery = event.queryStringParameters.sort;
    const sortColumns = sortQuery.split(',');
    sortColumns.forEach(function(col) {
      col = col.trim();
      let sortOrder;
      const isValidColumn = this.getColumnMap(col) || this.getColumnMap(col.replace('-', ''));
      if (isValidColumn) {
        if (col.startsWith('-')) {
          sortOrder = -1;
          col = col.replace('-', '');
        } else {
          sortOrder = 1;
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
 * Map keys for sorting.
 * 
 * @param {String} key
 * @return {String} 
 * 
 */
tagHelper.prototype.getColumnMap = function(key) {
  const map = {
    id: '_id'
  };
  if (key) {
    if (map[key]) {
      return map[key] || key;
    }
    return key;
  }
  return map;
};

/**
 * Performs common validations in both update and save.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
tagHelper.prototype.commonValidations = function(event) {
  return bluebirdPromise
    .all([
      bluebirdPromise.all([
        validator.required(event.body.name),
        validator.stringLength(0, validator.NAME_MAX_LENGTH, event.body.name),
        validator.notDuplicate('tags', 'name', event.body.name, event.pathParameters.id)
      ]),
      bluebirdPromise.all([validator.valueAllowed([0, 1], event.body.status)])
    ])
    .then(result => {
      const validatorErrorsMap = {
        name: { index: 0, fieldName: 'Name' },
        status: { index: 1, fieldName: 'Status' }
      };
      const errors = akUtils.mapAndGetValidationErrors(result, validatorErrorsMap);
      if (errors) {
        return bluebirdPromise.reject(errors);
      }
      return bluebirdPromise.resolve();
    });
};

/**
 * Checks if a give name already exists in the database.
 * 
 * @param {String} name Name to check
 * @param {String} excludedObjId Object ID of current object if checking while update.
 * @return {Promise} Resolved promise if duplicate name. Rejected promise otherwise
 * 
 */
tagHelper.prototype.isDuplicateName = function(name = '', excludedObjId = null) {
  let conditions;
  if (excludedObjId !== null && mongoose.Types.ObjectId.isValid(excludedObjId)) {
    conditions = { name, _id: { $ne: mongoose.Types.ObjectId(excludedObjId) } };
  } else {
    conditions = { name };
  }
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return tagModel
    .findOne(conditions)
    .exec()
    .then(result => {
      if (result) {
        return bluebirdPromise.resolve();
      }
      return bluebirdPromise.reject(result);
    });
};

tagHelper.prototype.getForPopulation = function(nameList) {
  let populatedList = [];
  let conditions = { name: { $in: nameList }, status: 1, sysDefined: 0 };
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return tagModel
    .find(conditions)
    .exec()
    .then(result => {
      populatedList = [...result, ...populatedList];
      return akUtils.getArrayDifference(nameList, populatedList.map(x => x.name));
    })
    .then(pendingNames => {
      const events = pendingNames.map(pendingName => ({
        headers: {},
        body: {
          name: pendingName,
          status: 1,
          sysDefined: 0
        }
      }));
      return bluebirdPromise.map(events, event => this.save(event));
    })
    .then(savedTags => {
      populatedList = [...savedTags, ...populatedList];
      populatedList = populatedList.map(tag => ({
        id: tag._id,
        name: tag.name
      }));

      populatedList.sort((a, b) => nameList.indexOf(a.name) - nameList.indexOf(b.name));
      return populatedList;
    });
};

tagHelper.prototype.validatePopulatable = function(nameList) {
  return bluebirdPromise.resolve(true);
};

tagHelper.prototype.isDuplicate = function(field, value = '', excludedObjId = null) {
  let conditions = {};
  conditions[field] = value;
  if (excludedObjId !== null && mongoose.Types.ObjectId.isValid(excludedObjId)) {
    conditions._id = { $ne: mongoose.Types.ObjectId(excludedObjId) };
  }
  conditions = clientHandler.addClientFilterToConditions(conditions);

  return tagModel
    .findOne(conditions)
    .exec()
    .then(result => {
      if (result) {
        return bluebirdPromise.resolve();
      }
      return bluebirdPromise.reject();
    });
};
module.exports = new tagHelper();
