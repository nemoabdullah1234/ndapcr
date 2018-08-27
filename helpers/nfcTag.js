/* jshint esversion: 6 */

const thingsModel = require('../models/things');
const mongoose = require('mongoose');
const bluebirdPromise = require('bluebird');
const commonHelper = require('./common');
const akUtils = require('../lib/utility');
const validator = require('../lib/validatorAsync');
const tagHelper = require('./tags');
const validatorLib = require('../lib/validator');
const notificationLib = require('../lib/notification');
const attributeHelper = require('./attribute');
// const nfcTagTrackingModel = require('../models/nfcTagTracking');
const jsTypeChecker = require('javascript-type-checker');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');
const productTemperatureModel = require('../models/productTemperature');
const productHelper = require('../helpers/product');
const productTemperatureHistoryModel = require('../models/productTemperatureHistory');

const validations = {
  nfcTagId: [
    {
      function: validatorLib.required,
      params: [],
      fieldName: 'NfcTag ID'
    }
  ]
};

const typemap = {
  maxTemp: 'number',
  minTemp: 'number',
  measurementCycle: 'number'
};

const thingType = 'nfcTag';

const nfcTagHelper = function() {};

/**
 * Set client of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
nfcTagHelper.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

/**
 * Performs validations common in both update and save.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
nfcTagHelper.prototype.commonValidations = function(event) {
  return bluebirdPromise
    .all([
      bluebirdPromise.all([
        validator.required(event.body.uid),
        validator.notDuplicate(
          'nfcTag',
          'attributes',
          {
            $elemMatch: {
              name: 'uid',
              value: event.body.uid
            }
          },
          event.pathParameters.id
        )
      ]),
      bluebirdPromise.all([
        validator.stringLength(0, validator.CODE_MAX_LENGTH, event.body.code),
        validator.notDuplicate('nfcTag', 'code', event.body.code, event.pathParameters.id)
      ]),
      bluebirdPromise.all([validator.valueAllowed([0, 1], event.body.status)]),
      bluebirdPromise.all([
        validator.type('array', event.body.tags),
        validator.duplicateArrayElements(null, event.body.tags),
        validator.validatePopulatableLists('tags', event.body.tags),
        validator.arrayOfType('string', event.body.tags)
      ]),
      bluebirdPromise.all([
        validator.type('array', event.body.attributes),
        validator.arrayOfType('object', event.body.attributes),
        validator.validatePopulatableLists('attributes', event.body.attributes),
        validator.duplicateArrayElements('id', event.body.attributes)
      ])
    ])
    .then(result => {
      const validatorErrorsMap = {
        uid: {
          index: 0,
          fieldName: 'uid'
        },
        code: {
          index: 1,
          fieldName: 'code'
        },
        status: {
          index: 2,
          fieldName: 'status'
        },
        tags: {
          index: 3,
          fieldName: 'tags'
        },
        attributes: {
          index: 4,
          fieldName: 'attributes'
        }
      };
      const errors = akUtils.mapAndGetValidationErrors(result, validatorErrorsMap);
      if (errors) {
        return bluebirdPromise.reject(errors);
      }
      return bluebirdPromise.resolve();
    })
    .catch(err => bluebirdPromise.reject(err));
};
/**
 * Performs validations common in both update and save.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
nfcTagHelper.prototype.validateRequest = function(event) {
  return this.commonValidations(event)
    .then(() => {})
    .catch(errors => {
      if (!jsTypeChecker.isEmptyObject(errors)) {
        return bluebirdPromise.reject(
          akUtils.getObjectValues(akUtils.sortErrorsObject(errors, 'nfcTag'))
        );
      }
      return bluebirdPromise.resolve();
    })
    .then(() =>
      this.populateIds({
        event,
        update: false
      })
    );
};

/**
 * Checks if a give code already exists in the database.
 * 
 * @param {String} code Code to check
 * @param {String} excludedObjId Object ID of current object if checking while update.
 * @return {Promise} Resolved promise if duplicate code. Rejected promise otherwise
 * 
 */
nfcTagHelper.prototype.populateIds = function({ event, update }) {
  return this.getByuid(event.body.uid)
    .then(nfcTag => {
      if (nfcTag) {
        event.body.code = nfcTag.code;
        return bluebirdPromise.resolve(event);
      } else if (!update) {
        event.body.code = `N${commonHelper.generateCode(4)}`;
      }
      return bluebirdPromise.resolve(event);
    })
    .then(event =>
      bluebirdPromise
        .all([
          tagHelper.getForPopulation(event.body.tags),
          attributeHelper.getForPopulation(event.body.attributes),
          commonHelper.populateSystemAttributes('nfc_tag_sysDefined', event)
        ])
        .then(populations => {
          event.body.tags = populations[0];
          event.body.attributes = [...populations[2], ...populations[1]];
          return bluebirdPromise.resolve(event);
        })
    );
};

/**
 * Checks if a give code already exists in the database.
 * 
 * @param {String} code Code to check
 * @param {String} excludedObjId Object ID of current object if checking while update.
 * @return {Promise} Resolved promise if duplicate code. Rejected promise otherwise
 * 
 */
nfcTagHelper.prototype.isDuplicateCode = function(code = '', excludedObjId = null) {
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
  return thingsModel
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
 * Save a nfcTag
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of save operation.
 * 
 */
nfcTagHelper.prototype.save = function(event) {
  // let conditions = {};
  // if ((event.body.code || '').trim() !== '') {
  //   conditions = {
  //     code: event.body.code
  //   };
  // }
  // conditions = conditions = clientHandler.addClientFilterToConditions(conditions);
  const nfcTagObj = new thingsModel(); // create a new instance of the  model

  nfcTagObj.code = event.body.code;
  nfcTagObj.name = event.body.name;
  nfcTagObj.sysDefined = 0;
  nfcTagObj.type = thingType;
  nfcTagObj.status = event.body.status;
  nfcTagObj.updatedOn = Date.now();
  nfcTagObj.updatedBy = currentUserHandler.getCurrentUser();
  nfcTagObj.client = clientHandler.getClient();
  nfcTagObj.tags = event.body.tags;
  nfcTagObj.attributes = event.body.attributes;

  return nfcTagObj.save();
};

/**
 * Fetch a particular nfcTag by providing its ID
 * 
 * @param {String} id ID of the nfcTag to Fetch
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
nfcTagHelper.prototype.getById = function(id = '') {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return bluebirdPromise.reject();
  }
  let conditions = {
    _id: id,
    type: thingType
  };
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return thingsModel
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
 * Fetch a particular collection by providing its Code
 * 
 * @param {String} code Code of the collection to Fetch
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
nfcTagHelper.prototype.getByCode = function(code = '') {
  return thingsModel
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
 * Find nfcTag based on nfcTagId
 * 
 * @param {string} [nfcTagId=''] 
 * @returns 
 */
nfcTagHelper.prototype.getByuid = function(uid = '') {
  let conditions = {
    attributes: {
      $elemMatch: {
        name: 'uid',
        value: uid
      }
    }
  };
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return thingsModel
    .findOne(conditions)
    .exec()
    .then(result => {
      if (result) {
        return bluebirdPromise.resolve(this.formatResponse(result));
      }
      return bluebirdPromise.resolve('');
    });
};

nfcTagHelper.prototype.getByNfcTagIdAndAppName = function(nfcTagId = '', appName = '') {
  let conditions = {
    $and: []
  };
  conditions.$and.push({
    attributes: {
      $elemMatch: {
        name: 'nfcTagId',
        value: nfcTagId
      }
    }
  });
  conditions.$and.push({
    attributes: {
      $elemMatch: {
        name: 'appName',
        value: appName
      }
    }
  });
  conditions = clientHandler.addClientFilterToConditions(conditions);
  // // console.log(JSON.stringify(conditions));
  return thingsModel
    .findOne(conditions)
    .exec()
    .then(result => {
      if (result) {
        return bluebirdPromise.resolve(this.formatResponse(result));
      }
      return bluebirdPromise.resolve('');
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
nfcTagHelper.prototype.formatResponse = function(data, isDropdown = false) {
  let formattedResponse = {};
  if (!isDropdown) {
    formattedResponse.id = data._id;
    formattedResponse.code = data.code;
    formattedResponse.name = data.name;
    formattedResponse.sysDefined = data.sysDefined;
    formattedResponse.type = data.type;
    formattedResponse.status = data.status;

    if (data.updatedBy) {
      formattedResponse.updatedBy = `${((data || {}).updatedBy || '').firstName} ${((data || {})
        .updatedBy || ''
      ).lastName}`;
    }
    formattedResponse.updatedOn = data.updatedOn;
    formattedResponse.client = data.client;
    formattedResponse.attributes = data.attributes;
    formattedResponse.tags = data.tags;

    formattedResponse = commonHelper.moveSystemAttributesToGlobal(formattedResponse, typemap);

    return formattedResponse;
  }
  formattedResponse.id = data._id;
  formattedResponse.name = data.name;
  return formattedResponse;
};
/**
 * Update a nfcTag
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of update operation.
 * 
 */
nfcTagHelper.prototype.update = function(event) {
  const conditions = {
    _id: mongoose.Types.ObjectId(event.pathParameters.id)
  };

  const nfcTagUpdateObj = {};
  nfcTagUpdateObj.code = event.body.code;
  nfcTagUpdateObj.name = event.body.name;
  nfcTagUpdateObj.sysDefined = 0;
  nfcTagUpdateObj.type = thingType;
  nfcTagUpdateObj.status = event.body.status;
  nfcTagUpdateObj.updatedOn = Date.now();
  nfcTagUpdateObj.updatedBy = currentUserHandler.getCurrentUser();
  nfcTagUpdateObj.client = clientHandler.getClient();
  nfcTagUpdateObj.tags = event.body.tags;
  nfcTagUpdateObj.attributes = event.body.attributes;
  const updateParams = {
    $set: nfcTagUpdateObj,
    $inc: {
      __v: 1
    }
  };
  return thingsModel
    .findOneAndUpdate(conditions, updateParams, {
      upsert: false,
      new: true
    })
    .exec()
    .then(result => {
      // console.log(result);
      return this.getById(event.pathParameters.id);
    })
    .catch(err => {
      akUtils.log(err, 'findoneandupdateerror');
      return bluebirdPromise.reject(err);
    });
};

/**
 * Update children of a category.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
nfcTagHelper.prototype.updateDependentEntities = function(sourceObj) {
  return commonHelper.updateChildren('nfcTag', sourceObj);
};

/**
 * Query the database to fetch attributes on the basis of search parameters and other parameters
 * 
 * @param {Object} searchParams search filters
 * @param {Object} otherParams pagination, sorting etc other params.
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
nfcTagHelper.prototype.get = function(filterparams, otherparams) {
  return thingsModel
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
          if (i) {
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
nfcTagHelper.prototype.getFilterParams = function(event) {
  // get filter params from url
  let filters = {};
  filters = clientHandler.addClientFilterToConditions(filters);
  filters.type = thingType;
  if (event.queryStringParameters.dd === '1') {
    filters.status = 1;
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
          $elemMatch: {
            name: 'uid',
            value: new RegExp(event.queryStringParameters.filter, 'i')
          }
        }
      },
      {
        attributes: {
          $elemMatch: {
            name: 'minTemp',
            value: new RegExp(event.queryStringParameters.filter, 'i')
          }
        }
      },
      {
        attributes: {
          $elemMatch: {
            name: 'maxTemp',
            value: new RegExp(event.queryStringParameters.filter, 'i')
          }
        }
      },
      {
        attributes: {
          $elemMatch: {
            name: 'measurementCycle',
            value: new RegExp(event.queryStringParameters.filter, 'i')
          }
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

  if (
    event.queryStringParameters.uid ||
    event.queryStringParameters.minTemp ||
    event.queryStringParameters.maxTemp ||
    event.queryStringParameters.measurementCycle
  ) {
    filters.attributes = {};
    filters.attributes.$all = [];

    let idx = 0;
    if (event.queryStringParameters.uid) {
      filters.attributes.$all[idx] = {
        $elemMatch: {
          name: 'uid',
          value: new RegExp(event.queryStringParameters.uid, 'i')
        }
      };
      idx++;
    }

    if (event.queryStringParameters.minTemp) {
      filters.attributes.$all[idx] = {
        $elemMatch: {
          name: 'minTemp',
          value: new RegExp(event.queryStringParameters.minTemp, 'i')
        }
      };
      idx++;
    }

    if (event.queryStringParameters.maxTemp) {
      filters.attributes.$all[idx] = {
        $elemMatch: { name: 'maxTemp', value: new RegExp(event.queryStringParameters.maxTemp, 'i') }
      };
      idx++;
    }

    if (event.queryStringParameters.measurementCycle) {
      filters.attributes.$all[idx] = {
        $elemMatch: {
          name: 'measurementCycle',
          value: new RegExp(event.queryStringParameters.measurementCycle, 'i')
        }
      };
      idx++;
    }
  }

  if (event.queryStringParameters.modifiedFrom || event.queryStringParameters.modifiedTo) {
    filters.updatedOn = {};
  }

  if (event.queryStringParameters.modifiedFrom) {
    filters.updatedOn.$gte = new Date(event.queryStringParameters.modifiedFrom);
  }

  if (event.queryStringParameters.modifiedTo) {
    filters.updatedOn.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.modifiedTo)
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
nfcTagHelper.prototype.getExtraParams = function(event) {
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
 * Count categories on the basis of some search conditions.
 * 
 * @param {Object} searchParams Search Conditions
 * @return {Promise<Number>} Number of matching categories.
 * 
 */
nfcTagHelper.prototype.count = function(searchParams = {}) {
  return thingsModel.count(searchParams).exec();
};

/**
 * returns nfcTag for specific order
 * 
 * @param {any} filterparams 
 * @param {any} otherparams 
 * @returns 
 */
nfcTagHelper.prototype.getNfcTagForOrder = function(filterparams, otherparams) {
  filterparams.things = {
    $gt: []
  };
  const project = {
    _id: 1,
    code: 1,
    name: 1,
    things: 1
  };
  return thingsModel
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
        for (const i in result) {
          if (i) {
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
    })
    .catch(err => bluebirdPromise.reject(err));
};

/**
 * Save nfcTag
 * 
 * @param {any} nfcTag 
 * @returns 
 */
nfcTagHelper.prototype.saveThing = function(nfcTag) {
  const gatewayHelper = require('../helpers/gateways');
  const commonHelper = require('./common');
  nfcTag = commonHelper.moveSystemAttributesToGlobal(nfcTag);
  const payload = {
    code: nfcTag.code,
    name: nfcTag.name,
    status: 1,
    type: thingType,
    uuid: nfcTag.uuid,
    manufacturer: nfcTag.manufacturer,
    last_connection: ' ',
    location: ' '
  };
  payload.updatedBy = nfcTag.updatedBy;
  payload.client = nfcTag.client;
  const event = {};
  event.body = payload;
  return gatewayHelper
    .validateAndPopulateIds(event)
    .then(() => gatewayHelper.save(event))
    .then(res => bluebirdPromise.resolve(res))
    .catch(err => bluebirdPromise.reject(err));
};

/**
 * Performs update-specific validations before performing common validations.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
nfcTagHelper.prototype.validateUpdate = function(event) {
  let basicErrors;
  return this.commonValidations(event)
    .catch(errors => {
      // console.log('errors');
      return errors;
    })
    .then(errorsIfAny => {
      basicErrors = errorsIfAny || {};
      return bluebirdPromise.all([
        bluebirdPromise.all([
          validator.elementExists('nfcTag', event.pathParameters.id),
          validator.deactivationCheck('nfcTag', event.body.status, event.pathParameters.id)
        ]),
        bluebirdPromise.all([
          validator.required(event.body.code),
          validator.checkSame('nfcTag', 'code', event.body.code, event.pathParameters.id)
        ]),
        bluebirdPromise.all([
          validator.checkSame('nfcTag', 'uid', event.body.uid, event.pathParameters.id)
        ])
      ]);
    })
    .then(result => {
      const mapping = {
        global: {
          index: 0,
          fieldName: 'Temperature Tag'
        },
        code: {
          index: 1,
          fieldName: 'Code'
        },
        uid: {
          index: 2,
          fieldName: 'uid'
        }
      };
      const validationResult = akUtils.mapAndGetValidationErrors(result, mapping);
      const combinedErrors = Object.assign({}, basicErrors, validationResult);
      if (!jsTypeChecker.isEmptyObject(combinedErrors)) {
        return bluebirdPromise.reject(
          akUtils.getObjectValues(akUtils.sortErrorsObject(combinedErrors, 'nfcTag'))
        );
      }
      return this.populateIds({
        event,
        update: true
      })
        .then(data => bluebirdPromise.resolve(data))
        .catch(err => {
          // console.log(err);
          return bluebirdPromise.reject();
        });
    })
    .catch(errors => {
      // console.log(errors);
      return bluebirdPromise.reject(errors);
    });
};

/**
 * Save nfcTag
 * 
 * @param {any} nfcTag 
 * @returns 
 */
nfcTagHelper.prototype.createThing = function({ code }) {
  const thingHelper = require('./things');
  const event = {};
  event.body = {};
  event.body.code = akUtils.getDeviceBeaconCode(code);
  event.body.name = 'NfcTagBeacon';
  event.body.status = 1;
  event.body.uuid = process.env.defaultBeaconUUID;
  event.body.major = Math.floor(Math.random() * (65535 - 2 + 1)) + 2;
  event.body.minor = Math.floor(Math.random() * (65535 - 2 + 1)) + 1;
  return thingHelper.save(event).then(res => {
    res = thingHelper.formatResponse(res);
    const resp = {};
    resp.uuid = res.uuid;
    resp.major = res.major;
    resp.minor = res.minor;
    return bluebirdPromise.resolve(resp);
  });
};

nfcTagHelper.prototype.validateStatusChange = function(event) {
  // console.log('event');
  // console.log(event.body);
  // console.log('validateStatusChange');
  return bluebirdPromise
    .all([
      bluebirdPromise.all([
        validator.required(event.body.nfcTagId),
        validator.type('string', event.body.nfcTagId)
      ]),
      bluebirdPromise.all([
        validator.required(event.body.appCode),
        validator.type('string', event.body.appCode)
      ]),
      bluebirdPromise.all([
        validator.type('number', event.body.locationStatus),
        validator.valueAllowed([0, 1], event.body.locationStatus)
      ]),
      bluebirdPromise.all([
        validator.type('number', event.body.bluetoothStatus),
        validator.valueAllowed([0, 1], event.body.bluetoothStatus)
      ])
    ])
    .then(result => {
      const validatorErrorsMap = {
        nfcTagId: {
          index: 0,
          fieldName: 'nfcTagId'
        },
        appCode: {
          index: 1,
          fieldName: 'appCode'
        },
        manufacturer: {
          index: 2,
          fieldName: 'locationStatus'
        },
        model: {
          index: 3,
          fieldName: 'bluetoothStatus'
        }
      };
      const errors = akUtils.mapAndGetValidationErrors(result, validatorErrorsMap);
      if (Object.keys(errors).length) {
        return bluebirdPromise.reject(errors);
      }
      return bluebirdPromise.resolve();
    });
};

nfcTagHelper.prototype.createStatusChangeRequest = function(event) {
  let appData;
  // console.log(event.body);
  // console.log('++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
  return this.getByCode(event.body.appCode).then(result => {
    appData = result;
    event.body = Object.assign({}, result, {
      locationStatus: `${event.body.locationStatus}`,
      bluetoothStatus: `${event.body.bluetoothStatus}`
    });
    event.body.tags = (event.body.tags || []).map(x => x.name);
    event.body.categories = (event.body.categories || []).map(x => `${x.id}`);
    return this.populateIds({
      event,
      update: true
    });
  });
};

nfcTagHelper.prototype.link = function(event) {
  // mongoose.set('debug', true);
  let conditions = {
    code: event.body.appCode,
    'attributes.name': 'associatedUserId'
  };
  conditions = clientHandler.addClientFilterToConditions(conditions);
  // const updateParams = {
  //   $set: { 'attributes.$.value': 'vijay.kumar+11@akwa.io' }
  // };

  const updateParams = {
    $set: { 'attributes.$.value': currentUserHandler.getCurrentUser().email }
  };
  // console.log(typeof event.body);
  // console.log('typeof event.body');
  // console.log(event.body);
  // console.log('event.body');
  // console.log(conditions);
  // console.log('conditions');
  // console.log(updateParams);
  // console.log('updateParams');
  return thingsModel.findOneAndUpdate(conditions, updateParams).exec();
};

nfcTagHelper.prototype.unlink = function(event) {
  let conditions = {
    code: event.body.appCode,
    attributes: {
      $elemMatch: {
        name: 'associatedUserId',
        value: currentUserHandler.getCurrentUser().email
      }
    }
  };

  conditions = clientHandler.addClientFilterToConditions(conditions);

  const updateParams = {
    $set: { 'attributes.$.value': '' }
  };
  // console.log(event.body);
  // console.log('event.body');
  // console.log(conditions);
  // console.log('conditions');
  // console.log(updateParams);
  // console.log('updateParams');
  return thingsModel.findOneAndUpdate(conditions, updateParams).then(() => {
    const appStatusHelper = require('./appStatus');
    return appStatusHelper.saveBeaconServiceStatus({
      nfcTagCode: event.body.appCode,
      beaconService: true
    });
  });
};

nfcTagHelper.prototype.getUserApps = function(email) {
  const conditions = clientHandler.addClientFilterToConditions({
    attributes: {
      $elemMatch: {
        name: 'associatedUserId',
        value: email
      }
    }
  });

  return thingsModel.find(conditions).exec();
};

nfcTagHelper.prototype.isDuplicate = function(field, value = '', excludedObjId = null) {
  let conditions = {};
  conditions[field] = value;
  if (excludedObjId !== null && mongoose.Types.ObjectId.isValid(excludedObjId)) {
    conditions._id = {
      $ne: mongoose.Types.ObjectId(excludedObjId)
    };
  }
  conditions = clientHandler.addClientFilterToConditions(conditions);

  return thingsModel
    .findOne(conditions)
    .exec()
    .then(result => {
      if (result) {
        return bluebirdPromise.resolve();
      }
      return bluebirdPromise.reject();
    });
};

nfcTagHelper.prototype.getScanHistoryDataForProduct = function(productId) {
  return productHelper.getById(productId).then(prodData => {
    const nfcTagIds = prodData.things.filter(x => x.type === thingType).map(x => x.id);
    return bluebirdPromise.map(nfcTagIds, nfcTagId =>
      productTemperatureModel
        .find(
          clientHandler.addClientFilterToConditions({
            'product.id': mongoose.Types.ObjectId(productId),
            'sensor.id': mongoose.Types.ObjectId(nfcTagId)
          })
        )
        .sort('-lastTracked')
        .limit(1)
        .exec()
        .then(result =>
          // result = JSON.parse(JSON.stringify(result));

          bluebirdPromise.map(result, elem =>
            bluebirdPromise
              .all([
                productTemperatureHistoryModel
                  .find(
                    clientHandler.addClientFilterToConditions({
                      trackingId: mongoose.Types.ObjectId(elem._id)
                    })
                  )
                  .select('recordedTemp')
                  .sort('scanTime')
                  .exec()
                  .then(historyResult => {
                    const temperatures = historyResult.map(x => x.recordedTemp);
                    return temperatures;
                  }),
                this.getById(nfcTagId)
              ])
              .then(data => {
                const tempData = data[0];
                const thingData = data[1];
                const result = JSON.parse(JSON.stringify(elem.temperature));
                result.startTime = akUtils.isoDateToMilliseconds(result.startTime);
                result.endTime = akUtils.isoDateToMilliseconds(result.endTime);
                result.uid = thingData.uid;
                result.sensor = {
                  id: thingData.id,
                  code: thingData.code,
                  name: thingData.name
                };
                result.cycle = Number(thingData.measurementCycle);
                result.maxTemp = Number(thingData.maxTemp);
                result.minTemp = Number(thingData.minTemp);
                result.breachInfos = result.breaches.map(breach => {
                  breach.end = akUtils.isoDateToMilliseconds(breach.end);
                  breach.start = akUtils.isoDateToMilliseconds(breach.start);
                  return breach;
                });
                result.breaches = undefined;
                result.temp = tempData;
                return result;
              })
              .then(result => {
                const trackingModel = require('../models/tracking');
                return trackingModel
                  .find(
                    clientHandler.addClientFilterToConditions({
                      'sensors.product.id': mongoose.Types.ObjectId(productId),
                      'sensors.id': mongoose.Types.ObjectId(nfcTagId),
                      'location.addresses.name': {
                        $ne: null
                      },
                      trackedAt: {
                        $gte: new Date(result.startTime),
                        $lte: new Date(result.endTime)
                      }
                    }),
                    {
                      _id: 0,
                      ts: 1,
                      'location.addresses.name': 1
                    }
                  )
                  .sort('-trackedAt')
                  .exec()
                  .then(trackingResult => {
                    result.locationTracking = trackingResult.map(x => ({
                      ts: x.ts,
                      location: ((x.location || {}).addresses || {}).name || ''
                    }));
                    return result;
                  });
              })
          )
        )
    );
  });
};

module.exports = new nfcTagHelper();
