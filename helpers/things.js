/* jshint esversion: 6 */

const thingModel = require('../models/things');
const commonHelper = require('./common');
const mongoose = require('mongoose');
const bluebirdPromise = require('bluebird');
const clientHandler = require('../lib/clientHandler');

const thingService = function thingService() {};
const validatorLib = require('../lib/validator');
const tagHelper = require('../helpers/tags');
const categoryHelper = require('../helpers/category');
const attributeHelper = require('../helpers/attribute');
const validator = require('../lib/validatorAsync');
const akUtils = require('../lib/utility');
const jsTypeChecker = require('javascript-type-checker');
const currentUserHandler = require('../lib/currentUserHandler');

const validations = {
  uuid: [
    {
      function: validatorLib.required,
      params: [],
      fieldName: 'UUID'
    }
  ],
  major: [
    {
      function: validatorLib.required,
      params: [],
      fieldName: 'Major'
    },
    {
      function: validatorLib.type,
      params: ['number'],
      fieldName: 'Major'
    }
  ],
  minor: [
    {
      function: validatorLib.required,
      params: [],
      fieldName: 'Minor'
    },
    {
      function: validatorLib.type,
      params: ['number'],
      fieldName: 'Minor'
    }
  ],
  battery_level: [
    {
      function: validatorLib.type,
      params: ['number'],
      fieldName: 'Battery Level'
    }
  ],
  interval: [
    {
      function: validatorLib.type,
      params: ['number'],
      fieldName: 'Interval'
    }
  ],
  txPower: [
    {
      function: validatorLib.type,
      params: ['number'],
      fieldName: 'TX Power'
    }
  ]
};

const typemap = {
  battery_level: 'number',
  major: 'number',
  minor: 'number',
  interval: 'number',
  txPower: 'number'
};
const thingsDependent = {
  location: 'things.id',
  order: 'products.things.id',
  'product.1': 'things.id',
  'product.2': 'trackingDetails.currentLocation.zones.thing.id',
  'product.3': 'trackingDetails.device.id',
  'shipment.1': 'products.things.id',
  'shipment.2': 'products.trackingDetails.currentLocation.zones.thing',
  kollection: 'items.id'
};
/**
 * Fetch a particular thing by providing its ID
 * 
 * @param {String} thingId ID of the product to Fetch
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
thingService.prototype.getById = function(thingId = 'Default') {
  let conditions = {
    _id: mongoose.Types.ObjectId(thingId)
  };
  conditions = clientHandler.addClientFilterToConditions(conditions);

  return thingModel
    .findOne(conditions)
    .exec()
    .then(result => {
      if (result) {
        return bluebirdPromise.resolve(this.formatResponse(result));
      }
      // TODO:format response}
      return bluebirdPromise.reject();
    });
};
/**
 * Fetch a particular thing by providing its code
 * 
 * @param {String} code Code of the product to Fetch
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
thingService.prototype.getByCode = function(code = '') {
  return thingModel
    .findOne({
      code
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
 * Common client object to set 
 * 
 * @param {Object} clientObj Object of the client to set
 * @return {Void} 
 * 
 */
thingService.prototype.setClient = function(clientObj) {
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
thingService.prototype.get = function(filterparams, otherparams) {
  return thingModel
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
            // let i = result[j];
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
 * Query the database to fetch count on the basis of search parameters 
 * 
 * @param {Object} searchParams search filters
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
thingService.prototype.count = function(searchParams = {}) {
  return thingModel.count(searchParams).exec();
};

/**
 * Save a thing
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of save operation.
 * 
 */
thingService.prototype.save = function(event) {
  return bluebirdPromise
    .all([
      tagHelper.getForPopulation(event.body.tags),
      categoryHelper.getForPopulation(event.body.categories),
      attributeHelper.getForPopulation(event.body.attributes),
      commonHelper.populateSystemAttributes('thing_system_attributes', event)
    ])
    .then(populations => {
      const thingObj = new thingModel(); // create a new instance of the  model
      thingObj.code = event.body.code;
      thingObj.name = event.body.name;
      thingObj.status = event.body.status;
      thingObj.updatedOn = Date.now();
      thingObj.updatedBy = currentUserHandler.getCurrentUser();
      thingObj.client = clientHandler.getClient();
      thingObj.tags = populations[0];
      thingObj.attributes = [...populations[2], ...populations[3]];
      thingObj.categories = populations[1];
      thingObj.type = 'beacon';
      thingObj.product = event.body.product;

      return thingObj.save().then(result => this.markDuplicateThings('beacon', ['uuid', 'major', 'minor'])
          .then(() => {
            return bluebirdPromise.resolve(result);
          })
          .catch(err => {
            return bluebirdPromise.resolve(result);
          }));
    });
};

/**
 * Update a thing object 
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of update operation.
 * 
 */
thingService.prototype.update = function(event) {
  return bluebirdPromise
    .all([
      tagHelper.getForPopulation(event.body.tags),
      categoryHelper.getForPopulation(event.body.categories),
      attributeHelper.getForPopulation(event.body.attributes),
      commonHelper.populateSystemAttributes('thing_system_attributes', event)
    ])
    .then(populations => {
      let conditions = {
        _id: event.pathParameters.id
      };
      conditions = clientHandler.addClientFilterToConditions(conditions);
      const thingUpdateObj = {};
      thingUpdateObj.code = event.body.code;
      thingUpdateObj.name = event.body.name;
      thingUpdateObj.status = event.body.status;
      thingUpdateObj.updatedOn = Date.now();
      thingUpdateObj.updatedBy = currentUserHandler.getCurrentUser();
      thingUpdateObj.client = clientHandler.getClient();
      thingUpdateObj.tags = populations[0];
      thingUpdateObj.type = 'beacon';
      thingUpdateObj.attributes = [...populations[2], ...populations[3]];
      thingUpdateObj.categories = populations[1];
      // thingUpdateObj.product = event.body.product;
      const updateParams = {
        $set: thingUpdateObj,
        $inc: {
          __v: 1
        }
      };
      return thingModel
        .findOneAndUpdate(conditions, updateParams, {
          upsert: false,
          new: true
        })
        .exec();
    })
    .then(() => this.markDuplicateThings('beacon', ['uuid', 'major', 'minor']))
    .then(() => this.getById(event.pathParameters.id));
};

thingService.prototype.markDuplicateThings = function(thingType, uniqueIdentifierAttributes = []) {
  return this.extractDuplicateIdentifiers(thingType, uniqueIdentifierAttributes).then(duplicacies =>
    bluebirdPromise.map(duplicacies, duplicacyObj => {
      const elemMatchArray = Object.getOwnPropertyNames(
        duplicacyObj.valueSet
      ).reduce((result, item) => {
        result.push({
          $elemMatch: {
            name: item,
            value: duplicacyObj.valueSet[item],
            sysDefined: 1
          }
        });

        return result;
      }, []);
      return bluebirdPromise.all([
        thingModel.update(
          clientHandler.addClientFilterToConditions({
            type: thingType,
            attributes: {
              $all: elemMatchArray
            }
          }),
          { $set: { hasDuplicateUniqueIdentifiers: true } },
          { multi: true }
        ),

        thingModel.update(
          clientHandler.addClientFilterToConditions({
            type: thingType,
            attributes: {
              $not: { $all: elemMatchArray }
            }
          }),
          { $set: { hasDuplicateUniqueIdentifiers: false } },
          { multi: true }
        )
      ]);
    })
  );
};

thingService.prototype.extractDuplicateIdentifiers = function(
  thingType,
  uniqueIdentifierAttributes = []
) {
  // console.log('++++++++++');
  const uniqueAttrExtractQuery = [];

  const addFieldsQuery = {};
  const addFieldsQueryExtractValues = {};
  const groupQuery = {
    _id: {},
    count: {
      $sum: 1
    }
  };

  for (let i = 0; i < uniqueIdentifierAttributes.length; i++) {
    addFieldsQuery[uniqueIdentifierAttributes[i]] = {
      $filter: {
        input: `$attributes`,
        as: 'attribute',
        cond: {
          $and: [
            { $eq: ['$$attribute.sysDefined', 1] },
            { $eq: ['$$attribute.name', uniqueIdentifierAttributes[i]] }
          ]
        }
      }
    };

    addFieldsQueryExtractValues[uniqueIdentifierAttributes[i]] = {
      $arrayElemAt: [`$${uniqueIdentifierAttributes[i]}`, 0]
    };

    groupQuery._id[uniqueIdentifierAttributes[i]] = `$${uniqueIdentifierAttributes[i]}.value`;
  }
  uniqueAttrExtractQuery.push({ $addFields: addFieldsQuery });

  uniqueAttrExtractQuery.push({ $addFields: addFieldsQueryExtractValues });

  uniqueAttrExtractQuery.push({ $group: groupQuery });

  return thingModel
    .aggregate([
      {
        $match: clientHandler.addClientFilterToConditions({
          type: thingType
        })
      },
      ...uniqueAttrExtractQuery,
      {
        $match: {
          count: {
            $gt: 1
          }
        }
      }
    ])
    .exec()
    .then(result =>
      result.map(item => {
        // console.log(item);
        const resultItem = {};
        resultItem.valueSet = item._id;
        resultItem.count = item.count;
        return resultItem;
      })
    );
};

/**
 * Get filter parameters from event  
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of update operation.
 * 
 */
thingService.prototype.getFilterParams = function(event) {
  // get filter params from url
  let filters = {};
  filters = clientHandler.addClientFilterToConditions(filters);
  if (event.queryStringParameters.dd === '1') {
    filters.status = 1;
    if (event.queryStringParameters.allowAssociated !== '1') {
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
      },
      {
        attributes: {
          $elemMatch: { name: 'major', value: new RegExp(event.queryStringParameters.filter, 'i') }
        }
      },
      {
        attributes: {
          $elemMatch: { name: 'minor', value: new RegExp(event.queryStringParameters.filter, 'i') }
        }
      }
    ];
  }

  if (event.queryStringParameters.id) {
    filters._id = event.queryStringParameters.id;
  }

  if (event.queryStringParameters.isDuplicate === '0') {
    filters.hasDuplicateUniqueIdentifiers = false;
  }

  if (event.queryStringParameters.isDuplicate === '1') {
    filters.hasDuplicateUniqueIdentifiers = true;
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

  if (
    event.queryStringParameters.uuid ||
    event.queryStringParameters.major ||
    event.queryStringParameters.minor
  ) {
    filters.attributes = {};
    filters.attributes.$all = [];

    let idx = 0;
    if (event.queryStringParameters.uuid) {
      filters.attributes.$all[idx] = {
        $elemMatch: { name: 'uuid', value: new RegExp(event.queryStringParameters.uuid, 'i') }
      };
      idx++;
    }

    if (event.queryStringParameters.major) {
      filters.attributes.$all[idx] = {
        $elemMatch: { name: 'major', value: new RegExp(event.queryStringParameters.major, 'i') }
      };
      idx++;
    }

    if (event.queryStringParameters.minor) {
      filters.attributes.$all[idx] = {
        $elemMatch: { name: 'minor', value: new RegExp(event.queryStringParameters.minor, 'i') }
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
  filters.type = 'beacon';
  if (event.queryStringParameters.type) {
    filters.type = { $in: event.queryStringParameters.type.split(',') };
  }
  // // console.log(util.inspect(filters,true, null));
  // console.log(filters);

  return filters;
};
/**
 * Generate the extra parameters for the GET operation like sorting, pagination etc.
 * 
 * @param {Object} request Lambda Event
 * @return {Object} extraParams
 * 
 */
thingService.prototype.getExtraParams = function(event) {
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
 * Performs save-specific validations before performing common validations.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
thingService.prototype.validateUpdate = function(event) {
  let basicErrors;
  return this.commonValidations(event)
    .catch(errors => errors)
    .then(errorsIfAny => {
      basicErrors = errorsIfAny || {};
      return bluebirdPromise.all([
        bluebirdPromise.all([
          validator.elementExists('things', event.pathParameters.id),
          validator.deactivationCheck('things', event.body.status, event.pathParameters.id)
        ]),
        bluebirdPromise.all([
          validator.checkSame('things', 'code', event.body.code, event.pathParameters.id)
        ]),
        bluebirdPromise.all([
          validator.checkSame('things', 'txPower', event.body.txPower, event.pathParameters.id)
        ]),
        bluebirdPromise.all([
          validator.checkSame(
            'things',
            'battery_level',
            event.body.battery_level,
            event.pathParameters.id
          )
        ]),
        bluebirdPromise.all([
          validator.checkSame(
            'things',
            'last_connection',
            event.body.last_connection,
            event.pathParameters.id
          )
        ]),
        bluebirdPromise.all([
          validator.checkSame('things', 'interval', event.body.interval, event.pathParameters.id)
        ]),
        bluebirdPromise.all([
          validator.checkSame('things', 'major', event.body.major, event.pathParameters.id)
        ]),
        bluebirdPromise.all([
          validator.checkSame('things', 'minor', event.body.minor, event.pathParameters.id)
        ]),
        bluebirdPromise.all([
          validator.checkSame(
            'things',
            'manufacturer',
            event.body.manufacturer,
            event.pathParameters.id
          )
        ])
      ]);
    })
    .then(result => {
      const mapping = {
        global: {
          index: 0,
          fieldName: 'Beacon'
        },
        code: {
          index: 1,
          fieldName: 'Code'
        },
        txPower: {
          index: 2,
          fieldName: 'txPower'
        },
        batterylevel: {
          index: 3,
          fieldName: 'batterylevel'
        },
        lastconnection: {
          index: 4,
          fieldName: 'lastconnection'
        },
        interval: {
          index: 5,
          fieldName: 'interval'
        },
        major: {
          index: 5,
          fieldName: 'major'
        },
        minor: {
          index: 7,
          fieldName: 'minor'
        },
        manufacturer: {
          index: 8,
          fieldName: 'manufacturer'
        }
      };
      const validationResult = akUtils.mapAndGetValidationErrors(result, mapping);
      const combinedErrors = Object.assign({}, basicErrors, validationResult);
      if (!jsTypeChecker.isEmptyObject(combinedErrors)) {
        return bluebirdPromise.reject(
          akUtils.getObjectValues(akUtils.sortErrorsObject(combinedErrors, 'beacons'))
        );
      }
      return bluebirdPromise.resolve();
    })
    .catch(errors => bluebirdPromise.reject(errors));
};
/**
 * Performs response from DB operations to return as API response.
 * 
 * @param {Object} data Database operation result.
 * @param {Boolean} isDropdown Whether the APi is requesting a dropdown.
 * @return {Promise} formattedResponse Formatted Response
 * 
 */
thingService.prototype.formatResponse = function(data, isDropdown = false) {
  const formattedResponse = {};
  if (!isDropdown) {
    formattedResponse.id = data._id;
    formattedResponse.code = data.code;
    formattedResponse.name = data.name;
    formattedResponse.status = data.status;
    formattedResponse.type = data.type;
    formattedResponse.updatedOn = data.updatedOn;
    formattedResponse.updatedBy = `${((data || {}).updatedBy || '').firstName} ${((data || {})
      .updatedBy || ''
    ).lastName}`;
    formattedResponse.client = data.client;
    formattedResponse.tags = data.tags;
    formattedResponse.attributes = data.attributes;
    formattedResponse.categories = data.categories;
    formattedResponse.product = {};
    formattedResponse.location = {};
    formattedResponse.isDuplicate = data.hasDuplicateUniqueIdentifiers;
    if (data.product) {
      formattedResponse.product = data.product;
    }
    if (data.location) {
      formattedResponse.location = data.location;
    }

    return commonHelper.moveSystemAttributesToGlobal(formattedResponse, typemap);
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
thingService.prototype.validateRequest = function(event) {
  return this.commonValidations(event)
    .then(() => {})
    .catch(errors => {
      if (!jsTypeChecker.isEmptyObject(errors)) {
        return bluebirdPromise.reject(
          akUtils.getObjectValues(akUtils.sortErrorsObject(errors, 'beacons'))
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
thingService.prototype.commonValidations = function(event) {
  return bluebirdPromise
    .all([
      bluebirdPromise.all([
        validator.required(event.body.code),
        validator.stringLength(0, validator.CODE_MAX_LENGTH, event.body.code),
        validator.notDuplicate('things', 'code', event.body.code, event.pathParameters.id)
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
      ]),
      bluebirdPromise.all([
        validator.required(event.body.major),
        validator.type('number', event.body.major)
      ]),
      bluebirdPromise.all([
        validator.required(event.body.minor),
        validator.type('number', event.body.minor)
      ]),
      bluebirdPromise.all([validator.type('number', event.body.battery_level)]),
      bluebirdPromise.all([validator.type('number', event.body.interval)]),
      bluebirdPromise.all([validator.type('number', event.body.txPower)])
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
        },
        major: {
          index: 7,
          fieldName: 'Major'
        },
        minor: {
          index: 8,
          fieldName: 'Minor'
        },
        battery_level: {
          index: 9,
          fieldName: 'Battery Level'
        },
        interval: {
          index: 10,
          fieldName: 'Interval'
        },
        txPower: {
          index: 11,
          fieldName: 'TX Power'
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
 * Checks if a give code already exists in the database.
 * 
 * @param {String} code Code to check
 * @param {String} excludedObjId Object ID of current object if checking while update.
 * @return {Promise} Resolved promise if duplicate code. Rejected promise otherwise
 * 
 */
thingService.prototype.isDuplicateCode = function(code = '', excludedObjId = null) {
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
  return thingModel
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
 * Performs basic validations which do not need to query other tables in the database.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of operation. Resolves the populated event. Rejects with the validation errors. 
 * 
 */
thingService.prototype.validateBasics = function(event) {
  let errors = [];
  if (!event.body.code) {
    errors.push({
      code: 2001,
      message: 'Code is mandatory'
    });
  }
  if (!event.body.name) {
    errors.push({
      code: 2002,
      message: 'Name is mandatory'
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
 * Validate fields containing IDs of other DB Collections and populate their fields
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of operation. Resolves the populated event. Rejects with the validation errors. 
 * 
 */
thingService.prototype.validateAndPopulateIds = function(event) {
  const commonHelper = require('./common');
  let errors = [];
  let tagNameList = [];
  let categoryIdList = [];
  let attributesList = [];
  let product = '';
  if (event.body.tags !== undefined && event.body.tags !== null) {
    tagNameList = commonHelper.deepCloneObject(event.body.tags);
  }
  if (event.body.categories !== undefined && event.body.categories !== null) {
    categoryIdList = commonHelper.deepCloneObject(event.body.categories);
  }
  if (event.body.attributes !== undefined && event.body.attributes !== null) {
    attributesList = commonHelper.deepCloneObject(event.body.attributes);
  }
  product = event.body.product;
  event.body.tags = [];
  event.body.categories = [];
  event.body.attributes = [];
  event.body.product = {};
  event.body.type = 'beacon';
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
      commonHelper.validateAndGetSystemAttributes('thing_system_attributes', event, validations)
    )
    .then(list => {
      event.body.attributes = event.body.attributes.concat(list);
      // console.log(product);
      return commonHelper.getProductFromId(product);
      // return;
    })
    .then(product => {
      event.body.product = product;
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
 * Update or insert object if exsists used for syncing 
 * 
 * @param {Object} event 
 * @return {Promise} Promise to represent the result of operation. Resolves the populated event. Rejects with the validation errors. 
 * 
 */
thingService.prototype.updateorinsert = function(event) {
  let conditions = {
    code: event.body.code
  };
  conditions = clientHandler.addClientFilterToConditions(conditions);
  const thingUpdateObj = {};
  thingUpdateObj.code = event.body.code;
  thingUpdateObj.name = event.body.name;
  thingUpdateObj.status = event.body.status;
  thingUpdateObj.type = event.body.type;
  thingUpdateObj.updatedOn = Date.now();
  thingUpdateObj.updatedBy = currentUserHandler.getCurrentUser();
  thingUpdateObj.client = event.body.client;
  thingUpdateObj.tags = event.body.tags;
  thingUpdateObj.attributes = event.body.attributes;
  thingUpdateObj.categories = event.body.categories;
  // thingUpdateObj.product = event.body.product;
  const updateParams = {
    $set: thingUpdateObj
    // '$inc': { '__v': 1 }
  };
  return thingModel
    .findOneAndUpdate(conditions, updateParams, {
      upsert: true,
      new: true
    })
    .exec();
};
/**
 * Return things specific keys for tracking
 * 
 * @param {Array} things 
 * @return {Promise} Promise to represent the result of operation. Resolves the populated event. Rejects with the validation errors. 
 * 
 */
thingService.prototype.getFilterArrayThings = function(things = [], type = 'beacon') {
  if (typeof type === 'undefined') {
    type = 'beacon';
  }
  return bluebirdPromise
    .map(things, element => {
      const arryOfQuery = [];
      Object.getOwnPropertyNames(element).forEach(key => {
        let fldValue = element[key];
        if (typeof element[key] === 'string') {
          fldValue = new RegExp(element[key], 'i');
        }
        const query = {};
        query.attributes = {};
        query.attributes.$elemMatch = {
          name: key,
          value: fldValue
        };
        arryOfQuery.push(query);
      });
      if (!arryOfQuery.length) {
        arryOfQuery.push({ type });
      }
      const conditions = {
        $and: arryOfQuery,
        type
      };
      return thingModel
        .findOne(conditions)
        .exec()
        .then(result => {
          // console.log(`sdfsdfsdf${result}`);
          if (result !== null) {
            const thingObj = this.formatResponse(result);
            element.id = thingObj.id;
            element.name = thingObj.name;
            element.code = thingObj.code;
            // element.major = thingObj.major;
            // element.minor = thingObj.minor;
            // element.uuid = thingObj.uuid;
          } else {
            // element.major = element.major ? element.major : null;
            // element.minor = element.minor ? element.minor : null;
            // element.uuid = element.uuid ? element.uuid : null;
            element.id = null;
            element.name = null;
            element.code = null;
          }
          return element;
        });
    })
    .then(result => bluebirdPromise.resolve(result));
};
/**
 * Return things specific keys for tracking
 * 
 * @param {Array} things 
 * @return {Promise} Promise to represent the result of operation. Resolves the populated event. Rejects with the validation errors. 
 * 
 */
thingService.prototype.validateInput = function(event) {
  const errors = [];
  if (!event.body.things || !Array.isArray(event.body.things) || event.body.things.length === 0) {
    errors.push('No things to fetch');
  }

  if (errors.length > 0) {
    // console.log(errors);
    return bluebirdPromise.reject(errors);
  }
  return bluebirdPromise.resolve();
};
/**
 * Sync battery level of beacons 
 * 
 * @param {Object} response 
 * @return {Promise} Promise to represent the result of operation. Resolves the populated event. Rejects with the validation errors. 
 * 
 */
thingService.prototype.syncBatteryLevel = function(uniqueIdList) {
  let queryString = '';
  let iterator = 1;
  return bluebirdPromise
    .reduce(
      uniqueIdList,
      (queries, uniqueId) => {
        if (queryString.length > 0) {
          queryString = `${queryString},${uniqueId}`;
        } else {
          queryString = uniqueId;
        }

        if (iterator % parseInt(process.env.batteryfetchCount, 10) === 0) {
          queries.push(queryString);
          queryString = '';
        } else if (uniqueIdList.indexOf(uniqueId) === uniqueIdList.length - 1) {
          queries.push(queryString);
          queryString = '';
        }
        iterator += 1;
        return queries;
      },
      []
    )
    .then(queries => this.fetchBatteryLevel(queries));
};
/**
 * Fetc battery level of beacons 
 * 
 * @param {Object} queries 
 * @return {Promise} Promise to represent the result of operation. Resolves the populated event. Rejects with the validation errors. 
 * 
 */
thingService.prototype.fetchBatteryLevel = function(queries) {
  const axios = require('axios');
  const axiosObj = axios.create({
    baseURL: process.env.kontaktBaseUrl,
    headers: {
      'Api-Key': process.env.kontaktApiKey,
      Accept: 'application/vnd.com.kontakt+json; version=8'
    }
  });
  // // console.log(queries);
  // // console.log('queries');
  const statusDataMap = {};
  return bluebirdPromise
    .map(queries, element =>
      axiosObj
        .get('/device/status', {
          params: {
            uniqueId: element
          }
        })
        .then(batch =>
          bluebirdPromise.map(batch.data.statuses, obj => {
            statusDataMap[obj.uniqueId] = {
              battery_level: obj.batteryLevel,
              last_connection: new Date(obj.lastEventTimestamp * 1000).toISOString()
            };
          })
        )
    )
    .then(() => statusDataMap);
};
thingService.prototype.validateInactive = function(thingsID = '') {
  const modelpath = '../models/';

  const keys = Object.keys(thingsDependent);
  // console.log(keys);
  return bluebirdPromise
    .map(keys, key => {
      // console.log(`in 1${key}`);
      const model = require(modelpath + key.split('.')[0]);
      const condition = thingsDependent[key];
      const dict = {};
      dict[condition] = thingsID;
      // console.log(JSON.stringify(dict));
      return model.findOne(dict).exec();
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

thingService.prototype.getForPopulation = function(idList) {
  idList = idList || [];
  idList = idList.map(id => mongoose.Types.ObjectId(id));
  let conditions = {
    _id: {
      $in: idList
    },
    status: 1
  };
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return thingModel
    .find(conditions)
    .exec()
    .then(result =>
      result.sort((a, b) => idList.indexOf(a._id) - idList.indexOf(b._id)).map(result => ({
        id: result._id,
        name: result.name,
        code: result.code,
        type: result.type
      }))
    );
};

thingService.prototype.validatePopulatable = function(idList, currentId) {
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
    conditions.$and = [
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
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return thingModel
    .count(conditions)
    .exec()
    .then(count => {
      if (count === idList.length) {
        return bluebirdPromise.resolve(true);
      }
      return bluebirdPromise.resolve(false);
    });
};

thingService.prototype.isDuplicate = function(field, value = '', excludedObjId = null) {
  let conditions = {};
  conditions[field] = value;
  if (excludedObjId !== null && mongoose.Types.ObjectId.isValid(excludedObjId)) {
    conditions._id = {
      $ne: mongoose.Types.ObjectId(excludedObjId)
    };
  }
  conditions = clientHandler.addClientFilterToConditions(conditions);

  return thingModel
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
thingService.prototype.getAssociatableThings = function(filterparams, otherparams) {
  return thingModel
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
            // let i = result[j];
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

thingService.prototype.markBeaconsInactive = function(beaconCodeList) {
  // console.log(beaconCodeList);
  return bluebirdPromise
    .all([
      thingModel.update(
        {
          type: 'beacon',
          code: {
            $in: beaconCodeList
          }
        },
        {
          $set: {
            status: 0
          },
          $inc: {
            __v: 1
          }
        },
        {
          multi: true
        }
      )
    ])
    .then(() => this.removeMultipleThingsAssociation(beaconCodeList));
};

thingService.prototype.removeMultipleThingsAssociation = function(thingCodeList) {
  const userModel = require('../models/users');
  const productModel = require('../models/product');
  const locationModel = require('../models/location');

  return bluebirdPromise.map(thingCodeList, code =>
    bluebirdPromise.all([
      userModel.findOneAndUpdate(
        clientHandler.addClientFilterToConditions({}),
        {
          $pull: {
            things: {
              code: [code]
            }
          }
        },
        {
          new: true
        }
      ),
      productModel.findOneAndUpdate(
        clientHandler.addClientFilterToConditions({}),
        {
          $pull: {
            things: {
              code: [code]
            }
          }
        },
        {
          new: true
        }
      ),
      locationModel.findOneAndUpdate(
        clientHandler.addClientFilterToConditions({}),
        {
          $pull: {
            things: {
              code: [code]
            }
          }
        },
        {
          new: true
        }
      )
    ])
  );
};

thingService.prototype.getThingByUid = function(thingUid, thingType) {
  let conditions = {};
  conditions.attributes = {
    $elemMatch: {
      name: 'uid',
      value: thingUid
    }
  };
  if (thingType) {
    conditions.type = thingType;
  }
  conditions = clientHandler.addClientFilterToConditions(conditions);

  return thingModel
    .findOne(conditions)
    .exec()
    .then(thingData => {
      if (!thingData) {
        return bluebirdPromise.reject('No thing with provided Uid');
      }
      return thingData;
    });
};

module.exports = new thingService();
