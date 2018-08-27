const deviceTrackingModel = require('./../../models/deviceTracking');
const sensorTrackingModel = require('./../../models/sensorTracking');
const akUtils = require('./../../lib/utility');
const bluebirdPromise = require('bluebird');
const mongoose = require('mongoose');
const commonTrackingService = require('./common.js');

const deviceTrackingService = function() {};

deviceTrackingService.prototype.saveDeviceTracking = function(pointData, currentLocation) {
  akUtils.log('IN UPD DEVICE/TR');
  const self = this;
  return bluebirdPromise.join(
    self.updateDeviceLocation(pointData, currentLocation),
    self.updateSensorLocation(pointData, currentLocation),
    commonTrackingService.updateTrackingLocation(
      'device',
      {
        id: mongoose.Types.ObjectId(pointData.deviceInfo.id),
        code: pointData.deviceInfo.code,
        name: pointData.deviceInfo.name,
        type: pointData.deviceInfo.type
      },
      pointData,
      currentLocation
    ),
    commonTrackingService.pushToIot(
      'device',
      {
        id: mongoose.Types.ObjectId(pointData.deviceInfo.id),
        code: pointData.deviceInfo.code,
        name: pointData.deviceInfo.name,
        type: pointData.deviceInfo.type
      },
      pointData,
      currentLocation,
      process.env.deviceTrackingIotTopic
    ),
    (deviceResults, trackingResults, iotResults) => {}
  );
};

/**
 * Update Product tracking information from tracking data
 * 
 * @param {Object} pointData Tracking Data
 * @param {Object} currenLocation Location Object
 * @return {Promise} Promise after saving
 * 
 */
deviceTrackingService.prototype.updateDeviceLocation = function(pointData, currentLocation) {
  akUtils.log('IN DEVICE FUNCITON');
  // if(typeof pointData.deviceInfo._id !== 'undefined') {
  const conditions = { 'device.id': mongoose.Types.ObjectId(pointData.deviceInfo.id) };
  let lastLocation = {};
  let lastTrackingObj = null;
  return deviceTrackingModel
    .findOne(conditions)
    .then(deviceTrackingObj => {
      if (deviceTrackingObj !== null) {
        lastTrackingObj = deviceTrackingObj;
        lastLocation = deviceTrackingObj.currentLocation;
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
          if (
            currentLocation.id !== null &&
            typeof currentLocation.id !== 'undefined' &&
            lastLocation.id !== null &&
            typeof lastLocation.id !== 'undefined'
          ) {
            if (lastLocation.id.toString() !== currentLocation.id.toString()) {
              lastMoved = new Date(pointData.ts);
            }
          } else if (
            (lastLocation.id === null && currentLocation.id !== null) ||
            (lastLocation.id !== null && currentLocation.id === null)
          ) {
            lastMoved = new Date(pointData.ts);
          } else if (
            typeof lastLocation.address !== 'undefined' &&
            typeof lastLocation.address.constructor === Array
          ) {
            if (
              lastLocation.address[0].value !== currentLocation.address[0].value ||
              lastLocation.address[1].value !== currentLocation.address[1].value
            ) {
              lastMoved = new Date(pointData.ts);
            }
          }
        } else {
          lastMoved = new Date(pointData.ts);
        }

        const updateParams = {
          $set: {
            client: pointData.client,
            pointId: pointData._id,
            currentLocation,
            device: pointData.deviceInfo,
            isReporting: 1,
            sensor: {
              id: pointData.sensors.id,
              code: pointData.sensors.code,
              name: pointData.sensors.name,
              rng: pointData.sensors.rng
            },
            lastTracked: new Date(pointData.ts),
            lastMoved
          }
        };
        akUtils.log('UPDATE DEVICE LOCATION');
        akUtils.log(conditions);
        akUtils.log(updateParams);
        // return deviceTrackingModel.update(conditions, updateParams)
        // .exec();
        return deviceTrackingModel
          .findOneAndUpdate(conditions, updateParams, {
            upsert: false,
            new: false
          })
          .exec();
      }
      return false;
    });
  // }
};

/**
 * Update Product tracking information from tracking data
 * 
 * @param {Object} pointData Tracking Data
 * @param {Object} currenLocation Location Object
 * @return {Promise} Promise after saving
 * 
 */
deviceTrackingService.prototype.updateSensorLocation = function(pointData, currentLocation) {
  akUtils.log('IN SENSOR FUNCITON');
  // if(typeof pointData.deviceInfo._id !== 'undefined') {
  const conditions = { 'sensor.id': mongoose.Types.ObjectId(pointData.sensors.id) };
  let lastLocation = {};
  let lastTrackingObj = null;
  return sensorTrackingModel
    .findOne(conditions)
    .then(sensorTrackingObj => {
      if (sensorTrackingObj !== null) {
        lastTrackingObj = sensorTrackingObj;
        lastLocation = sensorTrackingObj.currentLocation;
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
          if (
            currentLocation.id !== null &&
            typeof currentLocation.id !== 'undefined' &&
            lastLocation.id !== null &&
            typeof lastLocation.id !== 'undefined'
          ) {
            if (lastLocation.id.toString() !== currentLocation.id.toString()) {
              lastMoved = new Date(pointData.ts);
            }
          } else if (
            (lastLocation.id === null && currentLocation.id !== null) ||
            (lastLocation.id !== null && currentLocation.id === null)
          ) {
            lastMoved = new Date(pointData.ts);
          } else if (
            typeof lastLocation.address !== 'undefined' &&
            typeof lastLocation.address.constructor === Array
          ) {
            if (
              lastLocation.address[0].value !== currentLocation.address[0].value ||
              lastLocation.address[1].value !== currentLocation.address[1].value
            ) {
              lastMoved = new Date(pointData.ts);
            }
          }
        } else {
          lastMoved = new Date(pointData.ts);
        }

        const updateParams = {
          $set: {
            client: pointData.client,
            pointId: pointData._id,
            currentLocation,
            device: pointData.deviceInfo,
            isReporting: 1,
            sensor: {
              id: pointData.sensors.id,
              code: pointData.sensors.code,
              name: pointData.sensors.name
            },
            lastTracked: new Date(pointData.ts),
            lastMoved
          }
        };
        // akUtils.log("UPDATE SENSOR LOCATION")
        // akUtils.log(conditions)
        // akUtils.log(updateParams)
        // return deviceTrackingModel.update(conditions, updateParams)
        // .exec();
        return sensorTrackingModel
          .findOneAndUpdate(conditions, updateParams, {
            upsert: false,
            new: false
          })
          .exec();
      }
      return false;
    });
  // }
};
module.exports = new deviceTrackingService();
