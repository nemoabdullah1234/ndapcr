const trackingModel = require('../../models/tracking');
const mongoose = require('mongoose');
const bluebirdPromise = require('bluebird');
const commonHelper = require('./../common');
const productModel = require('../../models/product');
const clientHandler = require('../../lib/clientHandler');

const productLocatorService = function() {};

/**
 * Set client of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
productLocatorService.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

/**
 * Set headers of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
productLocatorService.prototype.setHeaders = function(headers) {
  this.headers = headers;
};

/**
 * Set headers of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
productLocatorService.prototype.setConfigs = () =>
  // console.log('config');
  require('./../configuration')
    .getConfigurations()
    .then(configs => {
      this.configs = configs;
    });

/**
 * 
 */
productLocatorService.prototype.productLocator = function(event) {
  const params = {};
  const countParams = {};

  params.producttrackingslookup = {
    from: 'producttrackings',
    localField: '_id',
    foreignField: 'product.id',
    as: 'producttrackings'
  };

  params.devicelookup = {
    from: 'things',
    localField: '_id',
    foreignField: 'producttrackings._id',
    as: 'devicemaster'
  };

  params.project = {
    code: 1,
    name: 1,
    producttrackings: 1,
    devicemaster: 1
  };

  countParams.project = {
    code: 1,
    name: 1
  };

  params.match = {};
  countParams.match = {};

  if (event.queryStringParameters && event.queryStringParameters.filter) {
    params.match.$or = [
      {
        code: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        name: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'producttrackings.currentLocation.code': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'producttrackings.currentLocation.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'producttrackings.currentLocation.address.value': new RegExp(
          event.queryStringParameters.filter,
          'i'
        )
      },
      {
        'producttrackings.device.appName': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'producttrackings.currentLocation.zones.code': new RegExp(
          event.queryStringParameters.filter,
          'i'
        )
      },
      {
        'producttrackings.currentLocation.zones.name': new RegExp(
          event.queryStringParameters.filter,
          'i'
        )
      },
      {
        'producttrackings.currentLocation.floor.code': new RegExp(
          event.queryStringParameters.filter,
          'i'
        )
      },
      {
        'producttrackings.currentLocation.floor.name': new RegExp(
          event.queryStringParameters.filter,
          'i'
        )
      },
      {
        'producttrackings.sensor.code': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'producttrackings.sensor.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'producttrackings.device.code': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'producttrackings.device.name': new RegExp(event.queryStringParameters.filter, 'i')
      }
    ];
  }

  if (event.queryStringParameters.product) {
    params.match.$and = [];
    const cnd = [
      {
        name: new RegExp(event.queryStringParameters.product, 'i')
      },
      {
        code: new RegExp(event.queryStringParameters.product, 'i')
      }
    ];
    params.match.$and.push({ $or: cnd });
    // params.match.producttrackings.currentLocation.name = new RegExp(event.queryStringParameters.product, "i");
  }

  if (mongoose.Types.ObjectId.isValid(event.queryStringParameters.location)) {
    params.match['producttrackings.currentLocation.id'] = mongoose.Types.ObjectId(
      event.queryStringParameters.location
    );
  }

  if (mongoose.Types.ObjectId.isValid(event.queryStringParameters.floor)) {
    params.match['producttrackings.currentLocation.floor.id'] = mongoose.Types.ObjectId(
      event.queryStringParameters.floor
    );
  }

  if (mongoose.Types.ObjectId.isValid(event.queryStringParameters.zone)) {
    params.match['producttrackings.currentLocation.zones.id'] = mongoose.Types.ObjectId(
      event.queryStringParameters.zone
    );
  }
  if (event.queryStringParameters.rng) {
    if (event.queryStringParameters.rng === '0') {
      if (!Array.isArray(params.match.$and)) {
        params.match.$and = [];
      }
      const cnd = [
        { 'producttrackings.sensor.rng': 0 },
        { 'producttrackings.sensor.rng': { $exists: false } }
      ];
      params.match.$and.push({ $or: cnd });
    } else {
      params.match['producttrackings.sensor.rng'] = parseInt(event.queryStringParameters.rng, 10);
    }
  }

  if (event.queryStringParameters.trackedFrom || event.queryStringParameters.trackedTo) {
    params.match['producttrackings.lastTracked'] = {};
  }

  if (event.queryStringParameters.trackedFrom) {
    params.match['producttrackings.lastTracked'].$gte = new Date(
      event.queryStringParameters.trackedFrom
    );
  }

  if (event.queryStringParameters.trackedTo) {
    params.match['producttrackings.lastTracked'].$lte = new Date(
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

  const sorting = this.extractSortOptions(event, 'productlocator');

  params.sort = {};
  // params.sort.code = 1;
  if (!Object.keys(sorting).length) {
    params.sort.code = 1;
  } else {
    params.sort = sorting;
  }

  return bluebirdPromise.all([
    this.productLocatorData(params),
    this.productLocatorCount(countParams)
  ]);
};

/**
 *
 */
productLocatorService.prototype.productLocatorCount = function(params) {
  const query = [
    {
      $lookup: {
        from: 'producttrackings',
        localField: '_id',
        foreignField: 'product.id',
        as: 'producttrackings'
      }
    },
    {
      $lookup: {
        from: 'things',
        localField: 'producttrackings.device.id',
        foreignField: '_id',
        as: 'devicemaster'
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

  return productModel
    .aggregate(query)
    .exec()
    .then(result => result.length);
};

/**
 *
 */
productLocatorService.prototype.productLocatorData = function(params) {
  const query = [
    {
      $lookup: {
        from: 'producttrackings',
        localField: '_id',
        foreignField: 'product.id',
        as: 'producttrackings'
      }
    },
    {
      $lookup: {
        from: 'things',
        localField: 'producttrackings.device.id',
        foreignField: '_id',
        as: 'devicemaster'
      }
    },
    {
      $match: params.match
    },
    {
      $project: {
        code: 1,
        name: 1,
        producttrackings: 1,
        'devicemaster.attributes': 1
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

  return productModel
    .aggregate(query)
    .exec()
    .then(result => {
      const list = [];

      if (result) {
        for (const i in result) {
          if (result.hasOwnProperty(i)) {
            let deviceArray = [];
            let address = {};
            // // console.log(result[i]);
            let device = {};
            let sensors = {};
            let trackedAt = '';
            let location = {};

            if (result[i].devicemaster.length > 0) {
              if (
                typeof result[i].devicemaster[0].attributes !== 'undefined' &&
                result[i].devicemaster[0].attributes !== null
              ) {
                deviceArray = commonHelper.moveSystemAttributesToGlobal(result[i].devicemaster[0]);

                for (const key in deviceArray) {
                  result[i].producttrackings[0].device[key] = deviceArray[key];
                }
              }
              device = result[i].producttrackings[0].device;
            }

            if (result[i].producttrackings.length > 0) {
              if (
                typeof result[i].producttrackings[0].currentLocation !== 'undefined' &&
                result[i].producttrackings[0].currentLocation !== null
              ) {
                address = commonHelper.moveSystemAttributesToGlobal(
                  result[i].producttrackings[0].currentLocation,
                  {},
                  'address'
                );

                for (const key in address) {
                  result[i].producttrackings[0].currentLocation[key] = address[key];
                }
              }
              trackedAt = result[i].producttrackings[0].lastTracked;
              sensors = result[i].producttrackings[0].sensor;
              location = result[i].producttrackings[0].currentLocation;
            }
            // if (
            //   !(
            //     (device.type === 'software' && device.appName === 'gateway') ||
            //     device.type === 'gateway'
            //   )
            // ) {
            //   delete sensors.rng;
            // }
            sensors.rng = sensors.rng || 0;
            list.push({
              id: result[i]._id,
              code: result[i].code,
              name: result[i].name,
              trackedAt,
              sensors,
              location,
              device,
              producttrackings: result[i].producttrackings[0]
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

productLocatorService.prototype.productLocatorHistory = function(event) {
  const params = {};
  let countParams = {};

  params.match = {
    'sensors.product.id': mongoose.Types.ObjectId(event.pathParameters.id)
  };
  countParams = {
    'sensors.product.id': mongoose.Types.ObjectId(event.pathParameters.id)
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
        'deviceInfo.code': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'deviceInfo.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'deviceInfo.appName': new RegExp(event.queryStringParameters.filter, 'i')
      }
    ];
  }

  if (mongoose.Types.ObjectId.isValid(event.queryStringParameters.location)) {
    params.match['location.addresses.id'] = mongoose.Types.ObjectId(
      event.queryStringParameters.location
    );
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

  const sorting = this.extractSortOptions(event, 'productlocatorhistory');

  params.sort = {};
  // params.sort.code = 1;
  if (!Object.keys(sorting).length) {
    params.sort.trackedAt = -1;
  } else {
    params.sort = sorting;
  }

  const query = [
    {
      $lookup: {
        from: 'things',
        localField: 'deviceInfo.id',
        foreignField: '_id',
        as: 'devicemaster'
      }
    },
    {
      $unwind: '$devicemaster'
    },
    {
      $match: params.match
    },
    {
      $project: {
        sensors: 1,
        deviceInfo: 1,
        trackedAt: 1,
        location: 1,
        devicemaster: 1
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
    this.productLocatorHistoryData(query),
    this.productLocatorHistoryCount(countParams)
  ]);
};

productLocatorService.prototype.productLocatorHistoryCount = function(query) {
  return trackingModel.count(query);
};

/**
 *
 */
productLocatorService.prototype.productLocatorHistoryData = function(query) {
  return trackingModel
    .aggregate(query)
    .exec()
    .then(result => {
      const list = [];

      if (result) {
        for (const i in result) {
          if (result.hasOwnProperty(i)) {
            let address = {};
            let deviceArray = {};

            // if (result[i].devicemaster.length > 0) {
            if (typeof result[i].devicemaster.attributes !== 'undefined') {
              deviceArray = commonHelper.moveSystemAttributesToGlobal(result[i].devicemaster);

              for (const key in deviceArray) {
                result[i].deviceInfo[key] = deviceArray[key];
              }
            }
            // }

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
            delete result[i].sensors.product;
            delete result[i].sensors.shipment;
            delete result[i].deviceInfo.client;
            list.push({
              sensors: result[i].sensors,
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

productLocatorService.prototype.productLocatorMap = function(event) {
  const match = {};
  const query = [
    {
      $lookup: {
        from: 'producttrackings',
        localField: '_id',
        foreignField: 'product.id',
        as: 'producttrackings'
      }
    },
    {
      $match: match
    },
    {
      $project: {
        code: 1,
        name: 1,
        producttrackings: 1
      }
    }
  ];
  return productModel
    .aggregate(query)
    .exec()
    .then(result => {
      // let list = [];
      let locations = [];
      const datalist = [];
      if (result) {
        for (const i in result) {
          if (
            result.hasOwnProperty(i) &&
            typeof result[i].producttrackings !== 'undefined' &&
            result[i].producttrackings.length > 0
          ) {
            datalist.push(result[i]);
          }
        }

        for (const i in datalist) {
          let found = -1;

          if (
            datalist[i].producttrackings[0].currentLocation !== null &&
            typeof datalist[i].producttrackings[0].currentLocation.address !== 'undefined'
          ) {
            const address = commonHelper.moveSystemAttributesToGlobal(
              datalist[i].producttrackings[0].currentLocation,
              {},
              'address'
            );

            for (const key in address) {
              datalist[i].producttrackings[0].currentLocation[key] = address[key];
            }
          }

          locations.forEach((row, idx) => {
            if (
              datalist[i].producttrackings[0].currentLocation !== null &&
              datalist[i].producttrackings[0].currentLocation.id !== null &&
              row.key === `${datalist[i].producttrackings[0].currentLocation.id}`
            ) {
              found = idx;
            } else if (
              datalist[i].producttrackings[0].currentLocation !== null &&
              datalist[i].producttrackings[0].currentLocation.id === null &&
              row.key ===
                `${datalist[i].producttrackings[0].currentLocation.pointCoordinates
                  .coordinates[1]}-${datalist[i].producttrackings[0].currentLocation
                  .pointCoordinates.coordinates[0]}`
            ) {
              found = idx;
            }
          });

          if (found === -1) {
            if (datalist[i].producttrackings[0].currentLocation !== null) {
              if (datalist[i].producttrackings[0].currentLocation.id !== null) {
                locations.push({
                  type: 'known',
                  key: `${datalist[i].producttrackings[0].currentLocation.id}`,
                  id: datalist[i].producttrackings[0].currentLocation.id,
                  code: datalist[i].producttrackings[0].currentLocation.code,
                  location: datalist[i].producttrackings[0].currentLocation.name,
                  products: []
                });
              } else {
                locations.push({
                  type: 'unknown',
                  key: `${datalist[i].producttrackings[0].currentLocation.pointCoordinates
                    .coordinates[1]}-${datalist[i].producttrackings[0].currentLocation
                    .pointCoordinates.coordinates[0]}`,
                  id: null,
                  code: null,
                  location: [
                    datalist[i].producttrackings[0].currentLocation.address,
                    datalist[i].producttrackings[0].currentLocation.city,
                    datalist[i].producttrackings[0].currentLocation.state,
                    datalist[i].producttrackings[0].currentLocation.country
                  ].join(', '),
                  products: []
                });
              }
            }
          }
        }

        for (const i in datalist) {
          locations = locations.map((row, idx) => {
            if (
              (datalist[i].producttrackings[0].currentLocation !== null &&
                (datalist[i].producttrackings[0].currentLocation.id !== null &&
                  row.key === `${datalist[i].producttrackings[0].currentLocation.id}`)) ||
              (datalist[i].producttrackings[0].currentLocation !== null &&
                datalist[i].producttrackings[0].currentLocation.id === null &&
                row.key ===
                  `${datalist[i].producttrackings[0].currentLocation.pointCoordinates
                    .coordinates[1]}-${datalist[i].producttrackings[0].currentLocation
                    .pointCoordinates.coordinates[0]}`)
            ) {
              const obj = {
                id: datalist[i]._id,
                code: datalist[i].code,
                name: datalist[i].name,
                sensor: {},
                trackedAt: datalist[i].producttrackings[0].lastTracked
              };

              if (datalist[i].producttrackings[0].sensor) {
                obj.sensor = {
                  id: datalist[i].producttrackings[0].sensor.id,
                  code: datalist[i].producttrackings[0].sensor.code,
                  name: datalist[i].producttrackings[0].sensor.name
                };
              }
              row.products.push(obj);
              return row;
            }
            return row;
          });
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

productLocatorService.prototype.productLocatorHistoryMap = function(event) {
  const match = {
    'sensors.product.id': mongoose.Types.ObjectId(event.pathParameters.id)
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
            } else if (result[i].location.addresses.id === null) {
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

productLocatorService.prototype.extractSortOptions = function(event, reportType) {
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

productLocatorService.prototype.getColumnMap = function getColumnMap(key, reportType) {
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

module.exports = new productLocatorService();
