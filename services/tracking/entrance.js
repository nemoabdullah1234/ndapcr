const mongoose = require('mongoose');
const trackingmodel = require('./../../models/tracking');
const trackingEntranceModel = require('./../../models/trackingEntrance');

var entranceService = function () {
  
};

entranceService.prototype.saveTrackingLocationEntrance = function (pointData) {
  if(pointData.locationEntry === false && pointData.locationExit === false) {
    return true;
  }
  return trackingmodel.findOne({'pointId' : pointData._id, 
  'sensors.id' : mongoose.Types.ObjectId(pointData.sensors.id)}).then((trackingData) => {
    if(trackingData !== null) {
      let conditions = {
        'type' : 'location', 
        'sensors.id' : mongoose.Types.ObjectId(trackingData.sensors.id)
        //'entryTime' : {'$lte': trackingData.trackedAt}
        // 'location.id' : trackingData.location.addresses.id
      };
      
      return trackingEntranceModel.findOne(conditions).sort({'_id' : -1}).exec().then((trackingEntranceObj) => {
        // If no previous record exists, Insert new 
        if(trackingEntranceObj === null) {
          if(trackingData.locationEntry === true) {
            trackingEntranceObj = new trackingEntranceModel();
            trackingEntranceObj.sensors = trackingData.sensors;
            trackingEntranceObj.device = trackingData.deviceInfo;
            trackingEntranceObj.location = trackingData.location.addresses;
            trackingEntranceObj.type = 'location';
            trackingEntranceObj.entryTime = trackingData.trackedAt;
            trackingEntranceObj.exitTime = null;
            trackingEntranceObj.interval = 0;
            trackingEntranceObj.pkid = pointData.pkid;
            trackingEntranceObj.updatedAt = new Date();
            return trackingEntranceObj.save();
          }
        } else {
          // let trackingEntranceObj = trackingEntranceArr[0]; 
          // If previous entry exited and entry comes, Insert New 
          if(trackingData.locationEntry === true) {
            // if(trackingEntranceObj.exitTime !== null) {
            if(trackingData.trackedAt.getTime() > trackingEntranceObj.entryTime.getTime()) {
              let trackingEntranceObj = new trackingEntranceModel();
              trackingEntranceObj.sensors = trackingData.sensors;
              trackingEntranceObj.device = trackingData.deviceInfo;
              trackingEntranceObj.location = trackingData.location.addresses;
              trackingEntranceObj.type = 'location';
              trackingEntranceObj.entryTime = new Date(trackingData.trackedAt);
              trackingEntranceObj.exitTime = null;
              trackingEntranceObj.interval = 0;
              trackingEntranceObj.pkid = pointData.pkid;
              trackingEntranceObj.updatedAt = new Date(); 
              return trackingEntranceObj.save();
            } else {
              return true;
            }
            // } 
          } else if(trackingData.locationExit === true) {
            // If previous entry not exited and exit comes, Update  
            if(trackingEntranceObj.exitTime === null) {
              trackingEntranceObj.exitTime = new Date(trackingData.trackedAt);
              trackingEntranceObj.interval = trackingData.trackedAt.getTime() - trackingEntranceObj.entryTime.getTime();
              trackingEntranceObj.pkid = pointData.pkid;
              trackingEntranceObj.updatedAt = new Date();
              return trackingEntranceObj.save();
            }
          }
        }
      });
    } else {
      return true;
    }
  });
};

entranceService.prototype.saveTrackingZoneEntrance = function (pointData) {
  if(pointData.zoneEntry === false && pointData.zoneExit === false) {
    return true;
  }
  return trackingmodel.findOne({'pointId' : pointData._id, 
  'sensors.id' : mongoose.Types.ObjectId(pointData.sensors.id)}).then((trackingData) => {
    if(trackingData !== null) {
      let conditions = {
        'type' : 'zone', 
        'sensors.id' : mongoose.Types.ObjectId(trackingData.sensors.id),
        // 'entryTime' : {'$lt': trackingData.trackedAt}
        // 'location.id' : trackingData.location.addresses.id
      };
      return trackingEntranceModel.findOne(conditions).sort({'_id' : -1}).limit(1).exec().then((trackingEntranceObj) => {
        // // console.log(trackingEntranceObj);
        // If no previous record exists, Insert new 
        if(trackingEntranceObj === null) {
          if(trackingData.zoneEntry === true) {
            let trackingEntranceObj = new trackingEntranceModel();
            trackingEntranceObj.sensors = trackingData.sensors;
            trackingEntranceObj.device = trackingData.deviceInfo;
            trackingEntranceObj.location = trackingData.location.addresses;
            trackingEntranceObj.type = 'zone';
            trackingEntranceObj.entryTime = trackingData.trackedAt;
            trackingEntranceObj.exitTime = null;
            trackingEntranceObj.interval = 0;
            trackingEntranceObj.updatedAt = new Date();
            return trackingEntranceObj.save();
          }
        } else {
          // If previous entry exited and entry comes, Insert New 
          if(trackingData.zoneEntry === true) {
            // if(trackingEntranceObj.exitTime !== null) {
              let trackingEntranceObj = new trackingEntranceModel();
              trackingEntranceObj.sensors = trackingData.sensors;
              trackingEntranceObj.device = trackingData.deviceInfo;
              trackingEntranceObj.location = trackingData.location.addresses;
              trackingEntranceObj.type = 'zone';
              trackingEntranceObj.entryTime = new Date(trackingData.trackedAt);
              trackingEntranceObj.exitTime = null;
              trackingEntranceObj.interval = 0;
              trackingEntranceObj.updatedAt = new Date(); 
              return trackingEntranceObj.save();
            // } 
          } else if(trackingData.zoneExit === true) {
            // If previous entry not exited and exit comes, Update  
            if(trackingEntranceObj.exitTime === null) {
              trackingEntranceObj.exitTime = new Date(trackingData.trackedAt);
              trackingEntranceObj.interval = trackingData.trackedAt.getTime() - trackingEntranceObj.entryTime.getTime();
              trackingEntranceObj.updatedAt = new Date();
              return trackingEntranceObj.save();
            }
          }
        }
      });
    } else {
      return true;
    }
  });
};

module.exports = new entranceService();
