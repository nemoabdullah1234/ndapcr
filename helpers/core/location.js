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

const locationService = function() {};

/**
 * Set client of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
locationService.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

locationService.prototype.isDuplicate = function(field, value = '', excludedObjId = null) {
  let conditions = {};
  conditions[field] = value;
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
locationService.prototype.get = function(filterparams, otherparams) {
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
    })
    .catch(err => {
      // console.log(err);
    });
};

/**
 * Performs validations common in both update and save.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
locationService.prototype.commonValidations = function(event) {
  return bluebirdPromise
    .all([
      bluebirdPromise.all([
        validator.required(event.body.code),
        validator.stringLength(0, validator.CODE_MAX_LENGTH, event.body.code),
        validator.notDuplicate('locations', 'code', event.body.code, event.pathParameters.id)
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
        validator.validateParent('locations', event.body.parent, event.pathParameters.id)
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
        validator.required(event.body.address),
        validator.type('string', event.body.address)
      ]),
      bluebirdPromise.all([
        validator.required(event.body.city),
        validator.type('string', event.body.city)
      ]),
      bluebirdPromise.all([
        validator.required(event.body.state),
        validator.type('string', event.body.state)
      ]),
      bluebirdPromise.all([
        validator.required(event.body.country),
        validator.type('string', event.body.country)
      ]),
      bluebirdPromise.all([
        validator.required(event.body.zipcode),
        validator.type('string', event.body.zipcode)
      ]),
      bluebirdPromise.all([
        validator.required(event.body.radius),
        validator.type('number', event.body.radius),
        validator.nonNegative(event.body.radius)
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
          fieldName: 'Parent'
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
        address: {
          index: 10,
          fieldName: 'Address'
        },
        city: {
          index: 11,
          fieldName: 'City'
        },
        state: {
          index: 12,
          fieldName: 'State'
        },
        country: {
          index: 13,
          fieldName: 'Country'
        },
        zipcode: {
          index: 14,
          fieldName: 'ZIP Code'
        },
        radius: {
          index: 15,
          fieldName: 'Radius'
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
locationService.prototype.getParentObject = function(idToGet, selfId) {
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
locationService.prototype.getById = function(locationId = '', moveSysAttributes = true) {
  if (!mongoose.Types.ObjectId.isValid(locationId)) {
    return bluebirdPromise.reject();
  }
  let conditions = {
    _id: locationId
  };
  conditions.type = 'location';
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
locationService.prototype.isDuplicateCode = function(code = '', excludedObjId = null) {
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
  conditions.type = 'location';
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
locationService.prototype.save = function(event) {
  return bluebirdPromise
    .all([
      tagHelper.getForPopulation(event.body.tags),
      categoryHelper.getForPopulation(event.body.categories),
      attributeHelper.getForPopulation(event.body.attributes),
      commonHelper.populateSystemAttributes('locationSysDefinedAttrs', event),
      commonHelper.getAncestors('locations', event.body.parent)
    ])
    .then(populations => {
      const locationObj = new locationmodel(); // create a new instance of the  model
      locationObj.code = event.body.code;
      locationObj.name = event.body.name;
      locationObj.type = 'location';
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
locationService.prototype.update = function(event) {
  let resultLocation;
  let conditions = {
    _id: event.pathParameters.id
  };
  conditions.type = 'location';
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return bluebirdPromise
    .all([
      tagHelper.getForPopulation(event.body.tags),
      categoryHelper.getForPopulation(event.body.categories),
      attributeHelper.getForPopulation(event.body.attributes),
      commonHelper.populateSystemAttributes('locationSysDefinedAttrs', event),
      commonHelper.getAncestors('locations', event.body.parent)
    ])
    .then(populations => {
      const locationObj = {}; // create a new instance of the  model
      locationObj.code = event.body.code;
      locationObj.name = event.body.name;
      locationObj.type = 'location';
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
locationService.prototype.updateDependentEntities = function(sourceObj) {
  return commonHelper.updateChildren('location', sourceObj);
};

/**
 * Performs update-specific validations before performing common validations.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
locationService.prototype.validateUpdate = function(event) {
  let basicErrors;
  return this.commonValidations(event)
    .catch(errors => errors)
    .then(errorsIfAny => {
      basicErrors = errorsIfAny || {};
      return bluebirdPromise.all([
        bluebirdPromise.all([
          validator.elementExists('locations', event.pathParameters.id),
          validator.deactivationCheck('locations', event.body.status, event.pathParameters.id)
        ]),
        bluebirdPromise.all([
          validator.checkSame('locations', 'code', event.body.code, event.pathParameters.id)
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
          akUtils.getObjectValues(akUtils.sortErrorsObject(combinedErrors, 'locations'))
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
locationService.prototype.validateFloor = function(parentId, floorId) {
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
locationService.prototype.validateRequest = function(event) {
  return this.commonValidations(event)
    .then(() => {})
    .catch(errors => {
      if (!jsTypeChecker.isEmptyObject(errors)) {
        return bluebirdPromise.reject(
          akUtils.getObjectValues(akUtils.sortErrorsObject(errors, 'locations'))
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
locationService.prototype.count = function(searchParams = {}) {
  return locationmodel.count(searchParams).exec();
};

/**
 * Generate the search conditions for the GET operation.
 * 
 * @param {Object} event Lambda Event
 * @return {Object} filters.
 * 
 */
locationService.prototype.getFilterParams = function(event) {
  // get filter params from url
  let filters = {};
  filters.type = 'location';

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
locationService.prototype.getExtraParams = function(event) {
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
 * Performs response from DB operations to return as API response.
 * 
 * @param {Object} data Database operation result.
 * @param {Boolean} isDropdown Whether the APi is requesting a dropdown.
 * @return {Promise} formattedResponse Formatted Response
 * 
 */
locationService.prototype.formatResponse = function(
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
    formattedResponse.perimeter = data.perimeter;
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
locationService.prototype.getFloorsList = function() {
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
locationService.prototype.getFloorByLocId = function(locId = '') {
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
locationService.prototype.getZonesonFloor = function(floorId = '') {
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
 * Get List of Zones and products in them on a specific floor
 * 
 * @param {string} [floorId=''] 
 * @returns 
 */
locationService.prototype.getZoneProductsOnFloor = function(floorId = '') {
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

locationService.prototype.getNearbyLocation = function(event) {
  const buildLocationObj = formattedLocationObj => {
    const locationData = [];
    locationData.push(formattedLocationObj.name);
    // locationData.push(formattedLocationObj.address);
    // locationData.push(formattedLocationObj.city);
    // locationData.push(formattedLocationObj.state);
    // locationData.push(formattedLocationObj.country);
    return {
      locationId: formattedLocationObj.id,
      address: locationData.join(', '),
      latitude: formattedLocationObj.coordinates.latitude,
      longitude: formattedLocationObj.coordinates.longitude
    };
  };

  return bluebirdPromise
    .all([
      this.getById(event.queryStringParameters.locationId).catch(() => null),
      this.getNearLocationForMobile(
        Number(event.queryStringParameters.latitude),
        Number(event.queryStringParameters.longitude)
      ),
      this.getFarLocationForMobile(
        Number(event.queryStringParameters.latitude),
        Number(event.queryStringParameters.longitude)
      )
    ])
    .then(result => {
      const resultObj = {
        current: [],
        near: [],
        other: []
      };
      const currentLocation = result[0];
      const nearLocations = result[1];
      const otherLocations = result[2];
      if (currentLocation) {
        resultObj.current = [];
        resultObj.current.push(buildLocationObj(currentLocation));
      } else if (nearLocations.length > 0) {
        resultObj.current.push(buildLocationObj(this.formatResponse(nearLocations[0])));
      }

      let nearLocationIdList = [];

      resultObj.near = nearLocations
        .map(location => this.formatResponse(location))
        .map(location => buildLocationObj(location));

      nearLocationIdList = new Set(nearLocations.map(x => `${x._id}`));

      resultObj.other = otherLocations
        .filter(x => !nearLocationIdList.has(`${x._id}`))
        .map(location => this.formatResponse(location))
        .map(location => buildLocationObj(location));

      return resultObj;
    });
};

locationService.prototype.getNearLocationForMobile = function(latitude, longitude) {
  let conditions = {};
  conditions.perimeter = {
    $geoIntersects: {
      $geometry: {
        type: 'Point',
        coordinates: [longitude, latitude]
      }
    }
  };
  conditions = clientHandler.addClientFilterToConditions(conditions);
  conditions.type = 'location';
  return locationmodel.aggregate([
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        spherical: true,
        distanceField: 'distance'
      }
    },
    {
      $match: conditions
    },
    {
      $project: {
        perimeter: 0
      }
    },
    {
      $sort: { distance: 1 }
    }
  ]);
};

locationService.prototype.getFarLocationForMobile = function(latitude, longitude) {
  let conditions = {};
  conditions.type = 'location';
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return locationmodel.aggregate([
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        spherical: true,
        distanceField: 'distance'
      }
    },
    {
      $match: conditions
    },
    {
      $project: {
        perimeter: 0
      }
    },
    {
      $sort: { distance: 1 }
    }
  ]);
};

locationService.prototype.getCurrentLocationForMobile = function(latitude, longitude) {
  let conditions = {};
  conditions.perimeter = {
    $geoIntersects: {
      $geometry: {
        type: 'Point',
        coordinates: [longitude, latitude]
      }
    }
  };
  conditions.type = 'location';
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return locationmodel.findOne(conditions);
};
module.exports = new locationService();
