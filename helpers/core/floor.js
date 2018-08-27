/* jshint esversion: 6 */

const locationmodel = require('../../models/location');
const commonHelper = require('../common');
const mongoose = require('mongoose');
const bluebirdPromise = require('bluebird');
const tagHelper = require('../tags');
const categoryHelper = require('../category');
const attributeHelper = require('../attribute');
const validator = require('../../lib/validatorAsync');
const akUtils = require('../../lib/utility');
const jsTypeChecker = require('javascript-type-checker');
const clientHandler = require('../../lib/clientHandler');
const currentUserHandler = require('../../lib/currentUserHandler');

const typemap = {
  radius: 'number'
};

const floorService = function() {};

/**
 * Set client of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
floorService.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

floorService.prototype.isDuplicate = function(
  field,
  value = '',
  excludedObjId = null,
  locationId = ''
) {
  let conditions = {};
  conditions.type = 'floor';
  conditions[field] = value;
  // if(mongoose.Types.ObjectId.isValid(locationId)) {
  //   conditions.parent = locationId;
  // }
  if (excludedObjId !== null && mongoose.Types.ObjectId.isValid(excludedObjId)) {
    conditions._id = {
      $ne: mongoose.Types.ObjectId(excludedObjId)
    };
  }
  conditions = clientHandler.addClientFilterToConditions(conditions);

  return locationmodel
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
 * Query the database to fetch attributes on the basis of search parameters and other parameters
 * 
 * @param {Object} searchParams search filters
 * @param {Object} otherParams pagination, sorting etc other params.
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */

floorService.prototype.get = function(filterparams, otherparams) {
  return locationmodel
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
 * Performs validations common in both update and save.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
floorService.prototype.commonValidations = function(event) {
  return bluebirdPromise
    .all([
      bluebirdPromise.all([
        validator.required(event.body.code),
        validator.stringLength(0, validator.CODE_MAX_LENGTH, event.body.code),
        validator.notDuplicate(
          'floors',
          'code',
          event.body.code,
          event.pathParameters.id || '',
          event.body.parent
        )
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
        validator.required(event.body.parent),
        validator.type('string', event.body.parent),
        validator.validateParent('locations', event.body.parent, event.pathParameters.id)
      ]),
      bluebirdPromise.all([
        validator.type('array', event.body.attributes),
        validator.arrayOfType('object', event.body.attributes),
        validator.validatePopulatableLists('attributes', event.body.attributes),
        validator.duplicateArrayElements('id', event.body.attributes)
      ]),
      bluebirdPromise.all([
        validator.type('array', event.body.categories),
        validator.duplicateArrayElements(null, event.body.categories),
        validator.validatePopulatableLists('categories', event.body.categories),
        validator.arrayOfType('string', event.body.categories)
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
          fieldName: 'Location'
        },
        attributes: {
          index: 5,
          fieldName: 'Attributes'
        },
        categories: {
          index: 6,
          fieldName: 'Categories'
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
 * Fetch the complete object from a parent ID if the ID corresponds to a valid parent
 * 
 * @param {String} idToGet ID of the requested Parent
 * @param {String} selfId ID of the object requesting the parent. Used to remove cyclic hierarchy.
 * @return {Promise} Promise to represent the result of save operation.
 * 
 */
floorService.prototype.getParentObject = function(idToGet, selfId) {
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
  return locationmodel
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
 * Fetch a particular location by providing its id
 * 
 * @param {String} locationId ID of the location to Fetch
 * @param {Boolean} moveSysAttributes Flag to decide whether or not to move system atributes to global level
 * @return {Promise} Promise to represent the result of save operation.
 * 
 */
floorService.prototype.getById = function(locationId = '', moveSysAttributes = true) {
  if (!mongoose.Types.ObjectId.isValid(locationId)) {
    return bluebirdPromise.reject();
  }
  let conditions = {
    _id: locationId
  };
  conditions.type = 'floor';
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return locationmodel
    .findOne(conditions)
    .exec()
    .then(result => {
      if (result) {
        return bluebirdPromise.resolve(this.formatResponse(result, false, moveSysAttributes));
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
floorService.prototype.isDuplicateCode = function(code = '', excludedObjId = null) {
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
  conditions.type = 'floor';
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return locationmodel
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
 * Save a location
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of save operation.
 * 
 */
floorService.prototype.save = function(event) {
  return bluebirdPromise
    .all([
      tagHelper.getForPopulation(event.body.tags),
      attributeHelper.getForPopulation(event.body.attributes),
      commonHelper.getAncestors('locations', event.body.parent),
      categoryHelper.getForPopulation(event.body.categories)
    ])
    .then(populations => {
      // console.log(populations[2]);
      const locationObj = new locationmodel(); // create a new instance of the  model
      locationObj.code = event.body.code;
      locationObj.name = event.body.name;
      locationObj.type = 'floor';
      locationObj.status = event.body.status;
      locationObj.categories = populations[3];
      locationObj.updatedOn = Date.now();
      locationObj.updatedBy = currentUserHandler.getCurrentUser();
      locationObj.seoName = commonHelper.generateSlug(event.body.name);
      locationObj.parent = event.body.parent;
      locationObj.client = clientHandler.getClient();
      locationObj.tags = populations[0];
      locationObj.attributes = [...populations[1]];
      locationObj.ancestors = populations[2];
      return locationObj.save();
    });
};

/**
 * Update a location
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of update operation.
 * 
 */
floorService.prototype.update = function(event) {
  let resultLocation;
  let conditions = {
    _id: event.pathParameters.id
  };
  conditions.type = 'floor';
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return bluebirdPromise
    .all([
      tagHelper.getForPopulation(event.body.tags),
      attributeHelper.getForPopulation(event.body.attributes),
      commonHelper.getAncestors('locations', event.body.parent),
      categoryHelper.getForPopulation(event.body.categories)
    ])
    .then(populations => {
      const locationObj = {}; // create a new instance of the  model
      locationObj.code = event.body.code;
      locationObj.name = event.body.name;
      locationObj.type = 'floor';
      locationObj.status = event.body.status;
      locationObj.categories = populations[3];
      locationObj.updatedOn = Date.now();
      locationObj.updatedBy = currentUserHandler.getCurrentUser();
      locationObj.seoName = commonHelper.generateSlug(event.body.name);
      locationObj.parent = event.body.parent;
      locationObj.client = clientHandler.getClient();
      locationObj.tags = populations[0];
      locationObj.attributes = [...populations[1]];
      locationObj.ancestors = populations[2];
      const updateParams = {
        $set: locationObj,
        $inc: {
          __v: 1
        }
      };
      return locationmodel
        .findOneAndUpdate(conditions, updateParams, {
          upsert: false,
          new: true
        })
        .exec();
    })
    .then(() => this.getById(event.pathParameters.id))
    .then(result => {
      resultLocation = result;
      return this.updateDependentEntities(result);
    })
    .then(() => resultLocation);
};

/**
 * Update children of a category.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
floorService.prototype.updateDependentEntities = function(sourceObj) {
  return commonHelper.updateChildren('location', sourceObj);
};

/**
 * Performs update-specific validations before performing common validations.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
floorService.prototype.validateUpdate = function(event) {
  let basicErrors;
  return this.commonValidations(event)
    .catch(errors => errors)
    .then(errorsIfAny => {
      basicErrors = errorsIfAny || {};
      return bluebirdPromise.all([
        bluebirdPromise.all([
          validator.elementExists('floors', event.pathParameters.id),
          validator.deactivationCheck('floors', event.body.status, event.pathParameters.id)
        ]),
        bluebirdPromise.all([
          validator.checkSame('floors', 'code', event.body.code, event.pathParameters.id)
        ])
      ]);
    })
    .then(result => {
      const mapping = {
        global: {
          index: 0,
          fieldName: 'Location'
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
          akUtils.getObjectValues(akUtils.sortErrorsObject(combinedErrors, 'floors'))
        );
      }
      return bluebirdPromise.resolve();
    })
    .catch(errors => bluebirdPromise.reject(errors));
};

/**
 * Validate whter a floor existing a specified location
 * 
 * @param {String} parentId Location ID
 * @param {String} floorId Floor ID
 * @return {Promise} Resolved promise if valid. Rejected Promise otherwise.
 * 
 */
floorService.prototype.validateFloor = function(parentId, floorId) {
  return this.getById(parentId).then(result => {
    const floorData = result.floors.filter(floor => floor.id === floorId);
    if (floorData.length > 0) {
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
floorService.prototype.validateRequest = function(event) {
  return this.commonValidations(event)
    .then(() => {})
    .catch(errors => {
      if (!jsTypeChecker.isEmptyObject(errors)) {
        return bluebirdPromise.reject(
          akUtils.getObjectValues(akUtils.sortErrorsObject(errors, 'floors'))
        );
      }
      return bluebirdPromise.resolve();
    });
};

/**
 * Count locations on the basis of some search conditions.
 * 
 * @param {Object} searchParams Search Conditions
 * @return {Promise<Number>} Number of matching locations.
 * 
 */
floorService.prototype.count = function(searchParams = {}) {
  return locationmodel.count(searchParams).exec();
};

/**
 * Generate the search conditions for the GET operation.
 * 
 * @param {Object} event Lambda Event
 * @return {Object} filters.
 * 
 */
floorService.prototype.getFilterParams = function(event) {
  // get filter params from url
  let filters = {};
  filters.type = 'floor';
  filters = clientHandler.addClientFilterToConditions(filters);
  if (event.queryStringParameters.dd === '1') {
    filters.status = 1;
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
      },
      {
        'ancestors.name': new RegExp(event.queryStringParameters.filter, 'i')
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

  if (event.queryStringParameters.location) {
    filters.parent = event.queryStringParameters.location;
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

  /*
  if (event.queryStringParameters.floorMapAdded === '1') {
    filters.floorMapDetails = {};
    filters.floorMapDetails.$ne = null;
  } else if (event.queryStringParameters.floorMapAdded === '0') {
    filters.floorMapDetails = null;
  }

  if (event.queryStringParameters['things.code']) {
    filters['things.code'] = {};
    filters['things.code'].$in = event.queryStringParameters['things.code'].split(',');
  }
  */

  return filters;
};

/**
 * Generate the extra parameters for the GET operation like sorting, pagination etc.
 * 
 * @param {Object} request Lambda Event
 * @return {Object} extraParams
 * 
 */
floorService.prototype.getExtraParams = function(event) {
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

      if (col === 'location') {
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
floorService.prototype.formatResponse = function(
  data,
  isDropdown = false,
  moveSysAttributes = true
) {
  const formattedResponse = {};
  if (!isDropdown) {
    formattedResponse.id = data._id;
    formattedResponse.code = data.code;
    formattedResponse.name = data.name;
    formattedResponse.sysDefined = data.sysDefined;
    formattedResponse.status = data.status;

    if (data.updatedBy) {
      formattedResponse.updatedBy = `${((data || {}).updatedBy || '').firstName} ${((data || {})
        .updatedBy || ''
      ).lastName}`;
    }
    formattedResponse.updatedOn = data.updatedOn;
    formattedResponse.client = data.client;
    formattedResponse.tags = data.tags;
    formattedResponse.parent = data.parent || null;
    formattedResponse.seoName = data.seoName;
    formattedResponse.attributes = data.attributes;
    formattedResponse.categories = data.categories;
    formattedResponse.ancestors = data.ancestors;
    if (moveSysAttributes) {
      return commonHelper.moveSystemAttributesToGlobal(formattedResponse, typemap);
    }
    return formattedResponse;
  }
  formattedResponse.id = data._id;
  formattedResponse.name = data.name;
  return formattedResponse;
};

/**
 * Get list of all locations along with its floors
 * 
 * @returns 
 */
floorService.prototype.getFloorsList = function() {
  let conditions = {};
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return locationmodel
    .find(conditions, {
      'floors.id': 1,
      'floors.name': 1,
      name: 1
    })
    .exec()
    .then(result => {
      if (result) {
        const response = [];
        result.forEach(location => {
          response.push(this.formatResponse(location, false, false));
        });
        return bluebirdPromise.resolve(response);
      }
      return bluebirdPromise.reject();
    });
};

/**
 * Get floors associated with a specific location
 * 
 * @param {string} [locId=''] 
 * @returns 
 */
floorService.prototype.getByParentId = function(locId, conditions = {}, extraParams = {}) {
  if (!mongoose.Types.ObjectId.isValid(locId)) {
    return bluebirdPromise.reject();
  }
  conditions.parent = locId;
  conditions.type = 'floor';
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return locationmodel
    .find(conditions)
    .sort(extraParams.sort)
    .skip(extraParams.pageParams.offset)
    .limit(extraParams.pageParams.limit)
    .exec()
    .then(result => {
      if (result.length) {
        return bluebirdPromise.resolve(
          result.map(data => this.formatResponse(data, extraParams.isDropdown))
        );
      }
      return bluebirdPromise.reject();
    });
};

/**
 * Get floors associated with a specific location
 * 
 * @param {string} [locId=''] 
 * @returns 
 */
floorService.prototype.getFloorByLocId = function(locId = '') {
  if (!mongoose.Types.ObjectId.isValid(locId)) {
    return bluebirdPromise.reject();
  }
  let conditions = {};
  conditions._id = mongoose.Types.ObjectId(locId);
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return locationmodel
    .aggregate()
    .match(conditions)
    .lookup({
      from: 'locations',
      localField: '_id',
      foreignField: 'ancestors.0.id',
      as: 'floors'
    })
    .exec()
    .then(result => {
      result = result[0];
      const response = {};
      response.id = result._id;
      response.name = result.name;
      response.floors = result.floors.map(floor => ({
        name: floor.name,
        id: floor._id
      }));
      response.floors.push({
        name: 'Default',
        id: `default.${locId}`
      });
      // console.log(response);
      return response;
    });
};

/**
 * Get zones on a floor represented by floorId
 * 
 * @param {string} [floorId=''] 
 * @returns 
 */
floorService.prototype.getZonesonFloor = function(floorId = '') {
  let conditions = {
    parent: floorId
  };
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return locationmodel
    .find(conditions, {
      code: 1,
      name: 1
    })
    .exec();
};

/**
 * Get List of Zones and products in them on a specific floor
 * 
 * @param {string} [floorId=''] 
 * @returns 
 */
floorService.prototype.getFloorsZoneProducts = function(floorId = '') {
  const productHelper = require('../product');
  const response = {};
  response.id = floorId;
  response.zones = [];
  // mongoose.set('debug', true);

  if (floorId.indexOf('default') < 0) {
    // get zones on floor
    if (!mongoose.Types.ObjectId.isValid(floorId)) {
      return bluebirdPromise.reject('Not a valid id of floor');
    }
    return this.getZonesonFloor(floorId)
      .then(zoneList =>
        bluebirdPromise.each(zoneList, zone => {
          // format zone details
          const zoneDetails = {};
          zoneDetails.id = zone._id;
          zoneDetails.code = zone.code;
          zoneDetails.name = zone.name;
          zoneDetails.productList = [];
          // get products present in the zone
          return productHelper.getProductsinZone(zone._id).then(productList => {
            zoneDetails.productList =
              (productList || []).filter(product => typeof product !== typeof undefined).map(
                product =>
                  // format product details
                  ({
                    id: product.id,
                    code: product.code,
                    name: product.name,
                    things: product.things
                  })

                // add product to zone product list
              ) || [];
            // add zone to response zone list
            response.zones.push(zoneDetails);
          });
        })
      )
      .then(() =>
        // return the response
        bluebirdPromise.resolve(response)
      )
      .catch(err => {
        console.log(err);
      });
  }
  const locId = floorId.split('.')[1];

  return productHelper.getProductsinLocationNotZone(locId).then(productList => {
    // format zone details
    const zoneDetails = {};
    zoneDetails.id = 'Default';
    zoneDetails.code = 'Default';
    zoneDetails.name = 'Default';
    zoneDetails.productList = [];
    // console.log(productList);
    zoneDetails.productList =
      productList.map(product =>
        // format product details
        ({
          id: product.id,
          code: product.code,
          name: product.name,
          things: product.things
        })
      ) || [];
    // add zone to response zone list
    response.zones.push(zoneDetails);
    return bluebirdPromise.resolve(response);
  });
};

module.exports = new floorService();
