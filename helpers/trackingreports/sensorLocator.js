const trackingModel = require('../../models/tracking');
const mongoose = require('mongoose');
const bluebirdPromise = require('bluebird');
const commonHelper = require('./../common');
const thingsModel = require('../../models/things');
const clientHandler = require('../../lib/clientHandler');
const sensorLocatorService = function() {};

/**
 * Set client of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
sensorLocatorService.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

/**
 * Set headers of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
sensorLocatorService.prototype.setHeaders = function(headers) {
  this.headers = headers;
};

/**
 * Set headers of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
sensorLocatorService.prototype.setConfigs = () => {
  // console.log('config');
  return require('./../configuration')
    .getConfigurations()
    .then(configs => {
      this.configs = configs;
    });
};

/**
 * 
 */
sensorLocatorService.prototype.sensorLocator = function(event) {
  const params = {};
  const countParams = {};

  params.sensortrackingslookup = {
    from: 'sensortrackings',
    localField: '_id',
    foreignField: 'sensors.id',
    as: 'sensortrackings'
  };

  params.project = {
    code: 1,
    name: 1,
    sensortrackings: 1
  };

  countParams.project = {
    code: 1,
    name: 1
  };

  params.match = {
    type: {
      $in: ['beacon', 'tempTag', 'nfcTag']
    }
  };
  countParams.match = {
    type: {
      $in: ['beacon', 'tempTag', 'nfcTag']
    }
  };

  if (event.queryStringParameters && event.queryStringParameters.filter) {
    params.match.$or = [
      {
        code: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        name: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'sensortrackings.currentLocation.code': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'sensortrackings.currentLocation.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'sensortrackings.currentLocation.address.value': new RegExp(
          event.queryStringParameters.filter,
          'i'
        )
      },
      {
        'sensortrackings.currentLocation.zones.code': new RegExp(
          event.queryStringParameters.filter,
          'i'
        )
      },
      {
        'sensortrackings.currentLocation.zones.name': new RegExp(
          event.queryStringParameters.filter,
          'i'
        )
      },
      {
        'sensortrackings.currentLocation.floor.code': new RegExp(
          event.queryStringParameters.filter,
          'i'
        )
      },
      {
        'sensortrackings.currentLocation.floor.name': new RegExp(
          event.queryStringParameters.filter,
          'i'
        )
      },
      {
        'sensortrackings.device.code': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'sensortrackings.device.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'attributes.value': new RegExp(event.queryStringParameters.filter, 'i')
      }
    ];
  }

  if (event.queryStringParameters.sensor) {
    params.match.$or = [
      {
        'name': new RegExp(event.queryStringParameters.sensor, 'i')
      },
      {
        'code': new RegExp(event.queryStringParameters.sensor, 'i')
      }
    ];
    // params.match.producttrackings.currentLocation.name = new RegExp(event.queryStringParameters.product, "i");
  }
  
  if (event.queryStringParameters.locationType === 'known') {
    params.match.$and = [
      { 'sensortrackings.currentLocation.id': { $exists: true } },
      { 'sensortrackings.currentLocation.id': { $ne: '' } },
      { 'sensortrackings.currentLocation.id': { $ne: null } }
    ];
  }

  if (
    mongoose.Types.ObjectId.isValid(event.queryStringParameters.location) &&
    event.queryStringParameters.locationType !== 'unknown'
  ) {
    params.match['sensortrackings.currentLocation.id'] = mongoose.Types.ObjectId(
      event.queryStringParameters.location
    );
  }
  if (event.queryStringParameters.locationType === 'unknown') {
    params.match.$or = [
      { 'sensortrackings.currentLocation.id': { $exists: false } },
      { 'sensortrackings.currentLocation.id': { $eq: '' } },
      { 'sensortrackings.currentLocation.id': { $eq: null } }
    ];
    params.match['sensortrackings.currentLocation.address'] = { $exists: true };
  }

  if (mongoose.Types.ObjectId.isValid(event.queryStringParameters.floor)) {
    params.match['sensortrackings.currentLocation.floor.id'] = mongoose.Types.ObjectId(
      event.queryStringParameters.floor
    );
  }

  if (mongoose.Types.ObjectId.isValid(event.queryStringParameters.zone)) {
    params.match['sensortrackings.currentLocation.zones.id'] = mongoose.Types.ObjectId(
      event.queryStringParameters.zone
    );
  }

  if (event.queryStringParameters.trackedFrom || event.queryStringParameters.trackedTo) {
    params.match['sensortrackings.lastTracked'] = {};
  }

  if (event.queryStringParameters.trackedFrom) {
    params.match['sensortrackings.lastTracked'].$gte = new Date(
      event.queryStringParameters.trackedFrom
    );
  }

  if (event.queryStringParameters.trackedTo) {
    params.match['sensortrackings.lastTracked'].$lte = new Date(
      event.queryStringParameters.trackedTo
    );
  }

  params.match = clientHandler.addClientFilterToConditions(params.match);

  countParams.match = params.match;

  params.limit = event.queryStringParameters.limit
    ? parseInt(event.queryStringParameters.limit, 10)
    : 20;
  params.skip = event.queryStringParameters.offset
    ? parseInt(event.queryStringParameters.offset, 10)
    : 0;

  const sorting = this.extractSortOptions(event, 'sensorlocator');

  params.sort = {};
  // params.sort.code = 1;
  if (!Object.keys(sorting).length) {
    params.sort.code = 1;
    // params.sort.trackedAt = -1;
  } else {
    params.sort = sorting;
  }

  return bluebirdPromise.all([
    this.sensorLocatorData(params),
    this.sensorLocatorCount(countParams)
  ]);
};

/**
 *
 */
sensorLocatorService.prototype.sensorLocatorCount = function(params) {
  const query = [
    {
      $lookup: {
        from: 'sensortrackings',
        localField: '_id',
        foreignField: 'sensor.id',
        as: 'sensortrackings'
      }
    },
    {
      $match: params.match
    },
    {
      $project: {
        code: 1
      }
    }
  ];

  return thingsModel
    .aggregate(query)
    .exec()
    .then(result => result.length);
};

/**
 *
 */
sensorLocatorService.prototype.sensorLocatorData = function(params) {
  const query = [
    {
      $lookup: {
        from: 'sensortrackings',
        localField: '_id',
        foreignField: 'sensor.id',
        as: 'sensortrackings'
      }
    },
    {
      $match: params.match
    },
    {
      $project: {
        code: 1,
        name: 1,
        attributes: 1,
        sensortrackings: 1
      }
    },
    {
      $sort: params.sort
    },
    {
      $skip: params.skip
    },
    {
      $limit: params.limit
    }
  ];

  return thingsModel
    .aggregate(query)
    .collation({
      locale: 'en_US',
      caseLevel: false
    })
    .exec()
    .then(result => {
      const list = [];
      const datalist = [];
      if (result) {
        for (const i in result) {
          if (result.hasOwnProperty(i)) {
            let device = {};
            let trackedAt = '';
            let location = {};

            if (typeof result[i].attributes !== 'undefined') {
              result[i].attributes = commonHelper.moveSystemAttributesToGlobal(result[i]);
              delete result[i].attributes.devicetrackings;
            }

            if (result[i].sensortrackings.length > 0) {
              if (typeof result[i].sensortrackings[0].currentLocation !== 'undefined') {
                if (result[i].sensortrackings[0].currentLocation !== null) {
                  address = commonHelper.moveSystemAttributesToGlobal(
                    result[i].sensortrackings[0].currentLocation,
                    {},
                    'address'
                  );

                  for (const key in address) {
                    result[i].sensortrackings[0].currentLocation[key] = address[key];
                  }
                }
              }
              trackedAt = result[i].sensortrackings[0].lastTracked;
              device = result[i].sensortrackings[0].device;
              location = result[i].sensortrackings[0].currentLocation;
            }

            list.push({
              id: result[i]._id,
              code: result[i].code,
              name: result[i].name,
              trackedAt,
              location,
              device
            });
          }
        }
      }
      // // console.log(list);
      return list;
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};


sensorLocatorService.prototype.sensorLocatorHistory = function(event) {
  const params = {};
  let countParams = {};

  params.match = {
    'sensors.id': mongoose.Types.ObjectId(event.pathParameters.id)
  };
  countParams = {
    'sensors.id': mongoose.Types.ObjectId(event.pathParameters.id)
  };

  if (event.queryStringParameters && event.queryStringParameters.filter) {
    params.match.$or = [
      {
        'location.addresses.code': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'location.addresses.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'location.addresses.address.value': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'location.addresses.zones.code': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'location.addresses.zones.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'location.addresses.floor.code': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'location.addresses.floor.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'sensors.code': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'sensors.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'sensors.product.code': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'sensors.product.name': new RegExp(event.queryStringParameters.filter, 'i')
      }
    ];
  }

  if (event.queryStringParameters.locationType === 'known') {
    params.match.$and = [
      { 'location.addresses.id': { $exists: true } },
      { 'location.addresses.id': { $ne: null } }
    ];
  }

  if (
    mongoose.Types.ObjectId.isValid(event.queryStringParameters.location) &&
    event.queryStringParameters.locationType !== 'unknown'
  ) {
    params.match['location.addresses.id'] = mongoose.Types.ObjectId(
      event.queryStringParameters.location
    );
  }
  if (event.queryStringParameters.locationType === 'unknown') {
    params.match.$or = [
      { 'location.addresses.id': { $exists: false } },
      { 'location.addresses.id': { $eq: null } }
    ];
  }

  if (mongoose.Types.ObjectId.isValid(event.queryStringParameters.floor)) {
    params.match['location.addresses.floor.id'] = mongoose.Types.ObjectId(
      event.queryStringParameters.floor
    );
  }

  if (mongoose.Types.ObjectId.isValid(event.queryStringParameters.zone)) {
    params.match['location.addresses.zones.id'] = mongoose.Types.ObjectId(
      event.queryStringParameters.zone
    );
  }

  if (event.queryStringParameters.trackedFrom || event.queryStringParameters.trackedTo) {
    params.match.trackedAt = {};
  }

  if (event.queryStringParameters.trackedFrom) {
    params.match.trackedAt.$gte = new Date(event.queryStringParameters.trackedFrom);
  }

  if (event.queryStringParameters.trackedTo) {
    params.match.trackedAt.$lte = new Date(event.queryStringParameters.trackedTo);
  }

  params.match = clientHandler.addClientFilterToConditions(params.match);

  countParams = params.match;

  params.limit = event.queryStringParameters.limit
    ? parseInt(event.queryStringParameters.limit, 10)
    : 20;
  params.skip = event.queryStringParameters.offset
    ? parseInt(event.queryStringParameters.offset, 10)
    : 0;

  const sorting = this.extractSortOptions(event, 'sensorlocatorhistory');

  params.sort = {};
  // params.sort.code = 1;
  if (!Object.keys(sorting).length) {
    params.sort.trackedAt = -1;
  } else {
    params.sort = sorting;
  }

  const query = [
    {
      $match: params.match
    },
    {
      $project: {
        deviceInfo: 1,
        trackedAt: 1,
        location: 1
      }
    },
    {
      $sort: params.sort
    },
    {
      $skip: params.skip
    },
    {
      $limit: params.limit
    }
  ];
  // console.log(JSON.stringify(query));
  return bluebirdPromise.all([
    this.sensorLocatorHistoryData(query),
    this.sensorLocatorHistoryCount(countParams)
  ]);
};

sensorLocatorService.prototype.sensorLocatorHistoryCount = function(query) {
  return trackingModel.count(query);
};

/**
 *
 */
sensorLocatorService.prototype.sensorLocatorHistoryData = function(query) {
  return trackingModel
    .aggregate(query)
    .exec()
    .then(result => {
      const list = [];

      if (result) {
        for (const i in result) {
          if (result.hasOwnProperty(i)) {
            let address = {};
            const deviceArray = {};

            /* if (result[i].devicemaster.length > 0) {
              if (typeof result[i].devicemaster[0].attributes !== "undefined") {
                deviceArray = commonHelper.moveSystemAttributesToGlobal(result[i].devicemaster[0]);

                for (let key in deviceArray) {
                  result[i].deviceInfo[key] = deviceArray[key];
                }
              }
            } */

            if (typeof result[i].location.addresses !== 'undefined') {
              address = commonHelper.moveSystemAttributesToGlobal(
                result[i].location.addresses,
                {},
                'address'
              );

              for (const key in address) {
                result[i].location.addresses[key] = address[key];
              }
            }
            // // console.log(result[i].location.addresses)
            // delete result[i].sensors.shipment;
            list.push({
              device: result[i].deviceInfo,
              trackedAt: result[i].trackedAt,
              location: result[i].location
            });
          }
        }
      }
      // // console.log(list);
      return list;
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

sensorLocatorService.prototype.extractSortOptions = function(event, reportType) {
  const sort = {};

  if (event.queryStringParameters.sort) {
    const sortColumns = event.queryStringParameters.sort.split(',');
    sortColumns.forEach(function(col) {
      let sortOrder = 1;
      col = col.trim();
      const isValidColumn =
        this.getColumnMap(col, reportType) || this.getColumnMap(col.replace('-', ''), reportType);

      if (isValidColumn) {
        if (col.startsWith('-')) {
          sortOrder = -1;
          col = col.replace('-', '');
        }

        col = this.getColumnMap(col, reportType);
        sort[col] = sortOrder;
      }
    }, this);
  }

  return sort;
};

sensorLocatorService.prototype.getColumnMap = function getColumnMap(key, reportType) {
  let map = {};

  switch (reportType) {
    case 'productlocator':
      map = {
        productCode: 'code',
        productName: 'name',
        sensor: 'producttrackings.sensor.code',
        location: 'producttrackings.currentLocation.name',
        zone: 'producttrackings.currentLocation.zones.name',
        floor: 'producttrackings.currentLocation.floor.name',
        deviceName: 'producttrackings.device.name',
        deviceCode: 'producttrackings.device.code',
        deviceApp: 'producttrackings.device.appName',
        lastTracked: 'producttrackings.lastTracked'
      };
      break;
    case 'productlocatorhistory':
      map = {
        sensor: 'sensors.code',
        location: 'location.addresses.name',
        floor: 'location.addresses.floor.name',
        zone: 'location.addresses.zones.name',
        deviceName: 'deviceInfo.name',
        deviceCode: 'deviceInfo.code',
        deviceApp: 'deviceInfo.appName',
        lastTracked: 'trackedAt'
      };
      break;
    case 'devicelocator':
      map = {
        deviceCode: 'code',
        deviceName: 'name',
        sensor: 'devicetrackings.sensor.code',
        location: 'devicetrackings.currentLocation.name',
        zone: 'devicetrackings.currentLocation.zones.name',
        floor: 'devicetrackings.currentLocation.floor.name',
        lastTracked: 'devicetrackings.lastTracked'
      };
      break;
    case 'devicelocatorhistory':
      map = {
        sensor: 'sensors.code',
        location: 'location.addresses.name',
        floor: 'location.addresses.floor.name',
        zone: 'location.addresses.zones.name',
        lastTracked: 'trackedAt'
      };
      break;
    case 'userlocator':
      map = {
        deviceCode: 'Username',
        deviceName: 'name',
        sensor: 'usertrackings.sensor.code',
        location: 'usertrackings.currentLocation.name',
        zone: 'usertrackings.currentLocation.zones.name',
        floor: 'usertrackings.currentLocation.floor.name',
        lastTracked: 'usertrackings.lastTracked'
      };
      break;
    
    case 'userlocatorhistory':
      map = {
        sensor: 'sensors.code',
        location: 'location.addresses.name',
        floor: 'location.addresses.floor.name',
        zone: 'location.addresses.zones.name',
        lastTracked: 'trackedAt'
      };
      break;
    case 'sensorlocator':
      map = {
        deviceCode: 'code',
        deviceName: 'name',
        sensorCode: 'sensortrackings.sensor.code',
        sensorName: 'sensortrackings.sensor.name',
        sensorType: 'sensortrackings.sensor.type',
        location: 'sensortrackings.currentLocation.name',
        zone: 'sensortrackings.currentLocation.zones.name',
        floor: 'sensortrackings.currentLocation.floor.name',
        lastTracked: 'sensortrackings.lastTracked'
      };
      break;
    case 'sensorlocatorhistory':
      map = {
        deviceCode: 'deviceInfo.code',
        deviceName: 'deviceInfo.name',
        location: 'location.addresses.name',
        floor: 'location.addresses.floor.name',
        zone: 'location.addresses.zones.name',
        lastTracked: 'trackedAt'
      };
      break;
    default:
      map = {};
  }

  if (key) {
    return map[key] || key;
  }
  return map;
};

module.exports = new sensorLocatorService();
