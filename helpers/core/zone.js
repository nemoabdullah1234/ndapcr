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
const thingHelper = require('../../helpers/things');
const clientHandler = require('../../lib/clientHandler');
const currentUserHandler = require('../../lib/currentUserHandler');
const producttrackingmodel = require('../../models/productTracking');

const typemap = {
  radius: 'number'
};

const zoneService = function() {};

/**
 * Set client of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
zoneService.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

zoneService.prototype.isDuplicate = function(field, value = '', excludedObjId = null) {
  let conditions = {};
  conditions[field] = value;
  if (excludedObjId !== null && mongoose.Types.ObjectId.isValid(excludedObjId)) {
    conditions._id = {
      $ne: mongoose.Types.ObjectId(excludedObjId)
    };
  }
  conditions.type = 'zone';
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
zoneService.prototype.get = function(filterparams, otherparams) {
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
zoneService.prototype.commonValidations = function(event) {
  return bluebirdPromise
    .all([
      bluebirdPromise.all([
        validator.required(event.body.code),
        validator.stringLength(0, validator.CODE_MAX_LENGTH, event.body.code),
        validator.notDuplicate(
          'zones',
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
        validator.type('array', event.body.categories),
        validator.duplicateArrayElements(null, event.body.categories),
        validator.validatePopulatableLists('categories', event.body.categories),
        validator.arrayOfType('string', event.body.categories)
      ]),
      bluebirdPromise.all([
        validator.required(event.body.parent),
        validator.type('string', event.body.parent),
        validator.validateParent('floors', event.body.parent, event.pathParameters.id)
      ]),
      bluebirdPromise.all([
        validator.type('array', event.body.attributes),
        validator.arrayOfType('object', event.body.attributes),
        validator.validatePopulatableLists('attributes', event.body.attributes),
        validator.duplicateArrayElements('id', event.body.attributes)
      ]),
      bluebirdPromise.all([validator.type('object', event.body.coordinates)]),
      bluebirdPromise.all([
        validator.required((event.body.coordinates || {}).latitude),
        validator.type('number', (event.body.coordinates || {}).latitude),
        validator.range(-90, 90, (event.body.coordinates || {}).latitude)
      ]),
      bluebirdPromise.all([
        validator.required((event.body.coordinates || {}).longitude),
        validator.type('number', (event.body.coordinates || {}).longitude),
        validator.range(-180, 180, (event.body.coordinates || {}).longitude)
      ]),
      bluebirdPromise.all([
        validator.required(event.body.radius),
        validator.type('number', event.body.radius),
        validator.nonNegative(event.body.radius)
      ]),
      bluebirdPromise.all([
        validator.type('array', event.body.things),
        validator.duplicateArrayElements(null, event.body.things),
        validator.validatePopulatableLists('things', event.body.things, event.pathParameters.id),
        validator.arrayOfType('string', event.body.things)
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
          fieldName: 'Categories'
        },
        parent: {
          index: 5,
          fieldName: 'Floor'
        },
        attributes: {
          index: 6,
          fieldName: 'Attributes'
        },
        coordinates: {
          index: 7,
          fieldName: 'Coordinates'
        },
        'coordinates.latitude': {
          index: 8,
          fieldName: 'Latitude'
        },
        'coordinates.longitude': {
          index: 9,
          fieldName: 'Longitude'
        },
        radius: {
          index: 10,
          fieldName: 'Radius'
        },
        things: {
          index: 11,
          fieldName: 'Things'
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
zoneService.prototype.getParentObject = function(idToGet, selfId) {
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
zoneService.prototype.getById = function(locationId = '', moveSysAttributes = true) {
  if (!mongoose.Types.ObjectId.isValid(locationId)) {
    return bluebirdPromise.reject();
  }
  let conditions = {
    _id: locationId
  };
  conditions.type = 'zone';
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
zoneService.prototype.isDuplicateCode = function(code = '', excludedObjId = null, floorId = '') {
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
  if (mongoose.Types.ObjectId.isValid(floorId)) {
    conditions.parent = floorId;
  }
  conditions.type = 'zone';
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
zoneService.prototype.save = function(event) {
  return bluebirdPromise
    .all([
      tagHelper.getForPopulation(event.body.tags),
      categoryHelper.getForPopulation(event.body.categories),
      attributeHelper.getForPopulation(event.body.attributes),
      commonHelper.populateSystemAttributes('zoneSysDefinedAttrs', event),
      commonHelper.getAncestors('floors', event.body.parent),
      thingHelper.getForPopulation(event.body.things)
    ])
    .then(populations => {
      const locationObj = new locationmodel(); // create a new instance of the  model
      locationObj.code = event.body.code;
      locationObj.name = event.body.name;
      locationObj.type = 'zone';
      locationObj.pointCoordinates = {
        type: 'Point',
        coordinates: [event.body.coordinates.longitude, event.body.coordinates.latitude]
      };
      locationObj.perimeter = commonHelper.getPolygonGeoJSONObj(
        event.body.coordinates.latitude,
        event.body.coordinates.longitude,
        event.body.radius
      );
      locationObj.sysDefined = 0;
      locationObj.status = event.body.status;
      locationObj.categories = populations[1];
      locationObj.updatedOn = Date.now();
      locationObj.updatedBy = currentUserHandler.getCurrentUser();
      locationObj.seoName = commonHelper.generateSlug(event.body.name);
      locationObj.parent = event.body.parent;
      locationObj.client = clientHandler.getClient();
      locationObj.tags = populations[0];
      locationObj.attributes = [...populations[2], ...populations[3]];
      locationObj.ancestors = populations[4];
      locationObj.things = populations[5];
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
zoneService.prototype.update = function(event) {
  let resultLocation;
  let conditions = {
    _id: event.pathParameters.id
  };
  conditions.type = 'zone';
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return bluebirdPromise
    .all([
      tagHelper.getForPopulation(event.body.tags),
      categoryHelper.getForPopulation(event.body.categories),
      attributeHelper.getForPopulation(event.body.attributes),
      commonHelper.populateSystemAttributes('zoneSysDefinedAttrs', event),
      commonHelper.getAncestors('floors', event.body.parent),
      thingHelper.getForPopulation(event.body.things)
    ])
    .then(populations => {
      const locationObj = {}; // create a new instance of the  model
      locationObj.code = event.body.code;
      locationObj.name = event.body.name;
      locationObj.type = 'zone';
      locationObj.pointCoordinates = {
        type: 'Point',
        coordinates: [event.body.coordinates.longitude, event.body.coordinates.latitude]
      };
      locationObj.perimeter = commonHelper.getPolygonGeoJSONObj(
        event.body.coordinates.latitude,
        event.body.coordinates.longitude,
        event.body.radius
      );
      locationObj.sysDefined = 0;
      locationObj.status = event.body.status;
      locationObj.categories = populations[1];
      locationObj.updatedOn = Date.now();
      locationObj.updatedBy = currentUserHandler.getCurrentUser();
      locationObj.seoName = commonHelper.generateSlug(event.body.name);
      locationObj.parent = event.body.parent;
      locationObj.client = clientHandler.getClient();
      locationObj.tags = populations[0];
      locationObj.attributes = [...populations[2], ...populations[3]];
      locationObj.ancestors = populations[4];
      locationObj.things = populations[5];
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
zoneService.prototype.updateDependentEntities = function(sourceObj) {
  return commonHelper.updateChildren('location', sourceObj);
};

/**
 * Performs update-specific validations before performing common validations.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
zoneService.prototype.validateUpdate = function(event) {
  let basicErrors;
  return this.commonValidations(event)
    .catch(errors => errors)
    .then(errorsIfAny => {
      basicErrors = errorsIfAny || {};
      return bluebirdPromise.all([
        bluebirdPromise.all([
          validator.elementExists('zones', event.pathParameters.id),
          validator.deactivationCheck('zones', event.body.status, event.pathParameters.id)
        ]),
        bluebirdPromise.all([
          validator.checkSame('zones', 'code', event.body.code, event.pathParameters.id)
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
          akUtils.getObjectValues(akUtils.sortErrorsObject(combinedErrors, 'zones'))
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
zoneService.prototype.validateFloor = function(parentId, floorId) {
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
zoneService.prototype.validateRequest = function(event) {
  return this.commonValidations(event)
    .then(() => {})
    .catch(errors => {
      if (!jsTypeChecker.isEmptyObject(errors)) {
        return bluebirdPromise.reject(
          akUtils.getObjectValues(akUtils.sortErrorsObject(errors, 'zones'))
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
zoneService.prototype.count = function(searchParams = {}) {
  return locationmodel.count(searchParams).exec();
};

/**
 * Generate the search conditions for the GET operation.
 * 
 * @param {Object} event Lambda Event
 * @return {Object} filters.
 * 
 */
zoneService.prototype.getFilterParams = function(event) {
  // get filter params from url
  let filters = {};
  filters.type = 'zone';

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

  if (event.queryStringParameters.floor) {
    filters.parent = event.queryStringParameters.floor;
  }

  if (event.queryStringParameters.location) {
    filters.ancestors = [];
    filters.ancestors[0] = {};
    filters.ancestors[0].id = event.queryStringParameters.location;
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

  if (event.queryStringParameters['things.code']) {
    filters['things.code'] = {};
    filters['things.code'].$in = event.queryStringParameters['things.code'].split(',');
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
zoneService.prototype.getExtraParams = function(event) {
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
        col = 'ancestors.1.name';
      }

      if (col === 'floor') {
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
zoneService.prototype.formatResponse = function(
  data,
  isDropdown = false,
  moveSysAttributes = true
) {
  const formattedResponse = {};
  if (!isDropdown) {
    formattedResponse.id = data._id;
    formattedResponse.code = data.code;
    formattedResponse.name = data.name;

    if (data.pointCoordinates) {
      formattedResponse.coordinates = {};
      formattedResponse.coordinates.latitude = data.pointCoordinates.coordinates[1];
      formattedResponse.coordinates.longitude = data.pointCoordinates.coordinates[0];
    }
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
    formattedResponse.categories = data.categories;
    formattedResponse.attributes = data.attributes;
    formattedResponse.ancestors = data.ancestors;
    formattedResponse.things = data.things || [];
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
zoneService.prototype.getFloorsList = function() {
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
          response.push(this.formatResponse(location, false, true));
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
zoneService.prototype.getFloorByLocId = function(locId = '') {
  if (!mongoose.Types.ObjectId.isValid(locId)) {
    return bluebirdPromise.reject();
  }
  let conditions = {};
  conditions._id = locId;
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return locationmodel
    .findOne(conditions, {
      'floors.id': 1,
      'floors.name': 1,
      name: 1
    })
    .exec()
    .then(result => {
      if (result) {
        result.floors.push({
          name: 'Default',
          id: `default.${locId}`
        });
        return bluebirdPromise.resolve(this.formatResponse(result, false, false));
      }
      return bluebirdPromise.reject();
    });
};

/**
 * Get zones on a floor represented by floorId
 * 
 * @param {string} [floorId=''] 
 * @returns 
 */
zoneService.prototype.getZonesonFloor = function(floorId = '') {
  let conditions = {
    'floorMapDetails.floorId': floorId
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
 * Get floors associated with a specific location
 * 
 * @param {string} [parentId=''] 
 * @returns 
 */
zoneService.prototype.getByParentId = function(parentId = '') {
  if (!mongoose.Types.ObjectId.isValid(parentId)) {
    return bluebirdPromise.reject();
  }
  let conditions = {};
  conditions.parent = parentId;
  conditions.type = 'zone';
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return locationmodel
    .find(conditions)
    .exec()
    .then(result => {
      if (result.length) {
        const resultList = [];
        for (const data of result) {
          resultList.push(this.formatResponse(data, false));
        }
        return bluebirdPromise.resolve(resultList);
      }
      return bluebirdPromise.reject();
    });
};

/**
 * Get List of Zones and products in them on a specific floor
 * 
 * @param {string} [floorId=''] 
 * @returns 
 */
zoneService.prototype.getZoneProductsOnFloor = function(floorId = '') {
  const productHelper = require('../product');
  const response = {};
  response.id = floorId;
  response.zones = [];

  if (floorId.indexOf('default') < 0) {
    // get zones on floor
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
            productList.forEach(product => {
              // format product details
              const productDetail = {};
              productDetail.id = product._id;
              productDetail.code = product.code;
              productDetail.name = product.name;
              productDetail.things = product.things;

              // add product to zone product list
              zoneDetails.productList.push(productDetail);
            });

            // add zone to response zone list
            response.zones.push(zoneDetails);
          });
        })
      )
      .then(() =>
        // return the response
        bluebirdPromise.resolve(response)
      );
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
    productList.forEach(product => {
      // format product details
      const productDetail = {};
      productDetail.id = product._id;
      productDetail.code = product.code;
      productDetail.name = product.name;
      productDetail.things = product.things;

      // add product to zone product list
      zoneDetails.productList.push(productDetail);
    });
    // add zone to response zone list
    response.zones.push(zoneDetails);
    return bluebirdPromise.resolve(response);
  });
};

zoneService.prototype.getProductsOnZone = function(event) {
  const zoneId = event.pathParameters.id;
  if (!mongoose.Types.ObjectId.isValid(zoneId)) {
    return bluebirdPromise.reject('invalid zone id');
  }
  let conditions = {};
  conditions = clientHandler.addClientFilterToConditions(conditions);
  // conditions.$and = [{ 'sensor.rng': { $exists: true } }, { 'sensor.rng': { $in: [1, 2, 3] } }];
  // conditions.$or = [
  //   { 'device.type': 'software', 'device.appName': 'gateway' },
  //   { 'device.type': 'gateway' }
  // ];
  conditions['sensor.code'] = { $nin: [/A[5-6][0-9][0-9]/] };
  conditions['currentLocation.zones.id'] = mongoose.Types.ObjectId(zoneId);
  const project = {
    sensor: 1,
    product: 1
  };
  return producttrackingmodel
    .find(conditions)
    .select(project)
    .collation({
      locale: 'en_US',
      caseLevel: false
    })
    .exec()
    .then(res =>
      bluebirdPromise.resolve(
        (res || [])
          .map(r => {
            (r.sensor || {}).rng = (r.sensor || {}).rng || 0;
            return r || 0;
          })
          .reduce((a, b) => {
            if (!a[b.sensor.rng]) {
              a[b.sensor.rng] = [];
            }
            a[b.sensor.rng].push(b.product);
            return a;
          }, {})
      )
    );
};
zoneService.prototype.getProductsOnZoneCount = function(event) {
  const zoneId = event.pathParameters.id;
  if (!mongoose.Types.ObjectId.isValid(zoneId)) {
    return bluebirdPromise.reject('invalid zone id');
  }
  let conditions = {};
  conditions['sensor.code'] = { $nin: [/A[5-6][0-9][0-9]/] };

  conditions = clientHandler.addClientFilterToConditions(conditions);
  // conditions.$and = [{ 'sensor.rng': { $exists: true } }, { 'sensor.rng': { $in: [1, 2, 3] } }];
  // conditions.$or = [
  //   { 'device.type': 'software', 'device.appName': 'gateway' },
  //   { 'device.type': 'gateway' }
  // ];

  conditions['currentLocation.zones.id'] = mongoose.Types.ObjectId(zoneId);
  return producttrackingmodel.count(conditions).exec();
};

module.exports = new zoneService();
