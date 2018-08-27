/* jshint esversion: 6 */

const categorymodel = require('../models/category');
const mongoose = require('mongoose');
const tagHelper = require('../helpers/tags');
const bluebirdPromise = require('bluebird');
const commonHelper = require('./common');
const currentUserHandler = require('../lib/currentUserHandler');

const categoryDependent = {
  kollection: 'items.id',
  location: 'categories.id',
  product: 'categories.id',
  things: 'categories.id'
};
const validator = require('../lib/validatorAsync');
const akUtils = require('../lib/utility');
const jsTypeChecker = require('javascript-type-checker');

const categoryService = function() {};
const clientHandler = require('../lib/clientHandler');

/**
 * Set client of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
categoryService.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

/**
 * Query the database to fetch attributes on the basis of search parameters and other parameters
 * 
 * @param {Object} searchParams search filters
 * @param {Object} otherParams pagination, sorting etc other params.
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
categoryService.prototype.get = function(filterparams, otherparams) {
  return categorymodel
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
        for (let i = 0; i < result.length; i++) {
          list.push(this.formatResponse(result[i], otherparams.isDropdown));
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
 * Fetch the complete object from a parent ID if the ID corresponds to a valid parent
 * 
 * @param {String} idToGet ID of the requested Parent
 * @param {String} selfId ID of the object requesting the parent. Used to remove cyclic hierarchy.
 * @return {Promise} Promise to represent the result of save operation.
 * 
 */
categoryService.prototype.getParentObject = function(idToGet, selfId) {
  let selfIdProvided = false;
  let conditions;
  if (!mongoose.Types.ObjectId.isValid(idToGet)) {
    return bluebirdPromise.reject();
  }
  if (selfId) {
    selfIdProvided = true;
    if (!mongoose.Types.ObjectId.isValid(selfId)) {
      return bluebirdPromise.reject();
    } else if (String(idToGet) === String(selfId)) {
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

  return categorymodel
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
 * Fetch a particular category by providing its ID
 * 
 * @param {String} categoryId ID of the category to Fetch
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
categoryService.prototype.getById = function(categoryId = '') {
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    return bluebirdPromise.reject();
  }
  let conditions = {
    _id: categoryId
  };
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return categorymodel
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
 * Checks if a give code already exists in the database.
 * 
 * @param {String} code Code to check
 * @param {String} excludedObjId Object ID of current object if checking while update.
 * @return {Promise} Resolved promise if duplicate code. Rejected promise otherwise
 * 
 */
categoryService.prototype.isDuplicateCode = function(code = '', excludedObjId = null) {
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
  return categorymodel
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
 * Save a category
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of save operation.
 * 
 */
categoryService.prototype.save = function(event) {
  return bluebirdPromise
    .all([
      tagHelper.getForPopulation(event.body.tags),
      commonHelper.getAncestors('categories', event.body.parent)
    ])
    .then(populatedData => {
      const categoryObj = new categorymodel(); // create a new instance of the  model
      categoryObj.code = event.body.code;
      categoryObj.name = event.body.name;
      categoryObj.sysDefined = 0;
      categoryObj.status = event.body.status;
      categoryObj.updatedOn = Date.now();
      categoryObj.updatedBy = currentUserHandler.getCurrentUser();
      categoryObj.seoName = commonHelper.generateSlug(event.body.name);
      categoryObj.parent = event.body.parent || '';
      categoryObj.client = clientHandler.getClient();
      categoryObj.tags = populatedData[0];
      categoryObj.ancestors = populatedData[1];
      return categoryObj.save();
    });
};

/**
 * Update a category
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of update operation.
 * 
 */
categoryService.prototype.update = function(event) {
  let resultCategory;
  return bluebirdPromise
    .all([
      tagHelper.getForPopulation(event.body.tags),
      commonHelper.getAncestors('categories', event.body.parent)
    ])
    .then(populatedData => {
      let conditions = {
        _id: event.pathParameters.id
      };
      conditions = clientHandler.addClientFilterToConditions(conditions);
      const categoryUpdateObj = {};
      categoryUpdateObj.code = event.body.code;
      categoryUpdateObj.name = event.body.name;
      categoryUpdateObj.status = event.body.status;
      categoryUpdateObj.parent = event.body.parent;
      categoryUpdateObj.seoName = commonHelper.generateSlug(event.body.name);
      categoryUpdateObj.ancestors = populatedData[1];
      categoryUpdateObj.tags = populatedData[0];
      categoryUpdateObj.updatedOn = Date.now();
      categoryUpdateObj.updatedBy = currentUserHandler.getCurrentUser();
      const updateParams = {
        $set: categoryUpdateObj,
        $inc: {
          __v: 1
        }
      };
      return categorymodel
        .findOneAndUpdate(conditions, updateParams, {
          upsert: false,
          new: true
        })
        .exec();
    })
    .then(() => this.getById(event.pathParameters.id))
    .then(result => {
      resultCategory = result;
      return this.updateDependentEntities(result);
    })
    .then(() => resultCategory);
};

/**
 * Update children of a category.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
categoryService.prototype.updateDependentEntities = function(sourceObj) {
  return commonHelper.updateChildren('category', sourceObj);
};

/**
 * Performs update-specific validations before performing common validations.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
categoryService.prototype.validateUpdate = function(event) {
  let basicErrors;
  return this.commonValidations(event)
    .catch(errors => errors)
    .then(errorsIfAny => {
      basicErrors = errorsIfAny || {};
      return bluebirdPromise.all([
        bluebirdPromise.all([
          validator.elementExists('categories', event.pathParameters.id),
          validator.notSysDefined('categories', event.pathParameters.id),
          validator.deactivationCheck('categories', event.body.status, event.pathParameters.id)
        ]),
        bluebirdPromise.all([
          validator.checkSame('categories', 'code', event.body.code, event.pathParameters.id)
        ])
      ]);
    })
    .then(result => {
      const mapping = {
        global: {
          index: 0,
          fieldName: 'Category'
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
          akUtils.getObjectValues(akUtils.sortErrorsObject(combinedErrors, 'categories'))
        );
      }
      return bluebirdPromise.resolve();
    })
    .catch(errors => bluebirdPromise.reject(errors));
};

/**
 * Performs basic validations which do not need to query other tables in the database.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of operation. Resolves the populated event. Rejects with the validation errors. 
 * 
 */
categoryService.prototype.validateBasics = function(event) {
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
 * Validate fields containing IDs of other DB Collections and populate their fields
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of operation. Resolves the populated event. Rejects with the validation errors. 
 * 
 */
categoryService.prototype.validateAndPopulateIds = function(event) {
  const commonHelper = require('./common');
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
    .then(() => {
      if (errors.length !== 0) {
        return bluebirdPromise.reject(errors);
      }
      return bluebirdPromise.resolve(event);
    });
};

/**
 * Performs save-specific validations before performing common validations.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
categoryService.prototype.validateRequest = function(event) {
  return this.commonValidations(event)
    .then(() => {})
    .catch(errors => {
      if (!jsTypeChecker.isEmptyObject(errors)) {
        return bluebirdPromise.reject(
          akUtils.getObjectValues(akUtils.sortErrorsObject(errors, 'categories'))
        );
      }
      return bluebirdPromise.resolve();
    });
};

/**
 * Performs validations common in both update and save.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
categoryService.prototype.commonValidations = function(event) {
  return bluebirdPromise
    .all([
      bluebirdPromise.all([
        validator.required(event.body.code),
        validator.stringLength(0, validator.CODE_MAX_LENGTH, event.body.code),
        validator.notDuplicate('categories', 'code', event.body.code, event.pathParameters.id)
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
        validator.validateParent('categories', event.body.parent, event.pathParameters.id)
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
        parent: {
          index: 4,
          fieldName: 'Parent'
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
 * Count categories on the basis of some search conditions.
 * 
 * @param {Object} searchParams Search Conditions
 * @return {Promise<Number>} Number of matching categories.
 * 
 */
categoryService.prototype.count = function(searchParams = {}) {
  return categorymodel.count(searchParams).exec();
};

/**
 * Generate the search conditions for the GET operation.
 * 
 * @param {Object} event Lambda Event
 * @return {Object} filters.
 * 
 */
categoryService.prototype.getFilterParams = function(event) {
  // get filter params from url
  let filters = {};
  filters = clientHandler.addClientFilterToConditions(filters);
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

  /*
  if (event.queryStringParameters.parent) {
    filters.ancestors = [];
    filters.ancestors[0] = {};

    filters.ancestors[0].name = event.queryStringParameters.parent;
  }
  */

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
  return filters;
};

/**
 * Generate the extra parameters for the GET operation like sorting, pagination etc.
 * 
 * @param {Object} request Lambda Event
 * @return {Object} extraParams
 * 
 */
categoryService.prototype.getExtraParams = function(event) {
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

      if (col === 'parent') {
        col = 'ancestors.0.name';
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
 * Performs response from DB operations to return as API response.
 * 
 * @param {Object} data Database operation result.
 * @param {Boolean} isDropdown Whether the APi is requesting a dropdown.
 * @return {Promise} formattedResponse Formatted Response
 * 
 */
categoryService.prototype.formatResponse = function(data, isDropdown = false) {
  const formattedResponse = {};
  if (!isDropdown) {
    formattedResponse.id = data._id;
    formattedResponse.code = data.code;
    formattedResponse.name = data.name;
    formattedResponse.sysDefined = data.sysDefined;
    formattedResponse.status = data.status;
    formattedResponse.updatedBy = `${((data || {}).updatedBy || '').firstName} ${((data || {})
      .updatedBy || ''
    ).lastName}`;
    formattedResponse.updatedOn = data.updatedOn;
    formattedResponse.client = data.client;
    formattedResponse.tags = data.tags;
    formattedResponse.parent = data.parent || null;
    formattedResponse.seoName = data.seoName;
    formattedResponse.ancestors = data.ancestors;
    return formattedResponse;
  }
  formattedResponse.id = data._id;
  formattedResponse.name = data.name;
  return formattedResponse;
};

categoryService.prototype.validateInactive = function(categoryId = '') {
  const modelpath = '../models/';

  const keys = Object.keys(categoryDependent);
  // console.log(keys);
  return bluebirdPromise
    .map(keys, key => {
      // console.log(`in 1${key}`);
      const model = require(modelpath + key.split('.')[0]);
      const condition = categoryDependent[key];
      const dict = {};
      dict[condition] = categoryId;
      // console.log(JSON.stringify(dict));
      return model
        .findOne(dict)
        .exec()
        .then(result => {
          if (result) {
            // console.log(`in 2 wwwqwqwq${JSON.stringify(result)}`);
            return result;
          }
          // console.log('in 3 eeeeee');
          return result;
        });
    })
    .then(result => {
      for (let i = 0; i < result.length; i++) {
        if (result[i] === null) {
          result.splice(i, 1);
          i--;
        }
      }
      if (result.length > 0) {
        return bluebirdPromise.resolve(true);
      }
      return bluebirdPromise.resolve(false);
    });
};
categoryService.prototype.getForPopulation = function(idList) {
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
  return categorymodel
    .find(conditions)
    .exec()
    .then(result =>
      result.sort((a, b) => idList.indexOf(a._id) - idList.indexOf(b._id)).map(result => ({
        id: result._id,
        name: result.name
      }))
    );
};

categoryService.prototype.validatePopulatable = function(idList) {
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
  return categorymodel
    .count(conditions)
    .exec()
    .then(count => {
      if (count === idList.length) {
        return bluebirdPromise.resolve(true);
      }
      return bluebirdPromise.resolve(false);
    });
};

categoryService.prototype.isDuplicate = function(field, value = '', excludedObjId = null) {
  let conditions = {};
  conditions[field] = value;
  if (excludedObjId !== null && mongoose.Types.ObjectId.isValid(excludedObjId)) {
    conditions._id = {
      $ne: mongoose.Types.ObjectId(excludedObjId)
    };
  }
  conditions = clientHandler.addClientFilterToConditions(conditions);

  return categorymodel
    .findOne(conditions)
    .exec()
    .then(result => {
      if (result) {
        return bluebirdPromise.resolve();
      }
      return bluebirdPromise.reject();
    });
};

module.exports = new categoryService();
