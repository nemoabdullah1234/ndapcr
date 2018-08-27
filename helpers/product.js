/* jshint esversion: 6 */

const productModel = require('../models/product');
const productTrackingModel = require('../models/productTracking');
const akngLocationHelper = require('../helpers/core/location');
const productThingAssignmentModel = require('../models/productThingAssignment');
const mongoose = require('mongoose');
const commonHelper = require('./common');
const bluebirdPromise = require('bluebird');
const validatorLib = require('../lib/validator');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');

const validations = {
  price: [
    {
      function: validatorLib.type,
      params: ['number'],
      fieldName: 'Price'
    }
  ],
  url: [
    {
      function: validatorLib.regex,
      params: [validatorLib.urlRegex],
      fieldName: 'URL'
    }
  ],
  videoUrl: [
    {
      function: validatorLib.regex,
      params: [validatorLib.urlRegex],
      fieldName: 'Video URL'
    }
  ]
};
const productDependent = {
  kollection: 'items.id',
  order: 'products.id',
  shipment: 'products.id',
  things: 'product.id'
};
const tagHelper = require('../helpers/tags');
const categoryHelper = require('../helpers/category');
const attributeHelper = require('../helpers/attribute');
const locationHelper = require('../helpers/core/location');
const floorHelper = require('../helpers/core/floor');
const zoneHelper = require('../helpers/core/zone');
const thingHelper = require('../helpers/things');
const validator = require('../lib/validatorAsync');
const akUtils = require('../lib/utility');
const jsTypeChecker = require('javascript-type-checker');

const typemap = {
  price: 'number'
};

const productHelper = function() {};

productHelper.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

/**
 * Performs save-specific validations before performing common validations.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
productHelper.prototype.validateRequest = function(event) {
  return this.commonValidations(event)
    .then(() => {})
    .catch(errors => {
      if (!jsTypeChecker.isEmptyObject(errors)) {
        return bluebirdPromise.reject(
          akUtils.getObjectValues(akUtils.sortErrorsObject(errors, 'products'))
        );
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
productHelper.prototype.isDuplicateCode = function(code = '', excludedObjId = null) {
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
  return productModel
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
 * Fetch the complete object from a parent ID if the ID corresponds to a valid parent
 * 
 * @param {String} idToGet ID of the requested Parent
 * @param {String} selfId ID of the object requesting the parent. Used to remove cyclic hierarchy.
 * @return {Promise} Promise to represent the result of save operation.
 * 
 */
productHelper.prototype.getParentObject = function(idToGet, selfId) {
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
  return productModel
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
productHelper.prototype.validateAndPopulateIds = function(event) {
  const commonHelper = require('./common');
  let errors = [];
  let tagNameList = [];
  let categoryIdList = [];
  let attributesList = [];
  let thingsList = [];
  let price = '';
  if (!Array.isArray(event.body.images)) {
    event.body.images = [];
  }
  if (event.body.price !== undefined && event.body.price !== null) {
    price = commonHelper.deepCloneObject(event.body.price);
  }
  if (event.body.things !== undefined && event.body.things !== null) {
    thingsList = commonHelper.deepCloneObject(event.body.things);
  }
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
  event.body.attributes = [];
  event.body.ancestors = [];
  event.body.categories = [];
  event.body.things = [];
  let parentProvided = true;
  if (!event.body.parent || event.body.parent === ' ') {
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
          message: 'A valid parent was not provided'
        });
      }
    })
    .then(() => commonHelper.getTagListFromNames(tagNameList, event))
    .then(list => {
      event.body.tags = list;
    })
    .catch(() => {})
    .then(() => commonHelper.getThingsListFromIds(thingsList, event))
    .then(list => {
      event.body.things = list;
    })
    .then(() => {
      if (!event.body.location) {
        return bluebirdPromise.reject('LOCATION_NOT_PROVIDED');
      }
      return akngLocationHelper.getById(event.body.location, false);
    })
    .then(locationData => {
      if (!event.body.zone) {
        return bluebirdPromise.resolve({
          location: locationData,
          zone: null
        });
      }
      let relevantZone;
      let zoneFound = false;
      for (let i = 0; i < locationData.floors.length; i++) {
        relevantZone = locationData.floors[i].zones.find(
          zone => `${zone.id}` === `${event.body.zone}`
        );
        if (relevantZone) {
          zoneFound = true;
          break;
        }
      }

      if (zoneFound) {
        return bluebirdPromise.resolve({
          location: locationData,
          zone: relevantZone
        });
      }
      return bluebirdPromise.reject('ZONE_NOT_FOUND_PRO');
    })
    .then(result => {
      event.body.location = result.location;
      event.body.zone = result.zone;
    })
    .catch(err => {
      if (err === 'ZONE_NOT_FOUND_PRO') {
        errors.push({
          code: 4000,
          message: 'Zone not found.'
        });
      } else if (err === 'LOCATION_NOT_PROVIDED') {
        errors.push({
          code: 4001,
          message: 'Location is mandatory.'
        });
      } else {
        errors.push({
          code: 4002,
          message: 'Location not found.'
        });
      }
    })
    .then(() => commonHelper.getCategoryListFromIds(categoryIdList, event))
    .then(list => {
      event.body.categories = list;
    })
    .catch(() => {
      errors.push({
        code: 2106,
        message: 'One or more categories do not exist.'
      });
    })
    .then(() => commonHelper.getAttributeListFromIds(attributesList, event))
    .then(list => {
      event.body.attributes = list;
    })
    .catch(() => {
      errors.push({
        code: 2107,
        message: 'One or more attributes do not exist.'
      });
    })
    .then(() => commonHelper.validateAndGetSystemAttributes('product_required', event, validations))
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
 * Performs basic validations which do not need to query other tables in the database.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of operation. Resolves the populated event. Rejects with the validation errors. 
 * 
 */
productHelper.prototype.validateBasics = function(event) {
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
  // if(!Array.isArray(event.body.images)) {
  //   errors.push({ code: 2008, message: 'Images is not an array' });
  // }
  errors = errors.concat(commonHelper.validateTags(event.body.tags));
  errors = errors.concat(commonHelper.validateCategories(event.body.categories));
  errors = errors.concat(commonHelper.validateAttributes(event.body.attributes));
  errors = errors.concat(commonHelper.validateThings(event.body.things));
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
 * Save a product
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of save operation.
 * 
 */
productHelper.prototype.save = function(event) {
  const actionTime = new Date();
  return bluebirdPromise
    .all([
      tagHelper.getForPopulation(event.body.tags),
      categoryHelper.getForPopulation(event.body.categories),
      attributeHelper.getForPopulation(event.body.attributes),
      commonHelper.populateSystemAttributes('product_required', event),
      thingHelper.getForPopulation(event.body.status === 0 ? [] : event.body.things),
      commonHelper.getAncestors('products', event.body.parent),
      commonHelper.populateSingleLocation(event.body.location),
      commonHelper.populateSingleFloor(event.body.floor),
      commonHelper.populateSingleZone(event.body.zone)
    ])
    .then(populations => {
      const productObj = new productModel(); // create a new instance of the  model
      productObj.code = event.body.code;
      productObj.name = event.body.name;
      productObj.sysDefined = 0;
      productObj.status = event.body.status;
      productObj.categories = populations[1];
      productObj.updatedOn = actionTime;
      if (populations[4].length) {
        productObj.lastThingsChangeOn = actionTime;
      }
      productObj.reusable = true;
      productObj.updatedBy = currentUserHandler.getCurrentUser();
      productObj.seoName = commonHelper.generateSlug(event.body.name);
      productObj.parent = event.body.parent;
      productObj.client = clientHandler.getClient();
      productObj.tags = populations[0];
      productObj.attributes = [...populations[2], ...populations[3]];
      productObj.ancestors = populations[5];
      productObj.things = populations[4];
      productObj.images = event.body.images;
      if (event.body.location) {
        productObj.location = populations[6];
      }
      if (event.body.floor) {
        productObj.location.floor = populations[7];
      }
      if (event.body.zone) {
        productObj.location.floor.zone = populations[8];
      }
      return productObj
        .save()
        .then(result => {
          const productSubDoc = {
            id: result._id,
            code: result.code,
            name: result.name
          };
          return bluebirdPromise
            .each(result.things, thing => {
              const productThingAssignmentObj = new productThingAssignmentModel();
              productThingAssignmentObj.associatedOn = actionTime;
              productThingAssignmentObj.disassociatedOn = null;
              productThingAssignmentObj.product = productSubDoc;
              productThingAssignmentObj.thing = thing;
              productThingAssignmentObj.client = clientHandler.getClient();
              productThingAssignmentObj.updatedBy = currentUserHandler.getCurrentUser();
              return productThingAssignmentObj.save();
            })
            .then(() => bluebirdPromise.resolve(result));
        })
        .then(product =>
          this.updateProductLocation(product).then(() => bluebirdPromise.resolve(product))
        );
    });
};

/**
 * Update Shipment initial location
 * 
 * @param {Object} shipmentobj Shipment Data
 * @param {Object} pointData Tracking Data null
 * @param {Object} currenLocation Location Object
 * @return {Promise} Promise after saving
 * 
 */
productHelper.prototype.updateProductLocation = function(
  productObj,
  pointData = null,
  currentLocation = {}
) {
  return productTrackingModel
    .findOne({
      'product.id': productObj._id
    })
    .then(productTrackingObj => {
      if (productTrackingObj === null) {
        productTrackingObj = new productTrackingModel();
        productTrackingObj.product = {
          id: productObj._id,
          code: productObj.code,
          name: productObj.name
        };
      }
      productTrackingObj.pointId = null;
      productTrackingObj.currentLocation = {};
      productTrackingObj.device = {};
      productTrackingObj.sensor = {};
      productTrackingObj.lastTracked = new Date();
      productTrackingObj.lastMoved = new Date();
      productTrackingObj.client = clientHandler.getClient();
      return productTrackingObj.save();
    });
};

/**
 * Fetch a particular product by providing its ID
 * 
 * @param {String} productId ID of the product to Fetch
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
productHelper.prototype.getById = function(productId = '') {
  // console.log(productId);
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return bluebirdPromise.reject();
  }
  return productModel
    .findOne({
      _id: productId
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
 * Performs response from DB operations to return as API response.
 * 
 * @param {Object} data Database operation result.
 * @param {Boolean} isDropdown Whether the APi is requesting a dropdown.
 * @return {Promise} formattedResponse Formatted Response
 * 
 */
productHelper.prototype.formatResponse = function(data, isDropdown = false) {
  // return data;
  const formattedResponse = {};
  if (!isDropdown) {
    formattedResponse.id = data._id;
    formattedResponse.code = data.code;
    formattedResponse.name = data.name;
    formattedResponse.sysDefined = data.sysDefined;
    formattedResponse.status = data.status;
    formattedResponse.images = data.images;

    formattedResponse.location = {};
    formattedResponse.floor = {};
    formattedResponse.zone = {};
    if (data.location) {
      formattedResponse.location = {
        id: data.location.id,
        name: data.location.name
      };
      if (data.location.floor) {
        formattedResponse.floor = {
          id: data.location.floor.id,
          name: data.location.floor.name
        };
      }
      if ((data.location.floor || {}).zone) {
        formattedResponse.zone = {
          id: data.location.floor.zone.id,
          name: data.location.floor.zone.name
        };
      }
    }
    formattedResponse.images = data.images;
    if (data.updatedBy) {
      formattedResponse.updatedBy = `${((data || {}).updatedBy || '').firstName} ${((data || {})
        .updatedBy || ''
      ).lastName}`;
    }
    formattedResponse.updatedOn = data.updatedOn;
    formattedResponse.client = data.client;
    formattedResponse.ancestors = data.ancestors;
    formattedResponse.tags = data.tags;
    formattedResponse.parent = data.parent || null;
    formattedResponse.seoName = data.seoName;
    formattedResponse.categories = data.categories;
    formattedResponse.attributes = data.attributes;
    formattedResponse.things = data.things;
    formattedResponse.currentLocation = data.currentLocation ? data.currentLocation : '';
    return commonHelper.moveSystemAttributesToGlobal(formattedResponse, typemap);
  }
  formattedResponse.id = data._id;
  formattedResponse.name = data.name;
  return formattedResponse;
};

/**
 * Performs update-specific validations before performing common validations.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
productHelper.prototype.validateUpdate = function(event) {
  let basicErrors;
  return this.commonValidations(event)
    .catch(errors => errors)
    .then(errorsIfAny => {
      basicErrors = errorsIfAny || {};
      return bluebirdPromise.all([
        bluebirdPromise.all([
          validator.elementExists('products', event.pathParameters.id),
          validator.deactivationCheck('products', event.body.status, event.pathParameters.id)
        ]),
        bluebirdPromise.all([
          validator.checkSame('products', 'code', event.body.code, event.pathParameters.id)
        ])
      ]);
    })
    .then(result => {
      const mapping = {
        global: {
          index: 0,
          fieldName: 'Product'
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
          akUtils.getObjectValues(akUtils.sortErrorsObject(combinedErrors, 'products'))
        );
      }
      return bluebirdPromise.resolve();
    })
    .catch(errors => bluebirdPromise.reject(errors));
};

/**
 * Performs common validations in both update and save.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
productHelper.prototype.commonValidations = function(event) {
  return bluebirdPromise
    .all([
      bluebirdPromise.all([
        validator.required(event.body.code),
        validator.stringLength(0, validator.CODE_MAX_LENGTH, event.body.code),
        validator.notDuplicate('products', 'code', event.body.code, event.pathParameters.id)
      ]),
      bluebirdPromise.all([
        validator.required(event.body.name),
        validator.stringLength(0, validator.NAME_MAX_LENGTH, event.body.name)
      ]),
      bluebirdPromise.all([validator.valueAllowed([0, 1], event.body.status)]),
      bluebirdPromise.all([
        validator.type('string', event.body.location),
        validator.requiredIfDependencyProvided(event.body.location, event.body.floor, 'Floor'),
        validator.validateLocation(event.body.location)
      ]),
      bluebirdPromise.all([
        validator.type('string', event.body.zone),
        validator.validateZone(event.body.zone, event.body.location)
      ]),
      bluebirdPromise.all([
        validator.type('array', event.body.things),
        validator.duplicateArrayElements(null, event.body.things),
        validator.validatePopulatableLists(
          'things',
          event.body.status === 0 ? [] : event.body.things,
          event.pathParameters.id
        ),
        validator.arrayOfType('string', event.body.things)
      ]),
      bluebirdPromise.all([
        validator.type('array', event.body.tags),
        validator.duplicateArrayElements(null, event.body.tags),
        validator.validatePopulatableLists('tags', event.body.tags),
        validator.arrayOfType('string', event.body.tags)
      ]),
      bluebirdPromise.all([
        validator.required(event.body.categories),
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
        validator.type('number', event.body.price),
        validator.nonNegative(event.body.price)
      ]),
      bluebirdPromise.all([
        validator.type('string', event.body.url),
        validator.regex(validator.urlRegex, event.body.url)
      ]),
      bluebirdPromise.all([
        validator.type('string', event.body.videoUrl),
        validator.regex(validator.urlRegex, event.body.videoUrl)
      ]),
      bluebirdPromise.all([validator.type('string', event.body.description)]),
      bluebirdPromise.all([
        validator.validateParent('products', event.body.parent, event.pathParameters.id)
      ]),
      bluebirdPromise.all([
        validator.type('string', event.body.floor),
        validator.requiredIfDependencyProvided(event.body.floor, event.body.zone, 'Zone'),
        validator.validateFloor(event.body.floor, event.body.location)
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
        location: {
          index: 3,
          fieldName: 'Location'
        },
        zone: {
          index: 4,
          fieldName: 'Zone'
        },
        things: {
          index: 5,
          fieldName: 'Things'
        },
        tags: {
          index: 6,
          fieldName: 'Tags'
        },
        categories: {
          index: 7,
          fieldName: 'Categories'
        },
        attributes: {
          index: 8,
          fieldName: 'Attributes'
        },
        price: {
          index: 9,
          fieldName: 'Price'
        },
        url: {
          index: 10,
          fieldName: 'URL'
        },
        videoUrl: {
          index: 11,
          fieldName: 'Video URL'
        },
        description: {
          index: 12,
          fieldName: 'Description'
        },
        parent: {
          index: 13,
          fieldName: 'Parent'
        },
        floor: {
          index: 14,
          fieldName: 'Floor'
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
 * Update a product
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of update operation.
 * 
 */
productHelper.prototype.update = function(event) {
  const actionTime = new Date();
  let removedThings = [];
  let addedThings = [];
  return bluebirdPromise
    .all([
      tagHelper.getForPopulation(event.body.tags),
      categoryHelper.getForPopulation(event.body.categories),
      attributeHelper.getForPopulation(event.body.attributes),
      commonHelper.populateSystemAttributes('product_required', event),
      thingHelper.getForPopulation(event.body.status === 0 ? [] : event.body.things),
      commonHelper.getAncestors('products', event.body.parent),
      commonHelper.populateSingleLocation(event.body.location),
      commonHelper.populateSingleFloor(event.body.floor),
      commonHelper.populateSingleZone(event.body.zone),
      this.getById(event.pathParameters.id)
    ])
    .then(populations => {
      const newThingIds = populations[4].map(x => `${x.id}`);
      const oldThingIds = populations[9].things.map(x => `${x.id}`);
      const unchangedThingIds = akUtils.getArrayIntersection(oldThingIds, newThingIds);

      let conditions = {
        _id: event.pathParameters.id
      };

      conditions = clientHandler.addClientFilterToConditions(conditions);
      const productUpdateObj = {};
      if (
        unchangedThingIds.length !== populations[4].length ||
        unchangedThingIds.length !== populations[9].things.length
      ) {
        productUpdateObj.lastThingsChangeOn = actionTime;
        removedThings = populations[9].things.filter(x =>
          new Set(akUtils.getArrayDifference(oldThingIds, unchangedThingIds)).has(`${x.id}`)
        );
        // addedThings = akUtils.getArrayDifference(newThingIds, unchangedThingIds)
        // let removedThingsIds = akUtils.getArrayDifference(oldThingIds)
        addedThings = populations[4].filter(x =>
          new Set(akUtils.getArrayDifference(newThingIds, unchangedThingIds)).has(`${x.id}`)
        );
      }
      productUpdateObj.code = event.body.code;
      productUpdateObj.name = event.body.name;
      productUpdateObj.sysDefined = 0;
      productUpdateObj.status = event.body.status;
      productUpdateObj.categories = populations[1];
      productUpdateObj.updatedOn = actionTime;
      productUpdateObj.reusable = true;
      productUpdateObj.updatedBy = currentUserHandler.getCurrentUser();
      productUpdateObj.parent = event.body.parent;
      productUpdateObj.seoName = commonHelper.generateSlug(event.body.name);
      productUpdateObj.ancestors = populations[5];
      productUpdateObj.tags = populations[0];
      productUpdateObj.attributes = [...populations[2], ...populations[3]];

      productUpdateObj.things = populations[4];

      productUpdateObj.images = event.body.images;
      if (event.body.location) {
        productUpdateObj.location = populations[6];
      }
      if (event.body.floor) {
        productUpdateObj.location.floor = populations[7];
      }
      if (event.body.zone) {
        productUpdateObj.location.floor.zone = populations[8];
      }
      const updateParams = {
        $set: productUpdateObj,
        $inc: {
          __v: 1
        }
      };

      return productModel
        .findOneAndUpdate(conditions, updateParams, {
          upsert: false,
          new: true
        })
        .exec()
        .then(() => this.getById(event.pathParameters.id));
    })
    .then(result => this.updateDependentEntities(result))
    .then(() => {
      const productSubDoc = {
        id: mongoose.Types.ObjectId(event.pathParameters.id),
        code: event.body.code,
        name: event.body.name
      };
      // console.log(addedThings);
      // console.log('addedThings');
      // console.log(removedThings);
      // console.log('removedThings');
      return bluebirdPromise.all([
        bluebirdPromise.each(addedThings, thing => {
          const productThingAssignmentObj = new productThingAssignmentModel();
          productThingAssignmentObj.associatedOn = actionTime;
          productThingAssignmentObj.disassociatedOn = null;
          productThingAssignmentObj.product = productSubDoc;
          productThingAssignmentObj.thing = thing;
          productThingAssignmentObj.client = clientHandler.getClient();
          productThingAssignmentObj.updatedBy = currentUserHandler.getCurrentUser();
          return productThingAssignmentObj.save();
        }),

        bluebirdPromise.each(removedThings, thing => {
          let conditions = {
            'product.id': productSubDoc.id,
            'thing.id': thing.id,
            disassociatedOn: null
          };
          conditions = clientHandler.addClientFilterToConditions(conditions);
          const updateObj = {
            $set: {
              disassociatedOn: actionTime,
              updatedBy: currentUserHandler.getCurrentUser()
            }
          };
          return productThingAssignmentModel.findOneAndUpdate(conditions, updateObj, {
            upsert: false
          });
        })
      ]);
    });
};

/**
 * Update children of a Collection.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
productHelper.prototype.updateDependentEntities = function(sourceObj) {
  return commonHelper.updateChildren('product', sourceObj);
};

/**
 * Query the database to fetch collections on the basis of search parameters and other parameters
 * 
 * @param {Object} searchParams search filters
 * @param {Object} otherParams pagination, sorting etc other params.
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
productHelper.prototype.get = function(filterparams, otherparams) {
  return productModel
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
 * Generate the search conditions for the GET operation.
 * 
 * @param {Object} event Lambda Event
 * @return {Object} filters.
 * 
 */
productHelper.prototype.getFilterParams = function(event) {
  // get filter params from url
  let filters = {};
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
        'ancestors.0.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'categories.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'things.name': new RegExp(event.queryStringParameters.filter, 'i')
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

  if (event.queryStringParameters.category) {
    // filters.categories = {};
    // filters.categories.id = event.queryStringParameters.category;

    filters['categories.id'] = {
      $in: event.queryStringParameters.category.split(',').map(x => mongoose.Types.ObjectId(x))
    };
  }

  if (event.queryStringParameters.thing) {
    filters.thing = {};
    filters.things.id = event.queryStringParameters.thing;
  }

  if (event.queryStringParameters.parent) {
    filters.parent = event.queryStringParameters.parent;
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

  // // console.log(filters);

  return filters;
};

/**
 * Generate the extra parameters for the GET operation like sorting, pagination etc.
 * 
 * @param {Object} request Lambda Event
 * @return {Object} extraParams
 * 
 */
productHelper.prototype.getExtraParams = function(event) {
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
 * Count products on the basis of some search conditions.
 * 
 * @param {Object} searchParams Search Conditions
 * @return {Promise<Number>} Number of matching products.
 * 
 */
productHelper.prototype.count = function(searchParams = {}) {
  return productModel.count(searchParams).exec();
};

/**
 * Get products list that can be associated with an order
 * 
 * @param {any} filterparams 
 * @param {any} otherparams 
 * @returns 
 */
productHelper.prototype.getProductForOrder = function(filterparams, otherparams) {
  filterparams.things = {
    $gt: []
  };
  const project = {
    _id: 1,
    code: 1,
    name: 1,
    things: 1
  };
  return productModel
    .find(filterparams)
    .sort(otherparams.sort)
    .select(project)
    .collation({
      locale: 'en_US',
      caseLevel: false
    })
    .exec()
    .then(result => {
      const list = [];
      if (result) {
        const products = [];
        result.forEach(product => {
          products.push(mongoose.Types.ObjectId(product.id));
        });
        return productTrackingModel
          .find({ 'product.id': { $in: products } })
          .exec()
          .then(productLocations => {
            const pl = productLocations.reduce((initial, current) => {
              initial[`${current.product.id}`] = current.currentLocation;
              return initial;
            }, {});
            result.forEach(product => {
              product.currentLocation = pl[`${product.id}`];
              list.push(this.formatResponse(product, otherparams.isDropdown));
            });
            return list;
          });
      }
      // const list = [];
      // if (result) {
      //   for (let i = 0; i < result.length; i++) {
      //     list.push(this.formatResponse(result[i], otherparams.isDropdown));
      //   }
      // }
      // return list;
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    })
    .catch(err => 
      // console.log(err);
       bluebirdPromise.reject(err)
    );
};

/**
 * get the list of products in a specific zone.
 * 
 * @param {String} zoneId zoneId
 * @return {Promise} List of products in the zone
 * 
 */
productHelper.prototype.getProductsinZone = function(zoneId = '') {
  if (!mongoose.Types.ObjectId.isValid(zoneId)) {
    return bluebirdPromise.reject();
  }
  let conditions = {
    'currentLocation.zones.id': zoneId
  };
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return productTrackingModel
    .find(conditions)
    .exec()
    .then(productList => {
      productList = commonHelper.deepCloneObject(productList);
      // console.log(productList);
      const prList = [];
      return bluebirdPromise
        .map(productList, record =>
          this.getById(record.product.id)
            .then(product => {
              product = commonHelper.deepCloneObject(product);
              return this.getThingList(product.things || []).then(res => {
                product.things = res;
                record.product = product;
                return record;
                // prList.push(record);
              });
            })
            .catch(err => {
              // console.log('error here:' + err);
            })
        )
        .then(res => bluebirdPromise.resolve(
            res.filter(record => record).map(record => record.product)
          ))
        .catch(err => {
          // console.log('error:' + err);
        });
    });
};
/**
 * Fetch products specific to location
 * 
 * @param {string} [locId=''] 
 * @returns 
 */
productHelper.prototype.getProductsinLocationNotZone = function(locId = '') {
  if (!mongoose.Types.ObjectId.isValid(locId)) {
    return bluebirdPromise.reject();
  }
  let conditions = {
    $and: [
      {
        'currentLocation.id': locId
      },
      {
        'currentLocation.zones.id': {
          $exists: false
        }
      }
    ]
  };
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return productTrackingModel
    .find(conditions)
    .exec()
    .then(productList => {
      productList = commonHelper.deepCloneObject(productList);
      const prList = [];
      return bluebirdPromise
        .each(productList, record =>
          this.getById(record.product.id).then(product => {
            product = commonHelper.deepCloneObject(product);
            return this.getThingList(product.things || []).then(res => {
              product.things = res;
              record.product = product;
              prList.push(record);
            });
          })
        )
        .then(() => bluebirdPromise.resolve(productList.map(record => record.product)));
    });
};
/**
 * Fetch things list from Data Base
 * 
 * @param {Array} thinglist 
 * @returns 
 */

productHelper.prototype.getThingList = function(thinglist) {
  const thingHelper = require('./things');
  const thingArray = [];
  return bluebirdPromise
    .each(thinglist, thing =>
      thingHelper.getById(thing.id).then(th => {
        const formattedThing = {};
        formattedThing.id = th.id;
        formattedThing.code = th.code;
        formattedThing.name = th.name;
        formattedThing.uuid = th.uuid;
        formattedThing.major = th.major;
        formattedThing.minor = th.minor;
        formattedThing.type = th.type;
        thingArray.push(formattedThing);
      })
    )
    .then(() => bluebirdPromise.resolve(thingArray));
};
productHelper.prototype.validateInactive = function(productid = '') {
  const modelpath = '../models/';

  const keys = Object.keys(productDependent);
  // console.log(keys);
  return bluebirdPromise
    .map(keys, key => {
      // console.log(`in 1${key}`);
      const model = require(modelpath + key.split('.')[0]);
      const condition = productDependent[key];
      const dict = {};
      dict[condition] = productid;
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

productHelper.prototype.isDuplicate = function(field, value = '', excludedObjId = null) {
  let conditions = {};
  conditions[field] = value;
  if (excludedObjId !== null && mongoose.Types.ObjectId.isValid(excludedObjId)) {
    conditions._id = {
      $ne: mongoose.Types.ObjectId(excludedObjId)
    };
  }
  conditions = clientHandler.addClientFilterToConditions(conditions);

  return productModel
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
 * Fetch a particular product by providing its ID
 * 
 * @param {String} productId ID of the product to Fetch
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
productHelper.prototype.getProductInventory = function(productId = '') {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return bluebirdPromise.reject();
  }
  const objProductId = mongoose.Types.ObjectId(productId);
  const conditions = { $or: [{ _id: objProductId }, { parent: productId }] };
  return productModel
    .aggregate()
    .lookup({
      from: 'producttrackings',
      localField: '_id',
      foreignField: 'product.id',
      as: 'currentLocation'
    })
    .match(conditions)
    .exec()
    .then(result => {
      // console.log(result);
      if ((result || []).length === 0) {
        return bluebirdPromise.reject({});
      }
      const response = {};
      response.productDetails = result.filter(res => `${res._id}` === `${productId}`).map(prod => {
        const currentLocationData = ((prod.currentLocation || [])[0] || {}).currentLocation;
        const temp = {};
        prod = this.formatResponse(prod);
        temp.skuId = prod.id || '';
        temp.code = prod.code || '';
        temp.name = prod.name || '';
        temp.url = prod.url || '';
        temp.category = (prod.categories || []).map(x => x.name).join(', ') || '';
        temp.images = (prod.images || []).map(image => {
          const temp = {};
          temp.full = image.url || '';
          temp.thumb = image.url || '';
          return temp;
        });
        temp.haveChild = 0;
        temp.things = prod.things || [];
        temp.currentLocation = commonHelper.getCurrentLocationString(currentLocationData || {});
        return temp;
      })[0];
      response.items = result.filter(res => `${res.parent}` === `${productId}`).map(prod => {
        prod = this.formatResponse(prod);
        return {
          productId: prod.id,
          skuId: (response.productDetails || {}).skuId || '',
          code: prod.code || '',
          name: prod.name || '',
          things: prod.things || [],
          quantity: 1,
          usedQuantity: 0,
          children: []
        };
      });
      if ((response.items || []).length > 0) {
        (response.productDetails || {}).haveChild = 1;
      }
      return bluebirdPromise.resolve(response);
      // if (result) {
      //   return bluebirdPromise.resolve(this.formatResponse(result));
      // } else {
      //   return bluebirdPromise.reject();
      // }
    });
};

productHelper.prototype.getProductInventoryByThingUid = function(thingUid, thingType) {
  return thingHelper.getThingByUid(thingUid, thingType).then(thingData =>
    productModel
      .findOne(
        clientHandler.addClientFilterToConditions({
          'things.id': mongoose.Types.ObjectId(thingData.id)
        })
      )
      .exec()
      .then(result => {
        if (!result) {
          return bluebirdPromise.reject({});
        }
        return this.getProductInventory(`${result._id}`);
      })
  );
};

module.exports = new productHelper();
