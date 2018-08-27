/* jshint esversion: 6 */

const thingsModel = require('../models/things');
const loginHistoryModel = require('../models/loginHistory');
const mongoose = require('mongoose');
const bluebirdPromise = require('bluebird');
const commonHelper = require('./common');
const akUtils = require('../lib/utility');
const validator = require('../lib/validatorAsync');
const tagHelper = require('./tags');
const validatorLib = require('../lib/validator');
const notificationLib = require('../lib/notification');
const attributeHelper = require('./attribute');
const deviceTrackingModel = require('../models/deviceTracking');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');
const userHelper = require('./users');
const appStatusHelper = require('./appStatus');

const validations = {
  deviceId: [
    {
      function: validatorLib.required,
      params: [],
      fieldName: 'Device ID'
    }
  ]
};

const typemap = {
  appName: 'array',
  locationStatus: 'number',
  bluetoothStatus: 'number'
};

const deviceType = 'software';

const deviceHelper = function() {};

/**
 * Set client of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
deviceHelper.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

/**
 * Performs validations common in both update and save.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
deviceHelper.prototype.validateRequest = function(event) {
  return bluebirdPromise
    .all([
      bluebirdPromise.all([validator.required(event.body.deviceId)]),
      bluebirdPromise.all([
        validator.required(event.body.appName),
        validator.valueAllowed(process.env.allowedAppNames.split(','), event.body.appName)
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
        deviceId: {
          index: 0,
          fieldName: 'deviceId'
        },
        appName: {
          index: 1,
          fieldName: 'appName'
        },
        status: {
          index: 2,
          fieldName: 'Status'
        },
        tags: {
          index: 3,
          fieldName: 'Tags'
        },
        attributes: {
          index: 4,
          fieldName: 'Attributes'
        }
      };
      const errors = akUtils.mapAndGetValidationErrors(result, validatorErrorsMap);
      if (Object.keys(errors).length) {
        return bluebirdPromise.reject(errors);
      }
      return this.populateIds({
        event,
        update: false
      });
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
deviceHelper.prototype.populateIds = function({ event, update }) {
  return this.getByDeviceIdAndAppName(event.body.deviceId, event.body.appName)
    .then(device => {
      if (device) {
        if (!event.body.channelId) {
          event.body.channelId = device.channelId || '';
        }
        if (!event.body.pushIdentifier) {
          event.body.pushIdentifier = device.pushIdentifier || '';
        }
        event.body.associatedUserId = device.associatedUserId || '';

        event.body.code = device.code;
        if (!update) {
          event.body.name = device.name;
        }
        if (!device.minor) {
          return this.createThing({
            code: event.body.code
          }).then(beacon => {
            event.body = Object.assign({}, event.body, beacon);
            return event;
          });
        }
        event.body.uuid = device.uuid;
        event.body.major = parseInt(device.major, 10);
        event.body.minor = parseInt(device.minor, 10);
        // console.log(parseInt(device.minor, 10));
        return thingsModel
          .findOneAndUpdate(
            clientHandler.addClientFilterToConditions({
              type: 'beacon',
              status: 0,
              code: akUtils.getDeviceBeaconCode(device.code)
            }),
            {
              $set: {
                status: 1
              }
            },
            {
              new: true
            }
          )
          .then(() => {
            return bluebirdPromise.resolve(event);
          });
      }
      // const uuidGenerator = require('uuid/v4');
      event.body.code = commonHelper.generateCode(6);
      if (!device.minor) {
        return this.createThing({
          code: event.body.code
        }).then(beacon => {
          event.body = Object.assign({}, event.body, beacon);
          return event;
        });
      }
    })
    .then(event =>
      bluebirdPromise
        .all([
          tagHelper.getForPopulation(event.body.tags),
          attributeHelper.getForPopulation(event.body.attributes),
          commonHelper.populateSystemAttributes('device_required', event)
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
deviceHelper.prototype.isDuplicateCode = function(code = '', excludedObjId = null) {
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
 * Save a device
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of save operation.
 * 
 */
deviceHelper.prototype.save = function(event) {
  let conditions = {};
  if ((event.body.code || '').trim() !== '') {
    conditions = {
      code: event.body.code
    };
  }
  conditions = clientHandler.addClientFilterToConditions(conditions);

  const deviceObj = {}; // create a new instance of the  model

  deviceObj.code = event.body.code;
  deviceObj.name = event.body.name;
  deviceObj.sysDefined = 0;
  deviceObj.type = deviceType;
  deviceObj.status = event.body.status;
  deviceObj.updatedOn = Date.now();
  deviceObj.updatedBy = currentUserHandler.getCurrentUser();
  deviceObj.client = clientHandler.getClient();
  deviceObj.tags = event.body.tags;
  deviceObj.attributes = event.body.attributes;
  akUtils.log(deviceObj, conditions);
  return thingsModel
    .findOneAndUpdate(conditions, deviceObj, {
      upsert: true,
      new: true
    })
    .exec()
    .then(res => {
      res = res.toObject();
      const device = commonHelper.moveSystemAttributesToGlobal(res);
      const appStatusHelper = require('./appStatus');
      return appStatusHelper
        .saveAppStatus({
          deviceCode: device.code,
          appName: device.appName,
          updateStatus: {
            gps: device.locationStatus,
            bluetooth: device.bluetoothStatus
          }
        })
        .then(() => this.updateDeviceLocation(res).then(() => bluebirdPromise.resolve(res)));
    })
    .catch(err => {
      akUtils.log(err);
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
deviceHelper.prototype.updateDeviceLocation = function(
  deviceObj,
  pointData = null,
  currentLocation = {}
) {
  return deviceTrackingModel
    .findOne({
      'device.id': deviceObj._id
    })
    .then(deviceTrackingObj => {
      if (deviceTrackingObj === null) {
        deviceTrackingObj = new deviceTrackingModel();
        deviceTrackingObj.device = {
          id: deviceObj._id,
          code: deviceObj.code,
          name: deviceObj.name
        };
      }
      deviceTrackingObj.isReporting = false;
      deviceTrackingObj.pointId = null;
      deviceTrackingObj.currentLocation = currentLocation;
      deviceTrackingObj.sensor = {};
      deviceTrackingObj.lastTracked = new Date();
      deviceTrackingObj.lastMoved = new Date();
      deviceTrackingObj.client = clientHandler.getClient();
      return deviceTrackingObj.save();
    });
};

/**
 * Fetch a particular device by providing its ID
 * 
 * @param {String} id ID of the device to Fetch
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
deviceHelper.prototype.getById = function(id = '') {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return bluebirdPromise.reject();
  }
  let conditions = {
    _id: id,
    type: 'software'
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
deviceHelper.prototype.getByCode = function(code = '') {
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
 * Find device based on deviceId
 * 
 * @param {string} [deviceId=''] 
 * @returns 
 */
deviceHelper.prototype.getByDeviceId = function(deviceId = '') {
  let conditions = {
    attributes: {
      $elemMatch: {
        name: 'deviceId',
        value: deviceId
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

deviceHelper.prototype.getByDeviceIdAndAppName = function(deviceId = '', appName = '') {
  let conditions = {
    $and: []
  };
  conditions.$and.push({
    attributes: {
      $elemMatch: {
        name: 'deviceId',
        value: deviceId
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
deviceHelper.prototype.formatResponse = function(data, isDropdown = false) {
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

    // to remove unnecesary comma's appName
    formattedResponse.appName = (formattedResponse.appName || '').replace(
      /(^[,\s]+)|([,\s]+$)/g,
      ''
    );
    formattedResponse.appName = (formattedResponse.appName || '').replace(',', ', ');

    formattedResponse.major = parseInt(formattedResponse.major);
    formattedResponse.minor = parseInt(formattedResponse.minor);
    return formattedResponse;
  }
  formattedResponse.id = data._id;
  formattedResponse.name = data.name;
  return formattedResponse;
};
/**
 * Update a device
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of update operation.
 * 
 */
deviceHelper.prototype.update = function(event) {
  let conditions = {
    _id: event.pathParameters.id
  };
  conditions = clientHandler.addClientFilterToConditions(conditions);
  const deviceUpdateObj = {};
  deviceUpdateObj.code = event.body.code;
  deviceUpdateObj.name = event.body.name;
  deviceUpdateObj.sysDefined = 0;
  deviceUpdateObj.type = deviceType;
  deviceUpdateObj.status = event.body.status;
  deviceUpdateObj.updatedOn = Date.now();
  deviceUpdateObj.updatedBy = currentUserHandler.getCurrentUser();
  deviceUpdateObj.client = clientHandler.getClient();
  deviceUpdateObj.tags = event.body.tags;
  deviceUpdateObj.attributes = event.body.attributes;

  const updateParams = {
    $set: deviceUpdateObj,
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
    .then(() => this.getById(event.pathParameters.id));
};

/**
 * Update children of a category.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
deviceHelper.prototype.updateDependentEntities = function(sourceObj) {
  return commonHelper.updateChildren('device', sourceObj);
};

/**
 * Query the database to fetch attributes on the basis of search parameters and other parameters
 * 
 * @param {Object} searchParams search filters
 * @param {Object} otherParams pagination, sorting etc other params.
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
deviceHelper.prototype.get = function(filterparams, otherparams) {
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
deviceHelper.prototype.getFilterParams = function(event) {
  // get filter params from url
  let filters = {};
  filters = clientHandler.addClientFilterToConditions(filters);
  filters.type = deviceType;
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
          $elemMatch: { name: 'os', value: new RegExp(event.queryStringParameters.filter, 'i') }
        }
      },
      {
        attributes: {
          $elemMatch: {
            name: 'manufacturer',
            value: new RegExp(event.queryStringParameters.filter, 'i')
          }
        }
      },
      {
        attributes: {
          $elemMatch: {
            name: 'appName',
            value: new RegExp(event.queryStringParameters.filter, 'i')
          }
        }
      },
      {
        attributes: {
          $elemMatch: {
            name: 'appVersion',
            value: new RegExp(event.queryStringParameters.filter, 'i')
          }
        }
      },
      {
        attributes: {
          $elemMatch: { name: 'model', value: new RegExp(event.queryStringParameters.filter, 'i') }
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
    event.queryStringParameters.os ||
    event.queryStringParameters.manufacturer ||
    event.queryStringParameters.appName ||
    event.queryStringParameters.appVersion ||
    event.queryStringParameters.model
  ) {
    filters.attributes = {};
    filters.attributes.$all = [];

    let idx = 0;
    if (event.queryStringParameters.os) {
      filters.attributes.$all[idx] = {
        $elemMatch: { name: 'os', value: new RegExp(event.queryStringParameters.uuid, 'i') }
      };
      idx++;
    }

    if (event.queryStringParameters.manufacturer) {
      filters.attributes.$all[idx] = {
        $elemMatch: {
          name: 'manufacturer',
          value: new RegExp(event.queryStringParameters.major, 'i')
        }
      };
      idx++;
    }

    if (event.queryStringParameters.appName) {
      filters.attributes.$all[idx] = {
        $elemMatch: { name: 'appName', value: new RegExp(event.queryStringParameters.minor, 'i') }
      };
      idx++;
    }

    if (event.queryStringParameters.appVersion) {
      filters.attributes.$all[idx] = {
        $elemMatch: {
          name: 'appVersion',
          value: new RegExp(event.queryStringParameters.minor, 'i')
        }
      };
      idx++;
    }

    if (event.queryStringParameters.model) {
      filters.attributes.$all[idx] = {
        $elemMatch: { name: 'model', value: new RegExp(event.queryStringParameters.minor, 'i') }
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
  return filters;
};

/**
 * Generate the extra parameters for the GET operation like sorting, pagination etc.
 * 
 * @param {Object} request Lambda Event
 * @return {Object} extraParams
 * 
 */
deviceHelper.prototype.getExtraParams = function(event) {
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
deviceHelper.prototype.count = function(searchParams = {}) {
  return thingsModel.count(searchParams).exec();
};

/**
 * returns device for specific order
 * 
 * @param {any} filterparams 
 * @param {any} otherparams 
 * @returns 
 */
deviceHelper.prototype.getDeviceForOrder = function(filterparams, otherparams) {
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
 * Save device
 * 
 * @param {any} device 
 * @returns 
 */
deviceHelper.prototype.saveThing = function(device) {
  const gatewayHelper = require('../helpers/gateways');
  const commonHelper = require('./common');
  device = commonHelper.moveSystemAttributesToGlobal(device);
  const payload = {
    code: device.code,
    name: device.name,
    status: 1,
    type: deviceType,
    uuid: device.uuid,
    manufacturer: device.manufacturer,
    last_connection: ' ',
    location: ' '
  };
  payload.updatedBy = device.updatedBy;
  payload.client = device.client;
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
deviceHelper.prototype.validateUpdate = function(event) {
  return bluebirdPromise
    .all([
      bluebirdPromise.all([
        validator.required(event.body.deviceId),
        validator.checkSame('devices', 'deviceId', event.body.deviceId, event.pathParameters.id)
      ]),
      bluebirdPromise.all([
        validator.checkSame('devices', 'os', event.body.os, event.pathParameters.id)
      ]),
      bluebirdPromise.all([
        validator.checkSame(
          'devices',
          'manufacturer',
          event.body.manufacturer,
          event.pathParameters.id
        )
      ]),
      bluebirdPromise.all([
        validator.checkSame('devices', 'model', event.body.model, event.pathParameters.id)
      ]),
      bluebirdPromise.all([
        validator.checkSame('devices', 'version', event.body.version, event.pathParameters.id)
      ]),
      bluebirdPromise.all([
        validator.checkSame('devices', 'uuid', event.body.uuid, event.pathParameters.id)
      ]),
      bluebirdPromise.all([
        validator.checkSame('devices', 'major', event.body.major, event.pathParameters.id)
      ]),
      bluebirdPromise.all([
        validator.checkSame('devices', 'minor', event.body.minor, event.pathParameters.id)
      ]),
      bluebirdPromise.all([
        validator.checkSame('devices', 'appName', event.body.appName, event.pathParameters.id)
      ]),
      bluebirdPromise.all([validator.valueAllowed([0, 1], event.body.status)])
    ])
    .then(result => {
      const validatorErrorsMap = {
        deviceId: {
          index: 0,
          fieldName: 'deviceId'
        },
        os: {
          index: 1,
          fieldName: 'os'
        },
        manufacturer: {
          index: 2,
          fieldName: 'manufacturer'
        },
        model: {
          index: 3,
          fieldName: 'model'
        },
        version: {
          index: 4,
          fieldName: 'version'
        },
        uuid: {
          index: 5,
          fieldName: 'uuid'
        },
        appName: {
          index: 6,
          fieldName: 'appName'
        },
        status: {
          index: 7,
          fieldName: 'status'
        }
      };
      const errors = akUtils.mapAndGetValidationErrors(result, validatorErrorsMap);
      if (Object.keys(errors).length) {
        return bluebirdPromise.reject(errors);
      }
      return this.populateIds({
        event,
        update: true
      });
    });
};

/**
 * Save device
 * 
 * @param {any} device 
 * @returns 
 */
deviceHelper.prototype.createThing = function({ code }) {
  return this.generateThingCreds().then(beacon => {
    const event = {};
    event.body = {};
    event.body.code = akUtils.getDeviceBeaconCode(code);
    event.body.name = akUtils.getDeviceBeaconCode(code);
    event.body.status = 1;
    event.body.beaconType = 'DEVICE_BEACON';
    event.body.beaconSpecification = 'STANDARD';
    event.body.uuid = beacon.uuid;
    event.body.major = `${beacon.major}`;
    event.body.minor = `${beacon.minor}`;

    const thingHelper = require('./things');
    return thingHelper.save(event).then(res => {
      res = thingHelper.formatResponse(res);
      const resp = {};
      resp.uuid = res.uuid;
      resp.major = res.major;
      resp.minor = res.minor;
      return bluebirdPromise.resolve(resp);
    });
  });
};

deviceHelper.prototype.generateThingCreds = function() {
  const thingModel = require('../models/things');
  const beacon = {};
  beacon.uuid = process.env.defaultBeaconUUID;
  beacon.major = process.env.defaultBeaconMajor;
  beacon.minor = Math.floor(Math.random() * (65535 - 2 + 1)) + 1;
  return thingModel
    .find({ type: 'beacon', attributes: { $elemMatch: { name: 'minor', value: beacon.minor } } })
    .exec()
    .then(res => {
      if (res.length > 0) {
        return this.generateThingCreds();
      }
      return bluebirdPromise.resolve(beacon);
    });
};

deviceHelper.prototype.validateStatusChange = function(event) {
  // console.log('event');
  // console.log(event.body);
  // console.log('validateStatusChange');
  return bluebirdPromise
    .all([
      bluebirdPromise.all([
        validator.required(event.body.deviceId),
        validator.type('string', event.body.deviceId)
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
        deviceId: {
          index: 0,
          fieldName: 'deviceId'
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

deviceHelper.prototype.createStatusChangeRequest = function(event) {
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

deviceHelper.prototype.link = function(event) {
  // mongoose.set('debug', true);
  const userModel = require('../models/users');

  return userModel
    .update(
      clientHandler.addClientFilterToConditions({}),
      {
        $pull: {
          things: {
            code: [akUtils.getDeviceBeaconCode(event.body.appCode)]
          }
        }
      },
      {
        multi: true
      }
    )
    .exec()
    .then(() => {
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
      return thingsModel
        .findOneAndUpdate(conditions, updateParams)
        .exec()
        .then(() =>
          userHelper.associateThingToUser(
            currentUserHandler.getCurrentUser().uuid,
            akUtils.getDeviceBeaconCode(event.body.appCode)
          )
        );
    }).then((results) => {
      return bluebirdPromise.join(
        (() => {
          return thingsModel
            .findOne({'code': event.body.appCode, 'type': 'software'})
            .exec()
        })(),
        (() => {
          return thingsModel
            .findOne({'code': akUtils.getDeviceBeaconCode(event.body.appCode), 'type': 'beacon'})
            .exec()
        })(),
        (deviceObj, sensorObj) => {
          const deviceInfo = commonHelper.moveSystemAttributesToGlobal(deviceObj);
          
          const loginHistoryObj = new loginHistoryModel();
          loginHistoryObj.client = clientHandler.getClient();
          loginHistoryObj.user = {
            id: results.id,
            code: results.sub,
            name: results.given_name + ' ' + results.family_name
          };
          loginHistoryObj.device = {
            id: deviceObj._id,
            code: deviceObj.code,
            name: deviceObj.name,
            type: deviceObj.type,
            manufacturer: deviceInfo.manufacturer,
            appName: deviceInfo.appName,
            os: deviceInfo.os,
            model: deviceInfo.model,
            version: deviceInfo.version,
            appVersion: deviceInfo.appVersion
          };
          loginHistoryObj.sensor = {
            id: sensorObj._id,
            code: sensorObj.code,
            name: sensorObj.name,
            type: sensorObj.type
          };
          loginHistoryObj.loginTime = new Date();
          loginHistoryObj.logoutTime = null;
          
          // return true;
          return loginHistoryObj
            .save()
            .then( () => {
              return results;
            });
        });
    });
};

deviceHelper.prototype.unlink = function(event) {
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
  return thingsModel
    .findOneAndUpdate(conditions, updateParams)
    .then(() =>
      appStatusHelper.saveBeaconServiceStatus({
        deviceCode: event.body.appCode,
        beaconService: true
      })
    )
    .then(() =>
      userHelper.disassociateThingFromUser(
        currentUserHandler.getCurrentUser().uuid,
        akUtils.getDeviceBeaconCode(event.body.appCode)
      )
    )
    .then((results) => {
      return loginHistoryModel
        .find({'user.code': currentUserHandler.getCurrentUser().uuid, 'logoutTime': null, 'device.code': event.body.appCode})
        .sort({_id:-1})
        .limit(1)
        .exec()
        .then((loginHistoryArr) => {
          if(loginHistoryArr.length > 0) {
            const loginHistoryObj = loginHistoryArr[0];
            loginHistoryObj.logoutTime = new Date();
            return loginHistoryObj.save().then(() => {
              return results;  
            });
          } else {
            return results;
          }
        });
    });
};

deviceHelper.prototype.getUserApps = function(email) {
  const conditions = clientHandler.addClientFilterToConditions({
    attributes: {
      $elemMatch: {
        name: 'associatedUserId',
        value: email
      }
    }
  });

  return thingsModel
    .find(conditions)
    .exec()
    .then(result => result.map(x => this.formatResponse(x)));
};

deviceHelper.prototype.markDevicesInactive = function(deviceCodeList) {
  // console.log(deviceCodeList);
  const thingHelper = require('./things');
  return thingsModel
    .update(
      clientHandler.addClientFilterToConditions({
        type: 'software',
        code: {
          $in: deviceCodeList
        }
      }),
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
    .exec()
    .then(() =>
      bluebirdPromise.all([
        this.clearAssociatedUserFromDevices(deviceCodeList),
        thingHelper.markBeaconsInactive(deviceCodeList.map(x => akUtils.getDeviceBeaconCode(x)))
      ])
    );
};

deviceHelper.prototype.clearAssociatedUserFromDevices = function(deviceCodeList) {
  const conditions = clientHandler.addClientFilterToConditions({
    type: 'software',
    code: {
      $in: deviceCodeList
    },
    attributes: {
      $elemMatch: {
        name: 'associatedUserId',
        value: { $ne: '' }
      }
    }
  });

  return thingsModel
    .update(
      conditions,
      {
        $set: {
          'attributes.$.value': ''
        }
      },
      {
        multi: true
      }
    )
    .exec();
};

module.exports = new deviceHelper();
