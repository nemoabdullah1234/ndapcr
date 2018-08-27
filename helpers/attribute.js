const attributemodel = require('../models/attribute');
const tagHelper = require('../helpers/tags');
const validator = require('../lib/validatorAsync');
const akUtils = require('../lib/utility');
const jsTypeChecker = require('javascript-type-checker');
const mongoose = require('mongoose');
const bluebirdPromise = require('bluebird');
const commonHelper = require('./common');
const currentUserHandler = require('../lib/currentUserHandler');
const clientHandler = require('../lib/clientHandler');

const attributeDependent = {
  things: 'attributes.id',
  'product.1': 'trackingDetails.currentLocation.address.id',
  'product.2': 'attributes.id',
  kollection: 'items.id',
  location: 'attributes.id'
};

// const search = require('../services/search');

const attributeService = function() {};

/**
 * Set client of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
attributeService.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

/**
 * Set headers of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
attributeService.prototype.setHeaders = function(headers) {
  this.headers = headers;
};

/**
 * Set headers of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
attributeService.prototype.setConfigs = function() {
  // console.log('config');
  return require('./configuration')
    .getConfigurations()
    .then(configs => {
      this.configs = configs;
    });
};
/**
 * Query the database to fetch attributes on the basis of search parameters and other parameters
 * 
 * @param {Object} searchParams search filters
 * @param {Object} otherParams pagination, sorting etc other params.
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
attributeService.prototype.get = function(searchParams, otherParams) {
  return attributemodel
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
 * Fetch a particular attribute by providing its ID
 * 
 * @param {String} attributeId ID of the attribute to Fetch
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
attributeService.prototype.getById = function(attributeId = 'default') {
  if (!mongoose.Types.ObjectId.isValid(attributeId)) {
    return bluebirdPromise.reject();
  }
  // if (!forSearch) {
  //   return search.searchById('attributes', attributeId + '');
  // } else {
  let conditions = {
    _id: mongoose.Types.ObjectId(attributeId)
  };
  conditions = clientHandler.addClientFilterToConditions(conditions);

  return attributemodel
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
 * Fetch a particular attribute by providing its Code
 * 
 * @param {String} code Code of the attribute to Fetch
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
attributeService.prototype.getByCode = function(code = '') {
  let conditions = {
    code
  };
  conditions = clientHandler.addClientFilterToConditions(conditions);

  return attributemodel
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
 * Count attributes on the basis of some search conditions.
 * 
 * @param {Object} searchParams Search Conditions
 * @return {Promise<Number>} Number of matching attributes.
 * 
 */
attributeService.prototype.count = function(searchParams = {}) {
  return attributemodel.count(searchParams).exec();
};

/**
 * Performs response from DB operations to return as API response.
 * 
 * @param {Object} data Database operation result.
 * @param {Boolean} isDropdown Whether the APi is requesting a dropdown.
 * @return {Promise} formattedResponse Formatted Response
 * 
 */
attributeService.prototype.formatResponse = function(data, isDropdown = false) {
  const formattedResponse = {};
  if (!isDropdown) {
    formattedResponse.id = data._id;
    formattedResponse.code = data.code;
    formattedResponse.name = data.name;
    formattedResponse.sysDefined = data.sysDefined;
    formattedResponse.status = data.status;
    formattedResponse.updatedOn = data.updatedOn;
    formattedResponse.updatedBy = `${((data || {}).updatedBy || '').firstName} ${((data || {})
      .updatedBy || ''
    ).lastName}`;
    formattedResponse.client = data.client;
    formattedResponse.tags = data.tags;
    // commonHelper.formatDate(data.updatedOn, this.headers, 'dt')
    // .then((date) => {
    //   formattedResponse.updatedOn = date;
    return formattedResponse;
    // });
  }
  formattedResponse.id = data._id;
  formattedResponse.name = data.name;
  return formattedResponse;
};

/**
 * Map keys for sorting.
 * 
 * @param {String} key
 * @return {String} 
 * 
 */
attributeService.prototype.getColumnMap = function getColumnMap(key) {
  const map = {
    id: '_id',
    code: 'code',
    name: 'name',
    sysDefined: 'sysDefined',
    updatedOn: 'updatedOn',
    updatedBy: 'updatedBy'
  };

  if (key) {
    return map[key] || key;
  }
  return map;
};

/**
 * Generate the search conditions for the GET operation.
 * 
 * @param {Object} event Lambda Event
 * @return {Object} filters.
 * 
 */
attributeService.prototype.getFilterParams = function(event) {
  let filters = {};
  filters = clientHandler.addClientFilterToConditions(filters);
  if (event.queryStringParameters && event.queryStringParameters.filter) {
    // filters._all = event.queryStringParameters.filter;
    filters.$or = [
      {
        name: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        code: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'updatedBy.firstName': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'updatedBy.lastName': new RegExp(event.queryStringParameters.filter, 'i')
      }
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

  if (event.queryStringParameters.status) {
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
attributeService.prototype.getExtraParams = function(event) {
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
attributeService.prototype.commonValidations = function(event) {
  return bluebirdPromise
    .all([
      bluebirdPromise.all([
        validator.required(event.body.code),
        validator.stringLength(0, validator.CODE_MAX_LENGTH, event.body.code),
        validator.notDuplicate('attributes', 'code', event.body.code, event.pathParameters.id)
      ]),
      bluebirdPromise.all([
        validator.required(event.body.name),
        validator.stringLength(0, validator.NAME_MAX_LENGTH, event.body.name)
      ]),
      bluebirdPromise.all([validator.valueAllowed([0, 1], event.body.status)]),
      bluebirdPromise.all([
        validator.type('array', event.body.tags),
        validator.duplicateArrayElements(null, event.body.tags),
        validator.validatePopulatableLists('tags', event.body.tags),
        validator.arrayOfType('string', event.body.tags)
      ])
    ])
    .then(result => {
      const validatorErrorsMap = {
        code: {
          index: 0,
          fieldName: 'Code'
        },
        name: {
          index: 1,
          fieldName: 'Name'
        },
        status: {
          index: 2,
          fieldName: 'Status'
        },
        tags: {
          index: 3,
          fieldName: 'Tags'
        }
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
attributeService.prototype.validateUpdate = function(event) {
  let basicErrors;
  return this.commonValidations(event)
    .catch(errors => errors)
    .then(errorsIfAny => {
      basicErrors = errorsIfAny || {};
      return bluebirdPromise.all([
        bluebirdPromise.all([
          validator.elementExists('attributes', event.pathParameters.id),
          validator.notSysDefined('attributes', event.pathParameters.id),
          validator.deactivationCheck('attributes', event.body.status, event.pathParameters.id)
        ]),
        bluebirdPromise.all([
          validator.checkSame('attributes', 'code', event.body.code, event.pathParameters.id)
        ])
      ]);
    })
    .then(result => {
      const mapping = {
        global: {
          index: 0,
          fieldName: 'Attribute'
        },
        code: {
          index: 1,
          fieldName: 'Code'
        }
      };
      const validationResult = akUtils.mapAndGetValidationErrors(result, mapping);
      const combinedErrors = Object.assign({}, basicErrors, validationResult);
      if (!jsTypeChecker.isEmptyObject(combinedErrors)) {
        return bluebirdPromise.reject(
          akUtils.getObjectValues(akUtils.sortErrorsObject(combinedErrors, 'attributes'))
        );
      }
      return bluebirdPromise.resolve();
    })
    .catch(errors => bluebirdPromise.reject(errors));
};

/**
 * Checks if a give code already exists in the database.
 * 
 * @param {String} code Code to check
 * @param {String} excludedObjId Object ID of current object if checking while update.
 * @return {Promise} Resolved promise if duplicate code. Rejected promise otherwise
 * 
 */
attributeService.prototype.isDuplicateCode = function(code = '', excludedObjId = null) {
  let conditions;
  if (excludedObjId !== null && mongoose.Types.ObjectId.isValid(excludedObjId)) {
    conditions = {
      code,
      _id: {
        $ne: mongoose.Types.ObjectId(excludedObjId)
      }
    };
  } else {
    conditions = {
      code
    };
  }
  conditions = clientHandler.addClientFilterToConditions(conditions);

  return attributemodel
    .findOne(conditions)
    .exec()
    .then(result => {
      if (result) {
        return bluebirdPromise.resolve();
      }
      return bluebirdPromise.reject();
    });
};

attributeService.prototype.isDuplicate = function(field, value = '', excludedObjId = null) {
  let conditions = {};
  conditions[field] = value;
  if (excludedObjId !== null && mongoose.Types.ObjectId.isValid(excludedObjId)) {
    conditions._id = {
      $ne: mongoose.Types.ObjectId(excludedObjId)
    };
  }
  conditions = clientHandler.addClientFilterToConditions(conditions);

  return attributemodel
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
attributeService.prototype.validateRequest = function(event) {
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
 * Save an attribute
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of save operation.
 * 
 */
attributeService.prototype.save = function save(event) {
  return bluebirdPromise.all([tagHelper.getForPopulation(event.body.tags)]).then(populatedData => {
    const attributeObj = new attributemodel(); // create a new instance of the  model
    attributeObj.code = event.body.code;
    attributeObj.name = event.body.name;
    attributeObj.sysDefined = 0;
    attributeObj.status = event.body.status;
    attributeObj.updatedOn = Date.now();
    attributeObj.updatedBy = currentUserHandler.getCurrentUser();
    attributeObj.client = clientHandler.getClient();
    attributeObj.tags = populatedData[0];
    return attributeObj.save();
  });
};

/**
 * Update an attribute
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of update operation.
 * 
 */
attributeService.prototype.update = function(event) {
  return bluebirdPromise.all([tagHelper.getForPopulation(event.body.tags)]).then(populatedData => {
    let conditions = {
      _id: event.pathParameters.id
    };
    conditions = clientHandler.addClientFilterToConditions(conditions);
    const attributeUpdateObj = {};
    attributeUpdateObj.code = event.body.code;
    attributeUpdateObj.name = event.body.name;
    attributeUpdateObj.status = event.body.status;
    attributeUpdateObj.client = clientHandler.getClient();
    attributeUpdateObj.tags = populatedData[0];
    attributeUpdateObj.updatedOn = Date.now();
    attributeUpdateObj.updatedBy = currentUserHandler.getCurrentUser();
    attributeUpdateObj.sysDefined = 0; // event.body.sysDefined;

    const updateParams = {
      $set: attributeUpdateObj,
      $inc: {
        __v: 1
      }
    };

    return attributemodel
      .findOneAndUpdate(conditions, updateParams, {
        upsert: false,
        new: true
      })
      .exec();
  });
};

attributeService.prototype.getForPopulation = function(idValuePair, allowSysDefined = false) {
  idValuePair = idValuePair || [];
  const idValueMap = {};
  for (let i = 0; i < idValuePair.length; i++) {
    idValueMap[idValuePair[i].id] = idValuePair[i].value;
  }
  const idList = idValuePair.map(pair => mongoose.Types.ObjectId(pair.id));
  let conditions = {
    _id: {
      $in: idList
    },
    status: 1,
    sysDefined: 0
  };
  if (allowSysDefined) {
    conditions.sysDefined = 1;
  }
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return attributemodel
    .find(conditions)
    .exec()
    .then(result =>
      result.sort((a, b) => idList.indexOf(a._id) - idList.indexOf(b._id)).map(result => ({
        id: result._id,
        name: result.name,
        status: result.status,
        sysDefined: result.sysDefined,
        value: idValueMap[String(result._id)] || ''
      }))
    );
};

attributeService.prototype.validatePopulatable = function(idList) {
  const isPopulatable = idList.reduce(
    (isValid, id) => isValid && mongoose.Types.ObjectId.isValid(id),
    true
  );
  if (!isPopulatable) {
    return bluebirdPromise.resolve(false);
  }
  idList = idList.map(id => mongoose.Types.ObjectId(id));

  let conditions = {
    _id: {
      $in: idList
    },
    status: 1,
    sysDefined: 0
  };
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return attributemodel
    .count(conditions)
    .exec()
    .then(count => {
      if (count === idList.length) {
        return bluebirdPromise.resolve(true);
      }
      return bluebirdPromise.resolve(false);
    });
};

attributeService.prototype.validateInactive = function(attributeid = '') {
  const modelpath = '../models/';

  const keys = Object.keys(attributeDependent);
  // console.log(keys);
  return bluebirdPromise
    .map(keys, key => {
      // console.log(`in 1${key}`);
      const model = require(modelpath + key.split('.')[0]);
      const condition = attributeDependent[key];
      const dict = {};
      dict[condition] = attributeid;
      // console.log(JSON.stringify(dict));
      return model.findOne(dict).exec();
    })
    .then(result => {
      // console.log(result.length);
      for (let i = 0; i < result.length; i++) {
        if (result[i] === null) {
          result.splice(i, 1);
          i--;
        }
      }
      // console.log(result);
      if (result.length > 0) {
        return bluebirdPromise.resolve(true);
      }
      return bluebirdPromise.resolve(false);
    });
};

module.exports = new attributeService();
