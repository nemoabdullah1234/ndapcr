/* jshint esversion: 6 */

const gatewayModel = require('../models/things');
const commonHelper = require('./common');
const mongoose = require('mongoose');
const bluebirdPromise = require('bluebird');

const gatewayService = function gatewayService() {};
const validatorLib = require('../lib/validator');
const tagHelper = require('../helpers/tags');
const categoryHelper = require('../helpers/category');
const attributeHelper = require('../helpers/attribute');
const validator = require('../lib/validatorAsync');
const akUtils = require('../lib/utility');
const jsTypeChecker = require('javascript-type-checker');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');

const validations = {
  uuid: [
    {
      function: validatorLib.required,
      params: [],
      fieldName: 'UUID'
    }
  ]
};
const typemap = {};

/**
 * Initiate request validation using lambda event
 * 
 * @param {any} event 
 * @returns 
 */
gatewayService.prototype.validateRequest = function(event) {
  return this.commonValidations(event)
    .then(() => {})
    .catch(errors => {
      if (!jsTypeChecker.isEmptyObject(errors)) {
        return bluebirdPromise.reject(
          akUtils.getObjectValues(akUtils.sortErrorsObject(errors, 'gateways'))
        );
      }
      return bluebirdPromise.resolve();
    });
};

/**
 * Set client of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
gatewayService.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

/**
 * Save a gateway
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of save operation.
 * 
 */
gatewayService.prototype.save = function(event) {
  return bluebirdPromise
    .all([
      tagHelper.getForPopulation(event.body.tags),
      categoryHelper.getForPopulation(event.body.categories),
      attributeHelper.getForPopulation(event.body.attributes),
      commonHelper.populateSystemAttributes('gateway_system_attributes', event)
    ])
    .then(populations => {
      const gatewayObj = new gatewayModel(); // create a new instance of the  model
      gatewayObj.code = event.body.code;
      gatewayObj.name = event.body.name;
      gatewayObj.status = event.body.status;
      gatewayObj.updatedOn = Date.now();
      gatewayObj.updatedBy = currentUserHandler.getCurrentUser();
      gatewayObj.client = clientHandler.getClient();
      gatewayObj.tags = populations[0];
      gatewayObj.attributes = [...populations[2], ...populations[3]];
      gatewayObj.categories = populations[1];
      gatewayObj.type = 'gateway';
      return gatewayObj.save();
    });
};

/**
 * Fetch a particular gateway by providing its ID
 * 
 * @param {String} gatewayID ID of the gateway to Fetch
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
gatewayService.prototype.getById = function(gatewayID = 'Default') {
  let conditions = {
    _id: mongoose.Types.ObjectId(gatewayID)
  };
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return gatewayModel
    .findOne({
      _id: mongoose.Types.ObjectId(gatewayID)
    })
    .exec()
    .then(result => {
      if (result) {
        return bluebirdPromise.resolve(this.formatResponse(result));
      }
      return bluebirdPromise.reject();
    });
};
/**
 * Common validations for save and update request
 * 
 * @param {any} event 
 * @returns {Promise<event>} returns promise with event or rejection with error
 */
gatewayService.prototype.commonValidations = function(event) {
  return bluebirdPromise
    .all([
      bluebirdPromise.all([
        validator.required(event.body.code),
        validator.stringLength(0, validator.CODE_MAX_LENGTH, event.body.code),
        validator.notDuplicate('gateways', 'code', event.body.code, event.pathParameters.id)
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
      ]),
      bluebirdPromise.all([
        validator.type('array', event.body.categories),
        validator.duplicateArrayElements(null, event.body.categories),
        validator.validatePopulatableLists('categories', event.body.categories),
        validator.arrayOfType('string', event.body.categories)
      ]),
      bluebirdPromise.all([
        validator.type('array', event.body.attributes),
        validator.arrayOfType('object', event.body.attributes),
        validator.validatePopulatableLists('attributes', event.body.attributes),
        validator.duplicateArrayElements('id', event.body.attributes)
      ]),
      bluebirdPromise.all([
        validator.required(event.body.uuid),
        validator.type('string', event.body.uuid)
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
        },
        categories: {
          index: 4,
          fieldName: 'Categories'
        },
        attributes: {
          index: 5,
          fieldName: 'Attributes'
        },
        uuid: {
          index: 6,
          fieldName: 'UUID'
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
 * Basic Validation for code and name 
 * 
 * @param {any} event 
 * @returns 
 */
gatewayService.prototype.validateBasics = function(event) {
  let errors = [];
  if (!event.body.code) {
    errors.push({
      code: 2001,
      message: 'Code is mandatory'
    });
  } else if (event.body.code.length > 25) {
    errors.push({
      errorCode: 2901,
      message: 'Code cannot be more than 25 characters'
    });
  }
  if (!event.body.name) {
    errors.push({
      code: 2002,
      message: 'Name is mandatory'
    });
  } else if (event.body.name.length > 50) {
    errors.push({
      errorCode: 2901,
      message: 'Name cannot be more than 50 characters'
    });
  }
  if (event.body.status !== 0 && event.body.status !== 1) {
    errors.push({
      code: 2003,
      message: 'Invalid Status'
    });
  }
  errors = errors.concat(commonHelper.validateTags(event.body.tags));
  errors = errors.concat(commonHelper.validateAttributes(event.body.attributes));
  errors = errors.concat(commonHelper.validateCategories(event.body.categories));
  return bluebirdPromise
    .resolve()
    .then(() => {
      if (!event.body.code) {
        return bluebirdPromise.reject();
      }
      return this.isDuplicateCode(event.body.code, event.pathParameters.id);
    })
    .then(() => {
      errors.push({
        code: 2005,
        message: 'Code already exists'
      });
    })
    .catch(() => {})
    .then(() => {
      if (errors.length !== 0) {
        return bluebirdPromise.reject(errors);
      }
      return bluebirdPromise.resolve();
    });
};
/**
 * Validate and populate data for insertion or updation in database
 * 
 * @param {Object} event 
 * @returns 
 */
gatewayService.prototype.validateAndPopulateIds = function(event) {
  const commonHelper = require('./common');
  let errors = [];
  let tagNameList = [];
  let categoryIdList = [];
  let attributesList = [];
  if (event.body.tags !== undefined && event.body.tags !== null) {
    tagNameList = commonHelper.deepCloneObject(event.body.tags);
  }
  if (event.body.categories !== undefined && event.body.categories !== null) {
    categoryIdList = commonHelper.deepCloneObject(event.body.categories);
  }
  if (event.body.attributes !== undefined && event.body.attributes !== null) {
    attributesList = commonHelper.deepCloneObject(event.body.attributes);
  }
  event.body.tags = [];
  event.body.categories = [];
  event.body.attributes = [];

  return commonHelper
    .getAttributeListFromIds(attributesList)
    .then(list => {
      event.body.attributes = list;
    })
    .catch(() => {
      errors.push({
        code: 2101,
        message: 'Invalid Attribute'
      });
    })
    .then(() =>
      commonHelper.getTagListFromNames(tagNameList, event).then(list => {
        event.body.tags = list;
      })
    )
    .then(() =>
      commonHelper.getCategoryListFromIds(categoryIdList, event).then(list => {
        event.body.categories = list;
      })
    )
    .then(() =>
      commonHelper.validateAndGetSystemAttributes('gateway_system_attributes', event, validations)
    )
    .then(list => {
      event.body.attributes = event.body.attributes.concat(list);
    })
    .catch(errorList => {
      errors = errors.concat(errorList);
    })
    .then(() => {
      if (errors.length !== 0) {
        return bluebirdPromise.reject(errors);
      }
      return bluebirdPromise.resolve(event);
    });
};
/**
 * Check for duplicate code
 * 
 * @param {string} [code=''] 
 * @param {any} [excludedObjId=null] 
 * @returns 
 */
gatewayService.prototype.isDuplicateCode = function(code = '', excludedObjId = null) {
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

  return gatewayModel
    .findOne(conditions)
    .exec()
    .then(result => {
      // console.log(result);

      if (result) {
        return bluebirdPromise.resolve();
      }
      return bluebirdPromise.reject();
    });
};
/**
 * Validation specific to update operation 
 * 
 * @param {any} event lambda event
 * @returns {promise<event>}
 */
gatewayService.prototype.validateUpdate = function(event) {
  let basicErrors;
  return this.commonValidations(event)
    .catch(errors => errors)
    .then(errorsIfAny => {
      basicErrors = errorsIfAny || {};
      return bluebirdPromise.all([
        bluebirdPromise.all([
          validator.elementExists('gateways', event.pathParameters.id),
          validator.deactivationCheck('things', event.body.status, event.pathParameters.id)
        ]),
        bluebirdPromise.all([
          validator.checkSame('gateways', 'code', event.body.code, event.pathParameters.id)
        ]),
        bluebirdPromise.all([
          validator.checkSame(
            'gateways',
            'last_connection',
            event.body.last_connection,
            event.pathParameters.id
          )
        ]),
        bluebirdPromise.all([
          validator.checkSame('gateways', 'uuid', event.body.uuid, event.pathParameters.id)
        ])
      ]);
    })
    .then(result => {
      const mapping = {
        global: {
          index: 0,
          fieldName: 'Gateway'
        },
        code: {
          index: 1,
          fieldName: 'Code'
        },
        last_connection: {
          index: 2,
          fieldName: 'lastconnection'
        },
        uuid: {
          index: 3,
          fieldName: 'uuid'
        }
      };
      const validationResult = akUtils.mapAndGetValidationErrors(result, mapping);
      const combinedErrors = Object.assign({}, basicErrors, validationResult);
      if (!jsTypeChecker.isEmptyObject(combinedErrors)) {
        return bluebirdPromise.reject(
          akUtils.getObjectValues(akUtils.sortErrorsObject(combinedErrors, 'gateways'))
        );
      }
      return bluebirdPromise.resolve();
    })
    .catch(errors => bluebirdPromise.reject(errors));
};

/**
 * Update a gateway
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of update operation.
 * 
 */
gatewayService.prototype.update = function(event) {
  return bluebirdPromise
    .all([
      tagHelper.getForPopulation(event.body.tags),
      categoryHelper.getForPopulation(event.body.categories),
      attributeHelper.getForPopulation(event.body.attributes),
      commonHelper.populateSystemAttributes('gateway_system_attributes', event)
    ])
    .then(populations => {
      let conditions = {
        _id: event.pathParameters.id
      };
      conditions = clientHandler.addClientFilterToConditions(conditions);
      const gatewayUpdateObj = {};
      gatewayUpdateObj.code = event.body.code;
      gatewayUpdateObj.name = event.body.name;
      gatewayUpdateObj.status = event.body.status;
      gatewayUpdateObj.updatedOn = Date.now();
      gatewayUpdateObj.updatedBy = currentUserHandler.getCurrentUser();
      gatewayUpdateObj.client = clientHandler.getClient();
      gatewayUpdateObj.tags = populations[0];
      gatewayUpdateObj.attributes = [...populations[2], ...populations[3]];
      gatewayUpdateObj.categories = populations[1];
      gatewayUpdateObj.type = 'gateway';
      const updateParams = {
        $set: gatewayUpdateObj,
        $inc: {
          __v: 1
        }
      };
      // return gatewayModel.findOne(conditions)
      return gatewayModel
        .findOneAndUpdate(conditions, updateParams, {
          upsert: false,
          new: true
        })
        .exec()
        .then(res => {
          if (!res) {
            return bluebirdPromise.reject();
          }
          return bluebirdPromise.resolve(res);
        });
    })
    .then(() => this.getById(event.pathParameters.id));
};
/**
 * Performs response from DB operations to return as API response.
 * 
 * @param {Object} data Database operation result.
 * @param {Boolean} isDropdown Whether the APi is requesting a dropdown.
 * @return {Promise} formattedResponse Formatted Response
 * 
 */
gatewayService.prototype.formatResponse = function(data, isDropdown = false) {
  const formattedResponse = {};
  if (!isDropdown) {
    formattedResponse.id = data._id;
    formattedResponse.code = data.code;
    formattedResponse.name = data.name;
    formattedResponse.status = data.status;
    formattedResponse.updatedOn = data.updatedOn;
    formattedResponse.updatedBy = `${((data || {}).updatedBy || '').firstName} ${((data || {})
      .updatedBy || ''
    ).lastName}`;
    formattedResponse.client = data.client;
    formattedResponse.tags = data.tags;
    formattedResponse.attributes = data.attributes;
    formattedResponse.categories = data.categories;
    formattedResponse.type = data.type;
    return commonHelper.moveSystemAttributesToGlobal(formattedResponse, typemap);
  }
  formattedResponse.id = data._id;
  formattedResponse.name = data.name;
  return formattedResponse;
};
/**
 * Query the database to fetch gateway on the basis of search parameters and other parameters
 * 
 * @param {Object} searchParams search filters
 * @param {Object} otherParams pagination, sorting etc other params.
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
gatewayService.prototype.get = function(filterparams, otherparams) {
  return gatewayModel
    .find(filterparams)
    .sort(otherparams.sort)
    .skip(otherparams.pageParams.offset)
    .limit(otherparams.pageParams.limit)
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
            list.push(this.formatResponse(result[i], otherparams.isDropdown));
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
 * Generate the search conditions for the GET operation.
 * 
 * @param {Object} event Lambda Event
 * @return {Object} filters.
 * 
 */
gatewayService.prototype.getFilterParams = function(event) {
  // get filter params from url
  let filters = {};
  filters = clientHandler.addClientFilterToConditions(filters);
  if (event.queryStringParameters.dd === '1') {
    filters.status = 1;
    filters.$and = [
      {
        $or: [
          {
            product: {}
          },
          {
            product: null
          }
        ]
      },
      {
        $or: [
          {
            location: {}
          },
          {
            location: null
          }
        ]
      }
    ];
  }

  if (event.queryStringParameters.filter) {
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
      },
      {
        attributes: {
          $elemMatch: { name: 'uuid', value: new RegExp(event.queryStringParameters.filter, 'i') }
        }
      }
    ];
  }

  if (event.queryStringParameters.id) {
    filters._id = event.queryStringParameters.id;
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

  if (event.queryStringParameters.uuid) {
    filters.attributes = {};
    filters.attributes.$all = [];

    let idx = 0;
    if (event.queryStringParameters.uuid) {
      filters.attributes.$all[idx] = {
        $elemMatch: { name: 'uuid', value: new RegExp(event.queryStringParameters.uuid, 'i') }
      };
      idx++;
    }
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

  filters.type = 'gateway';
  return filters;
};
/**
 * Generate the extra parameters for the GET operation like sorting, pagination etc.
 * 
 * @param {Object} request Lambda Event
 * @return {Object} extraParams
 * 
 */
gatewayService.prototype.getExtraParams = function(event) {
  const dd = event.queryStringParameters.dd === '1';
  const offset = event.queryStringParameters.offset ? event.queryStringParameters.offset : 0;
  const limit = event.queryStringParameters.limit
    ? event.queryStringParameters.limit
    : process.env.defaultRecordsPerPage; // config['recordsPerPage'];

  const params = {};
  params.sort = {};

  if (event.queryStringParameters.sort) {
    const sortQuery = event.queryStringParameters.sort;
    const sortColumns = sortQuery.split(',');
    let sortOrder;
    sortColumns.forEach(col => {
      col = col.trim();
      if (col.startsWith('-')) {
        sortOrder = -1;
        col = col.replace('-', '');
      } else {
        sortOrder = 1;
      }
      params.sort[col] = sortOrder;
    });
  } else {
    params.sort.updatedOn = -1;
  }
  params.isDropdown = dd;
  params.pageParams = {
    offset: dd ? 0 : parseInt(offset, 10),
    limit: dd ? 0 : parseInt(limit, 10)
  };
  return params;
};
/**
 * Count attributes on the basis of some search conditions.
 * 
 * @param {Object} searchParams Search Conditions
 * @return {Promise<Number>} Number of matching attributes.
 * 
 */
gatewayService.prototype.count = function(searchParams = {}) {
  return gatewayModel.count(searchParams).exec();
};

/**
 * Update or insert gateway during sync operation
 * 
 * @param {any} event 
 * @returns 
 */
gatewayService.prototype.updateorinsert = function(event) {
  let conditions = {
    code: event.body.code
  };
  conditions = clientHandler.addClientFilterToConditions(conditions, event.body.client);
  const gatewayUpdateObj = {};
  gatewayUpdateObj.code = event.body.code;
  gatewayUpdateObj.name = event.body.name;
  gatewayUpdateObj.status = event.body.status;
  gatewayUpdateObj.updatedOn = Date.now();
  gatewayUpdateObj.updatedBy = currentUserHandler.getCurrentUser();
  gatewayUpdateObj.client = event.body.client;
  gatewayUpdateObj.tags = event.body.tags;
  gatewayUpdateObj.attributes = event.body.attributes;
  gatewayUpdateObj.categories = event.body.categories;
  gatewayUpdateObj.type = event.body.type;
  const updateParams = {
    $set: gatewayUpdateObj
    // '$inc' : {'__v': 1}
  };
  // console.log(conditions);
  return gatewayModel
    .findOneAndUpdate(conditions, updateParams, {
      upsert: true,
      new: true
    })
    .exec();
};

gatewayService.prototype.getForPopulation = function(idList) {
  idList = idList || [];
  idList = idList.map(id => mongoose.Types.ObjectId(id));
  let conditions = {
    _id: {
      $in: idList
    },
    status: 1,
    sysDefined: 0
  };
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return gatewayModel
    .find(conditions)
    .exec()
    .then(result =>
      result.sort((a, b) => idList.indexOf(a._id) - idList.indexOf(b._id)).map(result => ({
        id: result._id,
        name: result.name
      }))
    );
};

gatewayService.prototype.validatePopulatable = function(idList, currentId) {
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
    status: 1
  };
  if (currentId) {
    conditions.$and = [
      {
        $or: [
          {
            product: {}
          },
          {
            product: null
          },
          {
            'product.id': mongoose.Types.ObjectId(currentId)
          }
        ]
      },
      {
        $or: [
          {
            location: {}
          },
          {
            location: null
          },
          {
            'location.id': mongoose.Types.ObjectId(currentId)
          }
        ]
      }
    ];
  } else {
    conditions.product = {};
    conditions.location = {};
  }
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return gatewayModel
    .count(conditions)
    .exec()
    .then(count => {
      if (count === idList.length) {
        return bluebirdPromise.resolve(true);
      }
      return bluebirdPromise.resolve(false);
    });
};

gatewayService.prototype.isDuplicate = function(field, value = '', excludedObjId = null) {
  let conditions = {};
  conditions[field] = value;
  if (excludedObjId !== null && mongoose.Types.ObjectId.isValid(excludedObjId)) {
    conditions._id = {
      $ne: mongoose.Types.ObjectId(excludedObjId)
    };
  }
  conditions = clientHandler.addClientFilterToConditions(conditions);

  return gatewayModel
    .findOne(conditions)
    .exec()
    .then(result => {
      if (result) {
        return bluebirdPromise.resolve();
      }
      return bluebirdPromise.reject();
    });
};
gatewayService.prototype.getByCode = function(code = '') {
  return gatewayModel
    .findOne({
      code
    })
    .exec()
    .then(result => {
      // console.log(result);

      if (result) {
        return bluebirdPromise.resolve(this.formatResponse(result));
      }
      return bluebirdPromise.reject();
    });
};
module.exports = new gatewayService();
