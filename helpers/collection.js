/* jshint esversion: 6 */

const collectionModel = require('../models/kollection');
const mongoose = require('mongoose');
const bluebirdPromise = require('bluebird');
const commonHelper = require('./common');
const tagHelper = require('../helpers/tags');
const validator = require('../lib/validatorAsync');
const akUtils = require('../lib/utility');
const jsTypeChecker = require('javascript-type-checker');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');

const collectionService = function collectionService() {};

/**
 * Set client of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
collectionService.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

/**
 * Query the database to fetch collections on the basis of search parameters and other parameters
 * 
 * @param {Object} searchParams search filters
 * @param {Object} otherParams pagination, sorting etc other params.
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
collectionService.prototype.get = function(searchParams, otherParams) {
  return collectionModel
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
 * Fetch a particular collection by providing its ID
 * 
 * @param {String} collectionId ID of the collection to Fetch
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
collectionService.prototype.getById = function(kollectionId) {
  if (!mongoose.Types.ObjectId.isValid(kollectionId)) {
    return bluebirdPromise.reject();
  }
  let conditions = {
    _id: mongoose.Types.ObjectId(kollectionId)
  };
  conditions = clientHandler.addClientFilterToConditions(conditions);

  return collectionModel
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
 * Fetch a particular collection by providing its Code
 * 
 * @param {String} code Code of the collection to Fetch
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
collectionService.prototype.getByCode = function(code = '') {
  let conditions = {
    code
  };
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return collectionModel
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
 * Save a collection
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of save operation.
 * 
 */
collectionService.prototype.save = function(event) {
  return bluebirdPromise
    .all([
      tagHelper.getForPopulation(event.body.tags),
      commonHelper.getAncestors('collections', event.body.parent),
      commonHelper.populateCollectionItems(event.body.type, event.body.items)
    ])
    .then(populations => {
      const collectionObj = new collectionModel(); // create a new instance of the  model
      collectionObj.code = event.body.code;
      collectionObj.name = event.body.name;
      collectionObj.sysDefined = 0;
      collectionObj.status = event.body.status;
      collectionObj.updatedOn = Date.now();
      collectionObj.updatedBy = currentUserHandler.getCurrentUser();
      collectionObj.type = event.body.type;
      collectionObj.items = populations[2];
      collectionObj.parent = event.body.parent;
      collectionObj.seoName = commonHelper.generateSlug(event.body.name);
      collectionObj.client = clientHandler.getClient();
      collectionObj.tags = populations[0];
      collectionObj.ancestors = populations[1];
      return collectionObj.save();
    });
};

/**
 * Fetch the complete object from a parent ID if the ID corresponds to a valid parent
 * 
 * @param {String} idToGet ID of the requested Parent
 * @param {String} selfId ID of the object requesting the parent. Used to remove cyclic hierarchy.
 * @return {Promise} Promise to represent the result of save operation.
 * 
 */
collectionService.prototype.getParentObject = function(idToGet, selfId) {
  let selfIdProvided = false;
  let conditions;
  if (!mongoose.Types.ObjectId.isValid(idToGet)) {
    return bluebirdPromise.reject();
  }
  if (selfId) {
    selfIdProvided = true;
    if (!mongoose.Types.ObjectId.isValid(selfId)) {
      return bluebirdPromise.reject();
    }
  }
  if (selfIdProvided) {
    conditions = {
      _id: mongoose.Types.ObjectId(idToGet),
      'ancestors.id': {
        $ne: mongoose.Types.ObjectId(selfId)
      }
    };
  } else {
    conditions = {
      _id: mongoose.Types.ObjectId(idToGet)
    };
  }
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return collectionModel
    .findOne(conditions)
    .exec()
    .then(result => {
      if (result) {
        return bluebirdPromise.resolve(result);
      }
      return bluebirdPromise.reject();
    });
};

/**
 * Validate fields containing IDs of other DB Collections and populate their fields
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of operation. Resolves the populated event. Rejects with the validation errors. 
 * 
 */
collectionService.prototype.validateAndPopulateIds = function(event) {
  const errors = [];
  let tagNameList = [];
  if (event.body.tags !== undefined && event.body.tags !== null) {
    tagNameList = commonHelper.deepCloneObject(event.body.tags);
  }
  event.body.tags = [];
  event.body.ancestors = [];
  let parentProvided = true;
  if (!event.body.parent) {
    parentProvided = false;
    event.body.parent = '';
  }
  return this.getParentObject(event.body.parent, event.pathParameters.id)
    .then(result => {
      const parentAncestorObj = {};
      parentAncestorObj.id = result.id;
      parentAncestorObj.seoName = result.seoName;
      parentAncestorObj.name = result.name;
      const ancestors = [];
      ancestors.push(parentAncestorObj);
      event.body.ancestors = ancestors.concat(result.ancestors);
    })
    .catch(() => {
      if (parentProvided) {
        errors.push({
          code: 2101,
          message: 'Invalid Parent'
        });
      }
    })
    .then(() =>
      commonHelper.getTagListFromNames(tagNameList, event).then(list => {
        event.body.tags = list;
      })
    )
    .then(() => this.validateAndPopulateItems(event))
    .catch(err => {
      errors.push(err);
    })
    .then(event => {
      if (errors.length !== 0) {
        return bluebirdPromise.reject(errors);
      }
      return bluebirdPromise.resolve(event);
    });
};

/**
 * Performs basic validations which do not need to query other tables in the database.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of operation. Resolves the populated event. Rejects with the validation errors. 
 * 
 */
collectionService.prototype.validateBasics = function(event) {
  let errors = [];
  const type = ['users', 'things', 'products', 'categories', 'attributes', 'places', 'tags'];
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

  if (!event.body.type) {
    errors.push({
      code: 2004,
      message: 'Collection Type is mandatory'
    });
  } else if (type.indexOf(event.body.type) <= -1) {
    errors.push({
      code: 2007,
      message: 'Invalid Collection Type.'
    });
  }
  errors = errors.concat(commonHelper.validateTags(event.body.tags));
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
 * Checks if a give code already exists in the database.
 * 
 * @param {String} code Code to check
 * @param {String} excludedObjId Object ID of current object if checking while update.
 * @return {Promise} Resolved promise if duplicate code. Rejected promise otherwise
 * 
 */
collectionService.prototype.isDuplicateCode = function(code = '', excludedObjId = null) {
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
  return collectionModel
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
 * Validate and populate collection items from database.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
collectionService.prototype.validateAndPopulateItems = function(event) {
  if (!event.body.items || event.body.items.length === 0) {
    return bluebirdPromise.resolve(event);
  }
  let itemModel;
  if (event.body.type === 'users') {
    itemModel = require('../models/');
  } else if (event.body.type === 'things') {
    itemModel = require('./things');
  } else if (event.body.type === 'products') {
    itemModel = require('./product');
  } else if (event.body.type === 'categories') {
    itemModel = require('./category');
  } else if (event.body.type === 'attributes') {
    itemModel = require('./attribute');
  } else if (event.body.type === 'places') {
    itemModel = require('../models/');
  } else if (event.body.type === 'tags') {
    itemModel = require('./tags');
  } else {
    return bluebirdPromise.reject({
      code: 2006,
      message: 'Type is invalid'
    });
  }
  return bluebirdPromise
    .map(event.body.items, itemId => itemModel.getById(itemId))
    .then(itemList => {
      event.body.items = itemList.map(element => {
        const item = {};
        item.id = element.id;
        item.name = element.name;
        item.sysDefined = element.sysDefined;
        return item;
      });
      return bluebirdPromise.resolve(event);
    })
    .catch(error => {
      // console.log(error);
      return bluebirdPromise.reject({
        code: 2005,
        message: 'One or more items do not exist.'
      });
    });
};

/**
 * Performs common validations in both update and save.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
collectionService.prototype.commonValidations = function(event) {
  return bluebirdPromise
    .all([
      bluebirdPromise.all([
        validator.required(event.body.code),
        validator.stringLength(0, validator.CODE_MAX_LENGTH, event.body.code),
        validator.notDuplicate('collections', 'code', event.body.code, event.pathParameters.id)
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
        validator.required(event.body.type),
        validator.valueAllowed(
          ['users', 'things', 'products', 'categories', 'attributes', 'places', 'tags'],
          event.body.type
        )
      ]),
      bluebirdPromise.all([
        validator.validateParent('collections', event.body.parent, event.pathParameters.id)
      ]),
      bluebirdPromise.all([
        validator.duplicateArrayElements(null, event.body.items),
        validator.validateCollectionItems(event.body.type, event.body.items)
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
        type: {
          index: 4,
          fieldName: 'Collection Type'
        },
        parent: {
          index: 5,
          fieldName: 'Parent'
        },
        items: {
          index: 6,
          fieldName: 'Items'
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
 * Performs save-specific validations before performing common validations.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
collectionService.prototype.validateRequest = function(event) {
  return this.commonValidations(event)
    .then(() => {})
    .catch(errors => {
      if (!jsTypeChecker.isEmptyObject(errors)) {
        return bluebirdPromise.reject(
          akUtils.getObjectValues(akUtils.sortErrorsObject(errors, 'collections'))
        );
      }
      return bluebirdPromise.resolve();
    });
};

/**
 * Performs response from DB operations to return as API response.
 * 
 * @param {Object} data Database operation result.
 * @param {Boolean} isDropdown Whether the APi is requesting a dropdown.
 * @return {Promise} formattedResponse Formatted Response
 * 
 */
collectionService.prototype.formatResponse = function(data, isDropdown = false) {
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
    formattedResponse.type = data.type;
    formattedResponse.client = data.client;
    formattedResponse.tags = data.tags;
    formattedResponse.parent = data.parent || null;
    formattedResponse.seoName = data.seoName;
    formattedResponse.ancestors = data.ancestors;
    formattedResponse.items = data.items;
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
collectionService.prototype.getFilterParams = function(event) {
  let filters = {};
  filters = clientHandler.addClientFilterToConditions(filters);
  if (!event.queryStringParameters) {
    return filters;
  }
  if (event.queryStringParameters && event.queryStringParameters.filter) {
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
        'ancestors.0.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        type: new RegExp(event.queryStringParameters.filter, 'i')
      }
    ];
  }
  if (event.queryStringParameters.id) {
    filters._id = mongoose.Types.ObjectId(event.queryStringParameters.id);
  }
  if (event.queryStringParameters.code) {
    filters.Code = new RegExp(event.queryStringParameters.code, 'i');
  }
  if (event.queryStringParameters.name) {
    filters.Name = new RegExp(event.queryStringParameters.name, 'i');
  }

  if (event.queryStringParameters.parent) {
    filters.ancestors = [];
    filters.ancestors[0] = {};

    filters.ancestors[0].id = event.queryStringParameters.parent;
  }

  if (event.queryStringParameters.status) {
    filters.status = parseInt(event.queryStringParameters.status, 10);
  }

  if (event.queryStringParameters.type) {
    filters.type = event.queryStringParameters.type;
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
    if (mongoose.Types.ObjectId.isValid(event.queryStringParameters.validParentFor)) {
      filters._id = {
        $ne: mongoose.Types.ObjectId(event.queryStringParameters.validParentFor)
      };
      filters['ancestors.id'] = {
        $ne: mongoose.Types.ObjectId(event.queryStringParameters.validParentFor)
      };
    }
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
collectionService.prototype.getExtraParams = function(request) {
  const params = {};
  params.sort = {};
  if (!request.queryStringParameters) {
    params.pageParams = {
      offset: 0,
      limit: 65535
    };
    params.sort.updatedOn = -1;
    return params;
  }
  const dd = request.queryStringParameters.dd === '1';
  const offset = request.queryStringParameters.offset ? request.queryStringParameters.offset : 0;
  const limit = request.queryStringParameters.limit ? request.queryStringParameters.limit : 20;
  params.isDropdown = dd;
  params.pageParams = {
    offset: dd ? 0 : parseInt(offset, 10),
    limit: dd ? 65535 : parseInt(limit, 10)
  };
  if (request.queryStringParameters.sort) {
    const sortQuery = request.queryStringParameters.sort;
    const sortColumns = sortQuery.split(',');
    sortColumns.forEach(function(col) {
      col = col.trim();
      let sortOrder = 1;
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
 * Map keys for sorting.
 * 
 * @param {String} key
 * @return {String} 
 * 
 */
collectionService.prototype.getColumnMap = function(key) {
  const map = {
    id: '_id',
    code: 'code',
    name: 'name',
    sysDefined: 'sysDefined',
    updatedOn: 'updatedOn',
    updatedBy: 'updatedBy',
    parent: 'ancestors.0.name'
  };

  if (key) {
    return map[key] || key;
  }
  return map;
};

/**
 * Count collections on the basis of some search conditions.
 * 
 * @param {Object} searchParams Search Conditions
 * @return {Promise<Number>} Number of matching collections..
 * 
 */
collectionService.prototype.count = function(searchParams = {}) {
  return collectionModel.count(searchParams).exec();
};

/**
 * Performs update-specific validations before performing common validations.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
collectionService.prototype.validateUpdate = function(event) {
  let basicErrors;
  return this.commonValidations(event)
    .catch(errors => errors)
    .then(errorsIfAny => {
      basicErrors = errorsIfAny || {};
      return bluebirdPromise.all([
        bluebirdPromise.all([
          validator.elementExists('collections', event.pathParameters.id),
          validator.sysDefinedCollectionUpdate(event.pathParameters.id, event.body, {
            AkUtils: akUtils
          })
        ]),
        bluebirdPromise.all([
          validator.checkSame('collections', 'code', event.body.code, event.pathParameters.id)
        ])
      ]);
    })
    .then(result => {
      const mapping = {
        global: {
          index: 0,
          fieldName: 'Collection'
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
          akUtils.getObjectValues(akUtils.sortErrorsObject(combinedErrors, 'collections'))
        );
      }
      return bluebirdPromise.resolve();
    })
    .catch(errors => bluebirdPromise.reject(errors));
};

/**
 * Validate update in case of systemDefined collection.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
collectionService.prototype.validateSystemDefinedUpdate = function(event, result) {
  const errors = [];
  if (event.body.name && event.body.name !== result.name) {
    errors.push({
      code: 2503,
      message: 'Cannot modify sysDefined collection name.'
    });
    return bluebirdPromise.reject(errors);
  }
  if (event.body.code && result.code !== event.body.code) {
    errors.push({
      code: 2504,
      message: 'Code of system defined collection cannot be modified.'
    });
    return bluebirdPromise.reject(errors);
  }
  if (event.body.parent && result.parent !== event.body.parent) {
    errors.push({
      code: 2505,
      message: 'Parent of system defined collection cannot be modified '
    });
    return bluebirdPromise.reject(errors);
  }
  if (event.body.type && result.type !== event.body.type) {
    errors.push({
      code: 2506,
      message: 'Type of system defined collection cannot be modified.'
    });
    return bluebirdPromise.reject(errors);
  }
  const attributeList = [];
  result.items.forEach(element => {
    if (element.sysDefined === 1) {
      attributeList.push(element.id);
    }
  });
  attributeList.forEach(id => {
    if (event.body.items.indexOf(`${id}`) <= -1) {
      errors.push({
        code: 2507,
        message: 'All system defined attributes are compulsory'
      });
    }
  });
  if (errors.length > 0) {
    return bluebirdPromise.reject(errors);
  }
  return bluebirdPromise.resolve();
};

/**
 * Update a collection
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of update operation.
 * 
 */
collectionService.prototype.update = function(event) {
  let resultCollection;
  return bluebirdPromise
    .all([
      tagHelper.getForPopulation(event.body.tags),
      commonHelper.getAncestors('collections', event.body.parent),
      commonHelper.populateCollectionItems(event.body.type, event.body.items)
    ])
    .then(populations => {
      let conditions = {
        _id: event.pathParameters.id
      };
      conditions = clientHandler.addClientFilterToConditions(conditions);
      const collectionObj = {}; // create a new instance of the  model
      collectionObj.code = event.body.code;
      collectionObj.name = event.body.name;
      collectionObj.status = event.body.status;
      collectionObj.updatedOn = Date.now();
      collectionObj.updatedBy = currentUserHandler.getCurrentUser();
      collectionObj.type = event.body.type;
      collectionObj.items = populations[2];
      collectionObj.parent = event.body.parent;
      collectionObj.seoName = commonHelper.generateSlug(event.body.name);
      collectionObj.client = clientHandler.getClient();
      collectionObj.tags = populations[0];
      collectionObj.ancestors = populations[1];
      const updateParams = {
        $set: collectionObj,
        $inc: {
          __v: 1
        }
      };
      // collectionObj.sysDefined = 0;
      return collectionModel
        .findOneAndUpdate(conditions, updateParams, {
          upsert: false,
          new: true
        })
        .exec();
    })
    .then(() => this.getById(event.pathParameters.id))
    .then(result => {
      resultCollection = result;
      return this.updateDependentEntities(result);
    })
    .then(() => resultCollection);
};

/**
 * Update children of a Collection.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
collectionService.prototype.updateDependentEntities = function(sourceObj) {
  return commonHelper.updateChildren('collection', sourceObj);
};

/**
 * Get items of a collection by providing it's code.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with items if successful. Rejected promise with validation errors otherwise.
 * 
 */
collectionService.prototype.getItemByCode = function(event) {
  if (!event.pathParameters.code) {
    return bluebirdPromise.reject();
  }
  return this.getByCode(event.pathParameters.code)
    .then(result => this.formattItems(result))
    .catch(() => bluebirdPromise.reject());
};

/**
 * Format items of a collection.
 * 
 * @param {Object} result Collection object
 * @return {Promise} Resolved promise with items.
 * 
 */
collectionService.prototype.formattItems = function(result) {
  const arr = result.items;
  const items = [];
  if (!arr || arr.length === 0) {
    return bluebirdPromise.reject();
  }
  arr.forEach(element => {
    if (element.sysDefined !== 1) {
      items.push({
        id: element.id,
        name: element.name
      });
    }
  });
  return bluebirdPromise.resolve(items);
};

collectionService.prototype.isDuplicate = function(field, value = '', excludedObjId = null) {
  let conditions = {};
  conditions[field] = value;
  if (excludedObjId !== null && mongoose.Types.ObjectId.isValid(excludedObjId)) {
    conditions._id = {
      $ne: mongoose.Types.ObjectId(excludedObjId)
    };
  }
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return collectionModel
    .findOne(conditions)
    .exec()
    .then(result => {
      if (result) {
        return bluebirdPromise.resolve();
      }
      return bluebirdPromise.reject();
    });
};

module.exports = new collectionService();
