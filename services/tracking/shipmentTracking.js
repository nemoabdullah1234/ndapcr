const shipmentTrackingModel = require('./../../models/shipmentTracking');
const akUtils = require('./../../lib/utility');
const bluebirdPromise = require('bluebird');
const shipmentmodel = require('./../../models/shipment');
const commonTrackingService = require('./common.js');

const shipmentTrackingService = function() {};

/**
 * Get Shipment information from tracking data
 * 
 * @param {Object} pointData
 * @return {Promise} Promise to represent the shipment for tracking data
 * 
 */
shipmentTrackingService.prototype.getShipmentData = function(pointData) {
  const shipmentStatus = require('./../../mappings/shipmentStatus.json');

  // ASSUMED STATUS 2 : Scheduled, 3 : SoftShipped, 4 : Shipped, 5 : SoftDelivered
  // Filter TODO : Current TS must be greater than schduled TS
  // Filter TODO : last location must be different than current location OR last lat/lon must be different than current lat/lon

  let conditions = {
    products: { $elemMatch: { things: { $elemMatch: { code: pointData.sensors.code } } } },
    shipmentStatus: {
      $in: [
        shipmentStatus.Scheduled,
        shipmentStatus.PartialShipped,
        shipmentStatus.SoftShipped,
        shipmentStatus.Shipped,
        shipmentStatus.PartialDelivered,
        shipmentStatus.SoftDelivered
      ]
    }
  };

  const clientHandler = require('./../../lib/clientHandler');
  clientHandler.setClient({ clientId: pointData.clientid, projectId: pointData.projectid });
  conditions = clientHandler.addClientFilterToConditions(conditions);

  // akUtils.log(pointData.sensors);
  // akUtils.log(pointData.sensors.code);
  // akUtils.log(conditions);
  return shipmentmodel.find(conditions).then(results => {
    if (results === null || results.length === 0) {
      akUtils.log('Not trackable shipment found .');
      return [];
    }
    akUtils.log('Trackable shipment found .');
    const shipments = [];

    results.forEach(row => {
      shipments.push({
        _id: row._id,
        code: row.code,
        name: row.name,
        shipmentStatus: row.shipmentStatus
      });
    });

    return shipments;
  });
};

/**
 * Set Shipment Tracking /  tracking hsitory / IOT
 * 
 * @param {Object} shipmentId shipment Id
 * @param {Object} pointData Tracking Data
 * @return {Promise} Promise after saving
 * 
 */
shipmentTrackingService.prototype.saveShipmentTracking = function(pointData, currentLocation) {
  const shipmentStatusLabel = require('./../../mappings/shipmentStatusLabel.json');
  return this.getShipmentData(pointData).then(shipments => {
    const promises = shipments.map(shipmentObj => {
      if (shipmentObj === null || typeof shipmentObj._id === 'undefined') {
        akUtils.log('No valid shipment attached.');
        return;
      }

      const self = this;

      return bluebirdPromise.join(
        self.updateShipmentLocation(shipmentObj, pointData, currentLocation),
        commonTrackingService.updateTrackingLocation(
          'shipment',
          { id: shipmentObj._id, code: shipmentObj.code, name: shipmentObj.name },
          pointData,
          currentLocation
        ),
        // self.addCloudWatchMetrics(pointData),
        commonTrackingService.pushToIot(
          'shipment',
          {
            id: shipmentObj._id,
            code: shipmentObj.code,
            name: shipmentObj.name,
            status: shipmentObj.shipmentStatus,
            statusLabel: akUtils.objectKeyByValue(shipmentStatusLabel, shipmentObj.shipmentStatus)
          },
          pointData,
          currentLocation,
          process.env.shipmentTrackingIotTopic
        ),
        (shipmentResults, trackingResults, iotResults) => {}
      );
    });
    return bluebirdPromise.all(promises);
  });
};

/**
 * Update Shipment tracking information from tracking data
 * 
 * @param {Object} shipmentobj Shipment Data
 * @param {Object} pointData Tracking Data
 * @param {Object} currenLocation Location Object
 * @return {Promise} Promise after saving
 * 
 */
shipmentTrackingService.prototype.updateShipmentLocation = function(
  shipmentobj,
  pointData,
  currentLocation
) {
  akUtils.log('IN SHIP FUNCITON');
  akUtils.log(shipmentobj.code);
  akUtils.log(pointData.did);
  const conditions = { 'shipment.id': shipmentobj._id };
  let lastLocation = {};
  let lastTrackingObj = null;
  return shipmentTrackingModel
    .findOne(conditions)
    .then(shipmentTrackingObj => {
      if (shipmentTrackingObj !== null) {
        lastTrackingObj = shipmentTrackingObj;
        lastLocation = shipmentTrackingObj.currentLocation;
      }
      return lastLocation;
    })
    .then(() => {
      if (
        lastTrackingObj === null ||
        lastTrackingObj.lastTracked.getTime() < new Date(pointData.ts).getTime()
      ) {
        let lastMoved = new Date(pointData.ts);
        if (lastTrackingObj !== null) {
          lastMoved = lastTrackingObj.lastMoved;
          if (currentLocation.id !== null && lastLocation.id !== null) {
            if (lastLocation.id.toString() !== currentLocation.id.toString()) {
              lastMoved = new Date(pointData.ts);
            }
          } else if (
            (lastLocation.id === null && currentLocation.id !== null) ||
            (lastLocation.id !== null && currentLocation.id === null)
          ) {
            lastMoved = new Date(pointData.ts);
          } else if (
            lastLocation.address[0].value !== currentLocation.address[0].value ||
            lastLocation.address[1].value !== currentLocation.address[1].value
          ) {
            lastMoved = new Date(pointData.ts);
          }
        } else {
          lastMoved = new Date(pointData.ts);
        }
        if (typeof lastMoved === 'undefined') {
          lastMoved = new Date();
        }
        const updateParams = {
          $set: {
            shipment: {
              id: shipmentobj._id,
              code: shipmentobj.code,
              name: shipmentobj.name
            },
            client: pointData.client,
            pointId: pointData._id,
            currentLocation,
            sensor: {
              id: pointData.sensors.id,
              code: pointData.sensors.code,
              name: pointData.sensors.name,
              rng: pointData.sensors.rng
            },
            device: pointData.deviceInfo,
            lastTracked: new Date(pointData.ts),
            lastMoved
          }
        };
        return shipmentTrackingModel.update(conditions, updateParams).exec();
      }
      return false;
    });
  /*
  shipmentTrackingModel.findOne({'shipment.id' : shipmentobj._id}).then((shipmentTrackingObj) => {
    if(shipmentTrackingObj === null) {
      shipmentTrackingObj = new shipmentTrackingModel(); 
      shipmentTrackingObj.shipment = {
        'id' : shipmentobj._id,
        'code' : shipmentobj.code,
        'name' : shipmentobj.name
      };
    }
    shipmentTrackingObj.client = this.client;
    shipmentTrackingObj.pointId = pointData._id;
    shipmentTrackingObj.currentLocation = currentLocation;
    shipmentTrackingObj.device = pointData.deviceInfo;
    shipmentTrackingObj.lastTracked = new Date();
    
    return shipmentTrackingObj.save();
  }); */
};

module.exports = new shipmentTrackingService();
