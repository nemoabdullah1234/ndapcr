const mongoose = require('mongoose');
const bluebirdPromise = require('bluebird');
const commonHelper = require('./../common');
const shipmentmodel = require('../../models/shipment');
const shipmentLocatorService = function() {};
const shipmentStatusLabel = require('../../mappings/shipmentStatusLabel.json');
const shipmentStatusMap = require('../../mappings/shipmentStatus.json');
const akUtils = require('../../lib/utility');
const trackingModel = require('../../models/tracking');
const shipmentOrchestrationHelper = require('../shipmentOrchestration');


/**
 * Set client of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
shipmentLocatorService.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

/**
 * Set headers of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
shipmentLocatorService.prototype.setHeaders = function(headers) {
  this.headers = headers;
};

/**
 * Set headers of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
shipmentLocatorService.prototype.setConfigs = () => {
  // console.log('config');
  return require('./../configuration')
    .getConfigurations()
    .then(configs => {
      this.configs = configs;
    });
};

shipmentLocatorService.prototype.shipmentLocatorMap = function(event) {
  const match = {
    shipmentStatus: {
      $nin: [shipmentStatusMap.Open, shipmentStatusMap.Closed, shipmentStatusMap.Canceled]
    }
  };
  // const match = {};
  const query = [
    {
      $lookup: {
        from: 'shipmenttrackings',
        localField: '_id',
        foreignField: 'shipment.id',
        as: 'shipmenttrackings'
      }
    },
    {
      $match: match
    },
    {
      $project: {
        code: 1,
        name: 1,
        shipmentStatus: 1,
        addresses: 1,
        etd: 1,
        shipmenttrackings: 1
      }
    }
  ];
  // // console.log(query);
  return shipmentmodel
    .aggregate(query)
    .exec()
    .then(result => {
      // // console.log(result);
      // let list = [];
      let locations = [];
      const datalist = [];
      if (result) {
        for (const i in result) {
          if (
            result.hasOwnProperty(i) &&
            typeof result[i].shipmenttrackings !== 'undefined' &&
            result[i].shipmenttrackings.length > 0
          ) {
            datalist.push(result[i]);
          }
        }

        for (const i in datalist) {
          let found = -1;

          if (typeof datalist[i].shipmenttrackings[0].currentLocation.address !== 'undefined') {
            const address = commonHelper.moveSystemAttributesToGlobal(
              datalist[i].shipmenttrackings[0].currentLocation,
              {},
              'address'
            );

            for (const key in address) {
              datalist[i].shipmenttrackings[0].currentLocation[key] = address[key];
            }
          }

          locations.forEach((row, idx) => {
            if (
              datalist[i].shipmenttrackings[0].currentLocation.id !== null &&
              row.key === datalist[i].shipmenttrackings[0].currentLocation.id.toString()
            ) {
              found = idx;
            } else if (
              datalist[i].shipmenttrackings[0].currentLocation.id === null &&
              row.key ===
                `${datalist[i].shipmenttrackings[0].currentLocation.pointCoordinates
                  .coordinates[1]}-${datalist[i].shipmenttrackings[0].currentLocation
                  .pointCoordinates.coordinates[0]}`
            ) {
              found = idx;
            }
          });

          if (found === -1) {
            if (datalist[i].shipmenttrackings[0].currentLocation.id !== null) {
              locations.push({
                type: 'known',
                key: datalist[i].shipmenttrackings[0].currentLocation.id.toString(),
                id: datalist[i].shipmenttrackings[0].currentLocation.id,
                code: datalist[i].shipmenttrackings[0].currentLocation.code,
                location: datalist[i].shipmenttrackings[0].currentLocation.name,
                shipments: []
              });
            } else {
              locations.push({
                type: 'unknown',
                key: `${datalist[i].shipmenttrackings[0].currentLocation.pointCoordinates
                  .coordinates[1]}-${datalist[i].shipmenttrackings[0].currentLocation
                  .pointCoordinates.coordinates[0]}`,
                id: null,
                code: null,
                location: [
                  datalist[i].shipmenttrackings[0].currentLocation.address,
                  datalist[i].shipmenttrackings[0].currentLocation.city,
                  datalist[i].shipmenttrackings[0].currentLocation.state,
                  datalist[i].shipmenttrackings[0].currentLocation.country
                ].join(', '),
                shipments: []
              });
            }
          }
        }

        for (const i in datalist) {
          locations = locations.map((row, idx) => {
            if (
              (datalist[i].shipmenttrackings[0].currentLocation.id !== null &&
                row.key === datalist[i].shipmenttrackings[0].currentLocation.id.toString()) ||
              (datalist[i].shipmenttrackings[0].currentLocation.id === null &&
                row.key ===
                  `${datalist[i].shipmenttrackings[0].currentLocation.pointCoordinates
                    .coordinates[1]}-${datalist[i].shipmenttrackings[0].currentLocation
                    .pointCoordinates.coordinates[0]}`)
            ) {
              const toaddressObj = datalist[i].addresses.filter(addrrow => {
                if (addrrow.addressType === 'shipToAddress') {
                  return true;
                }
                return false;
              });

              const obj = {
                id: datalist[i]._id,
                code: datalist[i].code,
                name: datalist[i].name,
                status: datalist[i].shipmentStatus,
                etd: datalist[i].etd,
                toaddress: toaddressObj[0].location,
                statusLabel:
                  akUtils.objectKeyByValue(shipmentStatusLabel, datalist[i].shipmentStatus) || '',
                sensor: {},
                trackedAt: datalist[i].shipmenttrackings[0].lastTracked
              };

              if (datalist[i].shipmenttrackings[0].sensor) {
                obj.sensor = {
                  id: datalist[i].shipmenttrackings[0].sensor.id,
                  code: datalist[i].shipmenttrackings[0].sensor.code,
                  name: datalist[i].shipmenttrackings[0].sensor.name
                };
              }
              row.shipments.push(obj);
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


shipmentLocatorService.prototype.shipmentLocatorHistoryMap = function(event, params) {

  const match = {
    'sensors.shipment.id': mongoose.Types.ObjectId(event.pathParameters.id)
  };
  // let isDelivered = false;
  // if ( params ) {
  //   match.trackedAt = {};
  //   params.forEach( (obj) => {
  //     if ( obj.shipmentStatus === shipmentStatusMap.Scheduled ) {
  //       match.trackedAt.$gte = new Date(obj.actionTime);
  //     }
  //     if (
  //       obj.shipmentStatus === shipmentStatusMap.PartialDelivered ||
  //       obj.shipmentStatus === shipmentStatusMap.SoftDelivered ||
  //       obj.shipmentStatus === shipmentStatusMap.Delivered
  //     ) {
  //       isDelivered = true;
  //       match.trackedAt.$lte = new Date(obj.actionTime.getTime() + 60 * 60000);
  //     }     
  //   });
  //   if ( !isDelivered ) {  // reset filter if not delivered
  //     match.trackedAt = {};
  //   }
  // } else {
  //   // if date filters passed through url
  //   if (event.queryStringParameters.trackedFrom || event.queryStringParameters.trackedTo) {
  //     match.trackedAt = {};
  //   }

  //   if (event.queryStringParameters.trackedFrom) {
  //     match.trackedAt.$gte = new Date(event.queryStringParameters.trackedFrom);
  //   }

  //   if (event.queryStringParameters.trackedTo) {
  //     match.trackedAt.$lte = new Date(event.queryStringParameters.trackedTo);
  //   }
  // }

  // console.log(match);
  
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
        trackedAt: 1
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

module.exports = new shipmentLocatorService();
