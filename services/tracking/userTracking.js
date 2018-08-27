const userTrackingModel = require('./../../models/userTracking');
const userModel = require('./../../models/users');
const akUtils = require('./../../lib/utility');
const bluebirdPromise = require('bluebird');
const mongoose = require('mongoose');
const commonTrackingService = require('./common.js');

const userTrackingService = function() {};

/**
 * Get User information from tracking data
 * 
 * @param {Object} pointData
 * @return {Promise} Promise to represent the product for tracking data
 * 
 */
userTrackingService.prototype.getUserData = function(pointData) {
  return userModel.findOne({
    things: { $elemMatch: { code: pointData.sensors.code } }
  });
};

userTrackingService.prototype.saveUserTracking = function(pointData, currentLocation) {
  akUtils.log('IN UPD PRODUCT/TR');
  return this.getUserData(pointData).then(userObj => {
    if (userObj === null || typeof userObj._id === 'undefined') {
      // akUtils.log('No valid user attached.');
      return;
    }
    const self = this;
    return bluebirdPromise.join(
      self.updateUserLocation(userObj, pointData, currentLocation),
      commonTrackingService.updateTrackingLocation(
        'user',
        {
          id: mongoose.Types.ObjectId(userObj._id),
          code: userObj.sub,
          name: [userObj.given_name, userObj.family_name].join(' ')
        },
        pointData,
        currentLocation
      ),
      commonTrackingService.pushToIot(
        'user',
        {
          id: mongoose.Types.ObjectId(userObj._id),
          code: userObj.sub,
          name: [userObj.given_name, userObj.family_name].join(' ')
        },
        pointData,
        currentLocation,
        process.env.userTrackingIotTopic
      ),
      (userResults, trackingResults, iotResults) => {}
    );
  });
};

/**
 * Update User tracking information from tracking data
 * 
 * @param {Object} userObj User Data
 * @param {Object} pointData Tracking Data
 * @param {Object} currenLocation Location Object
 * @return {Promise} Promise after saving
 * 
 */
userTrackingService.prototype.updateUserLocation = function(userObj, pointData, currentLocation) {
  akUtils.log('IN PROD FUNCITON');
  akUtils.log(pointData.did);
  const conditions = { 'user.id': userObj._id };
  let lastLocation = null;
  let lastTrackingObj = null;
  return userTrackingModel
    .findOne(conditions)
    .then(userTrackingObj => {
      if (userTrackingObj !== null) {
        lastTrackingObj = userTrackingObj;
        lastLocation = userTrackingObj.currentLocation;
      }
      return lastLocation;
    })
    .then(() => {
      akUtils.log('IN PROD THEN');
      if (
        lastTrackingObj === null ||
        lastTrackingObj.lastTracked.getTime() < new Date(pointData.ts).getTime()
      ) {
        akUtils.log('IN PROD AFTER CHECK');

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

        const updateParams = {
          $set: {
            user: {
              id: userObj._id,
              code: userObj.sub,
              name: [userObj.given_name, userObj.family_name].join(' ')
            },
            client: pointData.client,
            pointId: pointData._id,
            currentLocation,
            device: pointData.deviceInfo,
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
        // akUtils.log(updateParams);
        return userTrackingModel.findOneAndUpdate(conditions, updateParams, {
          upsert: true,
          new: true
        });

        // update(conditions, updateParams)
        // .exec();
      }
      return false;
    });
};

module.exports = new userTrackingService();
