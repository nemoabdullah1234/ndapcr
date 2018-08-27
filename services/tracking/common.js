const iotLib = require('./../../lib/aws/iot');
var iot = new iotLib();
const mongoose = require('mongoose');
const configurationHelper = require('./../../helpers/configuration');
const trackingmodel = require('./../../models/tracking');
const akUtils = require('./../../lib/utility');
const shipmentStatusLabelMap = require('./../../mappings/shipmentStatusLabel.json');
const attributemodel = require('./../../models/attribute');
const bluebirdPromise = require('bluebird');
const settings = {};

var commonService = function () {
  
};

commonService.prototype.getSettings = function (clientObj) {
  configurationHelper.setClient(clientObj);
  return configurationHelper.getConfigurations();
};

/**
 * Insert/Update tracking history information from tracking data
 * 
 * @param {Object} productobj Product Data
 * @param {Object} pointData Tracking Data
 * @param {Object} currenLocation Location Object
 * @return {Promise} Promise after saving
 * 
 */
commonService.prototype.updateTrackingLocation = function (bizType, bizObj, pointData, currentLocation) {
  
  const conditions = {'pkid' : pointData.pkid, 'sensors.id' : mongoose.Types.ObjectId(pointData.sensors.id) };
  // const conditions = {'pointId' : pointData._id, 'sensors.id' : pointData.sensors.id };
  return trackingmodel.findOne(conditions).then( (trackingObj) => {
      let updateParams = {};
      updateParams.pointId = pointData._id;
      
      for(let key in pointData) {
          updateParams[key] = pointData[key];
      }
      delete updateParams._id;
      
      if(trackingObj !== null) {
        updateParams.sensors = trackingObj.sensors;
      }
      
      updateParams.sensors[bizType] = bizObj;
      /*switch(bizType) {
        case 'product':
          updateParams.sensors.product = { id : mongoose.Types.ObjectId(bizObj._id), code : bizObj.code, name : bizObj.name };
          break;
        case 'user':
          updateParams.sensors.user = { id : mongoose.Types.ObjectId(bizObj._id), code : bizObj.sub, name : [ bizObj.title, bizObj.given_name, bizObj.family_name ].join(' ')  };
          break;
        case 'shipment':
          updateParams.sensors.shipment = { id : mongoose.Types.ObjectId(bizObj._id), code : bizObj.code, name : bizObj.name };
          break;
      }*/
      
      updateParams.location.addresses = currentLocation;
      
      //trackingObj.location.point = pointData.location;
      //trackingObj.location.addresses = pointData.locationdetails;
      //trackingObj.ts = Number(trackingObj.ts);
      updateParams.trackedAt = new Date(updateParams.ts);
      updateParams.updatedAt = new Date();
      updateParams.deviceInfo.id = mongoose.Types.ObjectId(updateParams.deviceInfo.id)
      // // console.log(updateParams);
      return trackingmodel.findOneAndUpdate(conditions, updateParams, {
        upsert: true,
        new: true
      })
      .exec();
      
      // return trackingObj.save();
  });
};

/**
 * Push tracking information to IOT for maps through web socket
 * 
 * @param {Object} productobj Product Data
 * @param {Object} pointData Tracking Data
 * @param {Object} currenLocation Location Object
 * @return {Promise} Promise after saving
 * 
 */
 commonService.prototype.pushToIot = function (bizType, bizObj, pointData, currentLocation, iotTopic) {
   // return {};
  let trackingObj = {};
  trackingObj.pointId = pointData._id;
  
  for(let key in pointData) {
    trackingObj[key] = pointData[key];
  }
  
  trackingObj._id = null;
  
  trackingObj.sensors[bizType] = bizObj;
  // let iotTopic = iotTopic;
  
  /*let iotTopic = process.env.productTrackingIotTopic;
  switch(bizType) {
    case 'product':
      trackingObj.sensors.product = { id : bizObj._id, code : bizObj.code, name : bizObj.name };
      iotTopic = process.env.productTrackingIotTopic;
      break;
    case 'user':
      trackingObj.sensors.user = { id : bizObj._id, code : bizObj.sub, name : [ bizObj.title, bizObj.given_name, bizObj.family_name ].join(' ') };
      iotTopic = process.env.userTrackingIotTopic;
      break;
    case 'shipment':
      trackingObj.sensors.shipment = { id : bizObj._id, code : bizObj.code, name : bizObj.name, 
        status : bizObj.shipmentStatus, statusLabel : akUtils.objectKeyByValue(shipmentStatusLabelMap, bizObj.shipmentStatus) || '' };
      iotTopic = process.env.shipmentTrackingIotTopic;
      break;
  }*/
  
  trackingObj.location.addresses = currentLocation;
  
  trackingObj.trackedAt = new Date(trackingObj.ts);
  trackingObj.updatedAt = new Date();
  
  /*let iotObj = {};
  iotObj.pointId = trackingObj.pointId;
  iotObj.did = trackingObj.did;
  iotObj.ts = trackingObj.ts;
  iotObj.trackedAt = new Date(trackingObj.ts);
  iotObj.updatedAt = new Date();
  iotObj.sensors = trackingObj.sensors;
  delete iotObj.sensors.dis;
  delete iotObj.sensors.rssi;
  delete iotObj.sensors.uuid;
  delete iotObj.sensors.maj;
  iotObj.locationdetails = trackingObj.locationdetails[0];
  
  akUtils.log(iotObj);
  return new bluebirdPromise( (resolve) => {
    resolve();
  });*/
  /*return new bluebirdPromise( (resolve) => {
    resolve();
  });*/
  return iot.publish(iotTopic, JSON.stringify(trackingObj));
}

 /**
  * Get Location address attributes details
  * 
  * @param {Object} pointData Tracking Data
  * @return {Promise} Promise after saving
  * 
  */
 commonService.prototype.getLocationAddressDetails = function (pointData) {
     let addressArray = ['address', 'city', 'state', 'country'];
     
     let promises = addressArray.map((loc) => {
         return attributemodel.findOne({'code' : loc}).then( (attrObj) => {
             let addressObj = {};
             addressObj.id = attrObj._id;
             addressObj.name = attrObj.name;
             addressObj.value = pointData.locationdetails[0][loc];
             addressObj.sysDefined = attrObj.sysDefined;
             addressObj.status = attrObj.status;
             return addressObj;
         });
     });
     return bluebirdPromise.all( promises);
 };

 /**
  * Prepare address information from tracking data
  * 
  * @param {Object} pointData Tracking Data
  * @return {Object} currentLocation
  * 
  */
 commonService.prototype.getLocationInformation = function(pointData) {
   //let locationdetails = getLocationRow(pointData.locationdetails);
   let self = this;
   let locationdetails = {};
   let currentLocation = {};
   return self.getAppInformation(pointData).then(self.findOptimizedLocation).then((locationdt) => {
     locationdetails = locationdt;
     return self.getLocationAddressDetails(pointData);
   }).then((addressDetails) => {
     let locId = null;
     if( locationdetails.locationId !== '' ) {
         locId = locationdetails.locationId;
     }
     currentLocation = { 
         'pointCoordinates': {
             'type' : 'Point',
             'coordinates' : [
                 pointData.location.coordinates[0],
                 pointData.location.coordinates[1]
             ]
         },
         'id': locId,
         'code': locationdetails.code,
         'name': locationdetails.name,
         'address': addressDetails,
         zones : {
           
         },
         floor : {
           
         }
         
     };
     if(typeof locationdetails.zones !== 'undefined') {
       if(typeof locationdetails.zones.id !== 'undefined') {
         currentLocation.zones = {
           'id': locationdetails.zones.id,
           'code': locationdetails.zones.code,
           'name': locationdetails.zones.name,
           'thing': {
             'id': locationdetails.zones.thing.id,
             'code': locationdetails.zones.thing.code,
             'name': locationdetails.zones.thing.name,
           }
         };
       }
     }
     if(typeof locationdetails.floor !== 'undefined') {
       if(typeof locationdetails.floor.id !== 'undefined') {
         currentLocation.floor = {
           'id': locationdetails.floor.id,
           'code': locationdetails.floor.code,
           'name': locationdetails.floor.name
         };
       }
     }
     
     return currentLocation;
   });
 };

 /**
  * Get only one location/zone from tracking information
  * 
  * @param {Object} pointData Tracking Data
  * @return {Promise} Promise having optimized location data
  * 
  */
 commonService.prototype.findOptimizedLocation = function(pointData) {
   return new bluebirdPromise((resolve) => {
     let locationdt = {};
     pointData.locationdetails.forEach((currentValue) => {
       if(typeof currentValue.zones !== 'undefined' && typeof currentValue.zones[0].id !== 'undefined') {
         let cval = currentValue;
         cval.zones = cval.zones[0];
         cval.floor = cval.floor[0];
         locationdt = cval;
       }
     });
     if(Object.keys(locationdt).length === 0 && locationdt.constructor === Object) {
       locationdt = pointData.locationdetails[0];
     }
     resolve(locationdt);
   });
 };

 /**
  * Prepare client / project information from tracking data
  * 
  * @param {Object} pointData Tracking Data
  * @return {Promise} Promise update tracking data
  * 
  */
 commonService.prototype.getAppInformation = function(pointData) {
   return new bluebirdPromise((resolve) => {
     pointData.client = {};
     pointData.client.clientId = pointData.clientid;
     pointData.client.projectId = pointData.projectid;
     this.client = {'clientId' : pointData.clientid, 'projectId' : pointData.projectid,};
     //akUtils.log('IN GET CLIENT INFO');
     //akUtils.log(this.client);
     resolve(pointData);
   });
 };

 
 /**
  * Add Cloud Watch Logs
  * 
  * @param {Object} pointData Tracking Data
  * @return {Object} currentLocation
  * 
  */
 commonService.prototype.addCloudWatchMetrics = function(pointData) {
   const moment = require('moment');
   //akUtils.log(pointData.ts);
   let ts_ts = moment(Math.floor(pointData.ts)).unix();
   let ht_ts = moment(pointData.ht).unix();
   let locStrmTm_ts = moment(pointData.locStrmTm).unix();
   let trLbdTm_ts = moment(pointData.trLbdTm).unix();
   let ptLbdTm_ts = moment(pointData.ptLbdTm).unix();
   let blStrmTm_ts = moment(pointData.blStrmTm).unix();
   let kinTrLbdTm_ts = moment(pointData.kinTrLbdTm).unix();
   let pdTrLbdTm_ts = moment(pointData.pdTrLbdTm).unix();
   
   let trackToIot = 0;
   if( (ht_ts - pointData.ts) > 0) {
     trackToIot = ht_ts - ts_ts;
   }
   let iotToLocationStream = 0;
   if( (locStrmTm_ts - ht_ts) > 0) {
     iotToLocationStream = locStrmTm_ts - ht_ts;
   }
   let locationKinesisToTrackingLambda = 0;
   if( (trLbdTm_ts - locStrmTm_ts) > 0) {
     locationKinesisToTrackingLambda = trLbdTm_ts - locStrmTm_ts;
   }
   let trackingLambdaToPointLambda = 0;
   if( (ptLbdTm_ts - trLbdTm_ts) > 0) {
     trackingLambdaToPointLambda = ptLbdTm_ts - trLbdTm_ts;
   }
   let pointLambdaToBlStream = 0;
   if( (blStrmTm_ts - ptLbdTm_ts) > 0) {
     pointLambdaToBlStream = blStrmTm_ts - ptLbdTm_ts;
   }
   let blStreamToKinesisTrackingLambda = 0;
   if( (kinTrLbdTm_ts - blStrmTm_ts) > 0) {
     blStreamToKinesisTrackingLambda = kinTrLbdTm_ts - blStrmTm_ts;
   }
   let kinesisTrackingLambdaToProductTrackingLambda = 0;
   if( (pdTrLbdTm_ts - kinTrLbdTm_ts) > 0) {
     kinesisTrackingLambdaToProductTrackingLambda = pdTrLbdTm_ts - kinTrLbdTm_ts;
   }
   
   let metrics = [
     {
       'name' : 'trackToIot',
       'value' : trackToIot,
     },{
       'name' : 'iotToLocationStream',
       'value' : iotToLocationStream,
     },{
       'name' : 'locationKinesisToTrackingLambda',
       'value' : locationKinesisToTrackingLambda,
     },{
       'name' : 'trackingLambdaToPointLambda',
       'value' : trackingLambdaToPointLambda,
     },{
       'name' : 'pointLambdaToBlStream',
       'value' : pointLambdaToBlStream,
     },{
       'name' : 'blStreamToKinesisTrackingLambda',
       'value' : blStreamToKinesisTrackingLambda,
     },{
       'name' : 'kinesisTrackingLambdaToProductTrackingLambda',
       'value' : kinesisTrackingLambdaToProductTrackingLambda
     }
   ];
   const AWS = require('aws-sdk');
   
   const cloudwatch = new AWS.CloudWatch({region: 'us-east-1'});
   
   let metric = [];
   let promises = metrics.map((row) => {
     return bluebirdPromise.try( () => {
       metric = {
         MetricData: [ /* required */
           {
             MetricName: row.name,
             Dimensions: [
               {
                 Name: 'device', /* required */
                 Value: pointData.did /* required */
               },
               {
                 Name: 'beacon', /* required */
                 Value: pointData.sensors.code /* required */
               },
             ],
             Timestamp: new Date(),
             Unit: 'Count',
             Value: row.value
           },
         ],
         Namespace: process.env.cloudWatchTrackingLatencyMatric /* required */
       };
       //akUtils.log(' ================== MATRIC ===============================')
       //akUtils.log(metric);

       cloudwatch.putMetricData(metric, (err, data) => {

       if (err) {
         akUtils.log(err, err.stack); // an error occurred
         } else {
           akUtils.log(data);           // successful response
         }
       });
       return;
     }); 
   });
   
   return bluebirdPromise.all(promises);
 };

 module.exports = new commonService();
