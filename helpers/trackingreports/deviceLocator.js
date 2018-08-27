const trackingModel = require('../../models/tracking');
const mongoose = require('mongoose');
const bluebirdPromise = require('bluebird');
const commonHelper = require('./../common');
const thingsModel = require('../../models/things');
const clientHandler = require('../../lib/clientHandler');
const deviceLocatorService = function() {};

/**
 * Set client of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
deviceLocatorService.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

/**
 * Set headers of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
deviceLocatorService.prototype.setHeaders = function(headers) {
  this.headers = headers;
};

/**
 * Set headers of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
deviceLocatorService.prototype.setConfigs = () => {
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
deviceLocatorService.prototype.deviceLocator = function(event) {
  const params = {};
  const countParams = {};

  params.devicetrackingslookup = {
    from: 'devicetrackings',
    localField: '_id',
    foreignField: 'device.id',
    as: 'devicetrackings'
  };

  params.project = {
    code: 1,
    name: 1,
    devicetrackings: 1
  };

  countParams.project = {
    code: 1,
    name: 1
  };

  params.match = {
    type: {
      $in: ['gateway', 'software']
    }
  };
  countParams.match = {
    type: {
      $in: ['gateway', 'software']
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
        'devicetrackings.currentLocation.code': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'devicetrackings.currentLocation.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'devicetrackings.currentLocation.address.value': new RegExp(
          event.queryStringParameters.filter,
          'i'
        )
      },
      {
        'devicetrackings.currentLocation.zones.code': new RegExp(
          event.queryStringParameters.filter,
          'i'
        )
      },
      {
        'devicetrackings.currentLocation.zones.name': new RegExp(
          event.queryStringParameters.filter,
          'i'
        )
      },
      {
        'devicetrackings.currentLocation.floor.code': new RegExp(
          event.queryStringParameters.filter,
          'i'
        )
      },
      {
        'devicetrackings.currentLocation.floor.name': new RegExp(
          event.queryStringParameters.filter,
          'i'
        )
      },
      {
        'devicetrackings.sensor.code': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'devicetrackings.sensor.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'attributes.value': new RegExp(event.queryStringParameters.filter, 'i')
      }
    ];
  }

  if (event.queryStringParameters.device) {
    params.match.$or = [
      {
        name: new RegExp(event.queryStringParameters.device, 'i')
      },
      {
        code: new RegExp(event.queryStringParameters.device, 'i')
      }
    ];
    // params.match.producttrackings.currentLocation.name = new RegExp(event.queryStringParameters.product, "i");
  }
  if (event.queryStringParameters.locationType === 'known') {
    params.match.$and = [
      { 'devicetrackings.currentLocation.id': { $exists: true } },
      { 'devicetrackings.currentLocation.id': { $ne: '' } },
      { 'devicetrackings.currentLocation.id': { $ne: null } }
    ];
  }

  if (
    mongoose.Types.ObjectId.isValid(event.queryStringParameters.location) &&
    event.queryStringParameters.locationType !== 'unknown'
  ) {
    params.match['devicetrackings.currentLocation.id'] = mongoose.Types.ObjectId(
      event.queryStringParameters.location
    );
  }
  if (event.queryStringParameters.locationType === 'unknown') {
    params.match.$or = [
      { 'devicetrackings.currentLocation.id': { $exists: false } },
      { 'devicetrackings.currentLocation.id': { $eq: '' } },
      { 'devicetrackings.currentLocation.id': { $eq: null } }
    ];
    params.match['devicetrackings.currentLocation.address'] = { $exists: true };
  }

  if (mongoose.Types.ObjectId.isValid(event.queryStringParameters.floor)) {
    params.match['devicetrackings.currentLocation.floor.id'] = mongoose.Types.ObjectId(
      event.queryStringParameters.floor
    );
  }

  if (mongoose.Types.ObjectId.isValid(event.queryStringParameters.zone)) {
    params.match['devicetrackings.currentLocation.zones.id'] = mongoose.Types.ObjectId(
      event.queryStringParameters.zone
    );
  }

  if (event.queryStringParameters.trackedFrom || event.queryStringParameters.trackedTo) {
    params.match['devicetrackings.lastTracked'] = {};
  }

  if (event.queryStringParameters.trackedFrom) {
    params.match['devicetrackings.lastTracked'].$gte = new Date(
      event.queryStringParameters.trackedFrom
    );
  }

  if (event.queryStringParameters.trackedTo) {
    params.match['devicetrackings.lastTracked'].$lte = new Date(
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

  const sorting = this.extractSortOptions(event, 'devicelocator');

  params.sort = {};
  // params.sort.code = 1;
  if (!Object.keys(sorting).length) {
    params.sort.code = 1;
  } else {
    params.sort = sorting;
  }
  return bluebirdPromise.all([
    this.deviceLocatorData(params),
    this.deviceLocatorCount(countParams)
  ]);
};

/**
 *
 */
deviceLocatorService.prototype.deviceLocatorCount = function(params) {
  const query = [
    {
      $lookup: {
        from: 'devicetrackings',
        localField: '_id',
        foreignField: 'device.id',
        as: 'devicetrackings'
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
deviceLocatorService.prototype.deviceLocatorData = function(params) {
  const query = [
    {
      $lookup: {
        from: 'devicetrackings',
        localField: '_id',
        foreignField: 'device.id',
        as: 'devicetrackings'
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
        devicetrackings: 1
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
            const deviceArray = [];
            let address = {};
            // // console.log(result[i]);
            const device = {};
            let sensors = {};
            let trackedAt = '';
            let location = {};

            if (typeof result[i].attributes !== 'undefined') {
              result[i].attributes = commonHelper.moveSystemAttributesToGlobal(result[i]);
              delete result[i].attributes.devicetrackings;
            }

            if (result[i].devicetrackings.length > 0) {
              if (typeof result[i].devicetrackings[0].currentLocation !== 'undefined') {
                if (result[i].devicetrackings[0].currentLocation !== null) {
                  address = commonHelper.moveSystemAttributesToGlobal(
                    result[i].devicetrackings[0].currentLocation,
                    {},
                    'address'
                  );

                  for (const key in address) {
                    result[i].devicetrackings[0].currentLocation[key] = address[key];
                  }
                }
              }
              trackedAt = result[i].devicetrackings[0].lastTracked;
              sensors = result[i].devicetrackings[0].sensor;
              location = result[i].devicetrackings[0].currentLocation;
            }

            list.push({
              id: result[i]._id,
              code: result[i].code,
              name: result[i].name,
              attributes: result[i].attributes,
              trackedAt,
              sensors,
              location,
              device,
              devicetrackings: result[i].devicetrackings[0]
              // "device" : deviceArray,
              // "address" : address
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

deviceLocatorService.prototype.deviceLocatorMap = function(event) {
  const match = {
    type: {
      $in: ['gateway', 'software']
    }
  };
  const query = [
    {
      $lookup: {
        from: 'devicetrackings',
        localField: '_id',
        foreignField: 'device.id',
        as: 'devicetrackings'
      }
    },
    {
      $match: match
    },
    {
      $project: {
        code: 1,
        name: 1,
        devicetrackings: 1
      }
    }
  ];
  return thingsModel
    .aggregate(query)
    .exec()
    .then(result => {
      const list = [];
      let locations = [];
      const datalist = [];
      if (result) {
        for (const i in result) {
          if (
            result.hasOwnProperty(i) &&
            typeof result[i].devicetrackings !== 'undefined' &&
            result[i].devicetrackings.length > 0
          ) {
            datalist.push(result[i]);
          }
        }

        for (const i in datalist) {
          let found = -1;

          if (datalist[i].devicetrackings[0].currentLocation !== null) {
            if (typeof datalist[i].devicetrackings[0].currentLocation.address !== 'undefined') {
              const address = commonHelper.moveSystemAttributesToGlobal(
                datalist[i].devicetrackings[0].currentLocation,
                {},
                'address'
              );

              for (const key in address) {
                datalist[i].devicetrackings[0].currentLocation[key] = address[key];
              }
            }

            locations.forEach((row, idx) => {
              if (
                datalist[i].devicetrackings[0].currentLocation.id !== null &&
                row.key === `${datalist[i].devicetrackings[0].currentLocation.id}`
              ) {
                found = idx;
              } else if (
                datalist[i].devicetrackings[0].currentLocation.id === null &&
                row.key ===
                  `${datalist[i].devicetrackings[0].currentLocation.pointCoordinates
                    .coordinates[1]}-${datalist[i].devicetrackings[0].currentLocation
                    .pointCoordinates.coordinates[0]}`
              ) {
                found = idx;
              }
            });

            if (found === -1) {
              if (datalist[i].devicetrackings[0].currentLocation.id !== null) {
                locations.push({
                  type: 'known',
                  key: `${datalist[i].devicetrackings[0].currentLocation.id}`,
                  id: datalist[i].devicetrackings[0].currentLocation.id,
                  code: datalist[i].devicetrackings[0].currentLocation.code,
                  location: datalist[i].devicetrackings[0].currentLocation.name,
                  devices: []
                });
              } else {
                locations.push({
                  type: 'unknown',
                  key: `${datalist[i].devicetrackings[0].currentLocation.pointCoordinates
                    .coordinates[1]}-${datalist[i].devicetrackings[0].currentLocation
                    .pointCoordinates.coordinates[0]}`,
                  id: null,
                  code: null,
                  location: [
                    datalist[i].devicetrackings[0].currentLocation.address,
                    datalist[i].devicetrackings[0].currentLocation.city,
                    datalist[i].devicetrackings[0].currentLocation.state,
                    datalist[i].devicetrackings[0].currentLocation.country
                  ].join(', '),
                  devices: []
                });
              }
            }
          }
        }

        for (const i in datalist) {
          if (datalist[i].devicetrackings[0].currentLocation !== null) {
            locations = locations.map((row, idx) => {
              if (
                (datalist[i].devicetrackings[0].currentLocation.id !== null &&
                  row.key === `${datalist[i].devicetrackings[0].currentLocation.id}`) ||
                (datalist[i].devicetrackings[0].currentLocation.id === null &&
                  row.key ===
                    `${datalist[i].devicetrackings[0].currentLocation.pointCoordinates
                      .coordinates[1]}-${datalist[i].devicetrackings[0].currentLocation
                      .pointCoordinates.coordinates[0]}`)
              ) {
                const obj = {
                  id: datalist[i]._id,
                  code: datalist[i].code,
                  name: datalist[i].name,
                  sensor: {},
                  trackedAt: datalist[i].devicetrackings[0].lastTracked
                };

                if (datalist[i].devicetrackings[0].sensor) {
                  obj.sensor = {
                    id: datalist[i].devicetrackings[0].sensor.id,
                    code: datalist[i].devicetrackings[0].sensor.code,
                    name: datalist[i].devicetrackings[0].sensor.name
                  };
                }
                row.devices.push(obj);
                return row;
              }
              return row;
            });
          }
        }
      }
      return [locations, locations.length];
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};


deviceLocatorService.prototype.deviceLocatorHistory = function(event) {
  const params = {};
  let countParams = {};

  params.match = {
    'deviceInfo.id': mongoose.Types.ObjectId(event.pathParameters.id)
  };
  countParams = {
    'deviceInfo.id': mongoose.Types.ObjectId(event.pathParameters.id)
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

  const sorting = this.extractSortOptions(event, 'devicelocatorhistory');

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
        sensors: 1,
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
    this.deviceLocatorHistoryData(query),
    this.deviceLocatorHistoryCount(countParams)
  ]);
};

deviceLocatorService.prototype.deviceLocatorHistoryCount = function(query) {
  return trackingModel.count(query);
};

/**
 *
 */
deviceLocatorService.prototype.deviceLocatorHistoryData = function(query) {
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
            delete result[i].sensors.shipment;
            list.push({
              sensors: result[i].sensors,
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

deviceLocatorService.prototype.deviceLocatorHistoryMap = function(event) {
  const match = {
    'deviceInfo.id': mongoose.Types.ObjectId(event.pathParameters.id)
  };
  if (event.queryStringParameters.trackedFrom || event.queryStringParameters.trackedTo) {
    match.trackedAt = {};
  }

  if (event.queryStringParameters.trackedFrom) {
    match.trackedAt.$gte = new Date(event.queryStringParameters.trackedFrom);
  }

  if (event.queryStringParameters.trackedTo) {
    match.trackedAt.$lte = new Date(event.queryStringParameters.trackedTo);
  }
  const query = [
    {
      $match: match
    },
    {
      $project: {
        location: 1,
        sensors: 1,
        trackedAt: 1
      }
    },
    {
      $sort: {
        trackedAt: -1
      }
    },
    {
      $limit: 5000
    }
  ];
  return trackingModel
    .aggregate(query)
    .exec()
    .then(result => {
      const list = [];
      const locations = [];
      const datalist = [];
      if (result) {
        let oldRecord = null;
        for (const i in result) {
          if (result.hasOwnProperty(i)) {
            if (oldRecord === null) {
              datalist.push(result[i]);
              oldRecord = result[i];
            } else {
              // console.log(oldRecord.location.addresses.id);
              if (result[i].location.addresses.id === null) {
                if (oldRecord.location.addresses.id === null) {
                  const lat = Number(
                    result[i].location.addresses.pointCoordinates.coordinates[1].toFixed(4)
                  );
                  const lon = Number(
                    result[i].location.addresses.pointCoordinates.coordinates[0].toFixed(4)
                  );

                  const olat = Number(
                    oldRecord.location.addresses.pointCoordinates.coordinates[1].toFixed(4)
                  );
                  const olon = Number(
                    oldRecord.location.addresses.pointCoordinates.coordinates[0].toFixed(4)
                  );

                  if (olat !== lat || olon !== lon) {
                    datalist.push(result[i]);
                    oldRecord = result[i];
                  }
                } else {
                  datalist.push(result[i]);
                  oldRecord = result[i];
                }
              } else if (oldRecord.location.addresses.id !== null) {
                if (
                  result[i].location.addresses.id.toString() !==
                  oldRecord.location.addresses.id.toString()
                ) {
                  datalist.push(result[i]);
                  oldRecord = result[i];
                }
              } else {
                datalist.push(result[i]);
                oldRecord = result[i];
              }
            }
          }
        }

        for (const i in datalist) {
          const found = -1;
          if (typeof datalist[i].location.addresses.address !== 'undefined') {
            const address = commonHelper.moveSystemAttributesToGlobal(
              datalist[i].location.addresses,
              {},
              'address'
            );

            for (const key in address) {
              datalist[i].location.addresses[key] = address[key];
            }
          }

          datalist[i].sensor = {
            id: datalist[i].sensors.id,
            code: datalist[i].sensors.code,
            name: datalist[i].sensors.name
          };
          delete datalist[i].sensors;
        }
      }

      return [datalist, datalist.length];
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};


deviceLocatorService.prototype.extractSortOptions = function(event, reportType) {
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

deviceLocatorService.prototype.getColumnMap = function getColumnMap(key, reportType) {
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

module.exports = new deviceLocatorService();
