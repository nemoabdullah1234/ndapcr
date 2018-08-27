/* jshint esversion: 6 */
// const mongoose = require('mongoose');
// const trackingmodel = require('../models/tracking');
const mobileLogsModel = require('../models/mobilelogs');
// const thingsmodel = require('../models/things');

// const locationmodel = require('../models/location');
// const attributemodel = require('../models/attribute');
const akUtils = require('../lib/utility');

// const projectmodel = require('../models/project');
// let cacheClient = require('../lib/cache');
const commonTrackingService = require('./../services/tracking/common.js');

const productTrackingService = require('./../services/tracking/productTracking.js');
const deviceTrackingService = require('./../services/tracking/deviceTracking.js');
const shipmentTrackingService = require('./../services/tracking/shipmentTracking.js');
const userTrackingService = require('./../services/tracking/userTracking.js');
const entranceService = require('./../services/tracking/entrance.js');
const shipmentStatusTrackingService = require('./../services/tracking/shipmentStatusTracking.js');
const bluebirdPromise = require('bluebird');

const nearbyLocationHelper = require('./tracking/nearbyLocation');
const findZoneHelper = require('./tracking/findZone');
const thingHelper = require('./things');
const deviceHelper = require('./device');

const API_UID_SEPERATOR = '--';
// const settings = {};
const trackingService = function() {};

/**
 * Set client of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */

trackingService.prototype.getApiData = function({ body } = {}) {
  return bluebirdPromise
    .all([
      this.getApiLocations(body.locations || []),
      this.getApiDevices(body.devices || []),
      this.getApiFilteredThings(body.things || [])
    ])
    .then(result => ({
      locations: result[0] || {},
      devices: result[1] || {},
      things: result[2] || {}
    }));
};

trackingService.prototype.getApiLocations = function(locationsArr) {
  const locationResultObj = {};
  return bluebirdPromise
    .map(locationsArr || [], location =>
      nearbyLocationHelper
        .getLocationFromLatLong({
          queryStringParameters: {
            latitude: location.latitude,
            longitude: location.longitude
          }
        })
        .then(result => {
          locationResultObj[`${location.latitude}${API_UID_SEPERATOR}${location.longitude}`] = {
            status: true,
            data: result
          };
        })
        .catch(error => {
          locationResultObj[`${location.latitude}${API_UID_SEPERATOR}${location.longitude}`] = {
            status: false,
            data: { error }
          };
        })
    )
    .then(() => locationResultObj);
};

trackingService.prototype.getApiDevices = function(deviceCodeList) {
  const deviceResult = {};
  return bluebirdPromise
    .map(deviceCodeList || [], deviceCode =>
      deviceHelper
        .getByCode(deviceCode)
        .then(result =>
          findZoneHelper
            .getZonesFromThings({ body: { things: [deviceCode] } })
            .then(findZoneData => {
              result.zoneData = findZoneData[deviceCode] || [];
              return result;
            })
        )
        .then(result => {
          deviceResult[`${deviceCode}`] = {
            status: true,
            data: result
          };
        })
        .catch(error => {
          deviceResult[`${deviceCode}`] = {
            status: false,
            data: { error: error || 'Device Not found' }
          };
        })
    )
    .then(() => deviceResult);
};

trackingService.prototype.getApiFilteredThings = function(thingsDataList) {
  const typeWiseThings = {};
  for (let i = 0; i < thingsDataList.length; i++) {
    const type = thingsDataList[i].type || 'beacon';
    if (!typeWiseThings[type]) {
      typeWiseThings[type] = [];
    }
    delete thingsDataList[i].type;
    typeWiseThings[type].push(thingsDataList[i]);
  }

  const indexThingsByUid = thingList => {
    const indexedThings = {};
    const getUid = (type, thingObj) => {
      switch (type) {
        case 'beacon':
          return `${type}${API_UID_SEPERATOR}${thingObj.uuid}${API_UID_SEPERATOR}${thingObj.major}${API_UID_SEPERATOR}${thingObj.minor}`;
        case 'gateway':
          return `${type}${API_UID_SEPERATOR}${thingObj.uuid}${API_UID_SEPERATOR}${thingObj.major}${API_UID_SEPERATOR}${thingObj.minor}`;
        case 'tempTag':
          return `${type}${API_UID_SEPERATOR}${thingObj.uid}`;
        case 'nfcTag':
          return `${type}${API_UID_SEPERATOR}${thingObj.uid}`;
        default:
          return `${type}${API_UID_SEPERATOR}${thingObj.uid}`;
      }
    };
    for (let i = 0; i < thingList.length; i++) {
      indexedThings[getUid(thingList[i].type || 'beacon', thingList[i])] = thingList[i];
    }
    return indexedThings;
  };
  return bluebirdPromise
    .map(Object.getOwnPropertyNames(typeWiseThings), type =>
      thingHelper.getFilterArrayThings(typeWiseThings[type], type).then(result =>
        findZoneHelper
          .getZonesFromThings({
            body: { things: typeWiseThings[type].filter(x => x.code).map(x => x.code || '') }
          })
          .then(findZoneResult => {
            for (let i = 0; i < result.length; i++) {
              if (result[i].code) {
                result[i].zoneData = findZoneResult[result[i].code] || [];
              } else {
                result[i].zoneData = [];
              }
              result[i].type = type || 'beacon';
            }
            return result;
          })
      )
    )
    .then(resultArray => {
      let result = [];
      for (let i = 0; i < resultArray.length; i++) {
        result = result.concat(...resultArray[i]);
      }
      return indexThingsByUid(result);
    });
};

trackingService.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

/**
 * Set Product/User Tracking / tracking history / IOT
 * 
 * @param {Object} productobj Product Data
 * @param {Object} pointData Tracking Data
 * @param {Object} currenLocation Location Object
 * @return {Promise} Promise after saving
 * 
 */
trackingService.prototype.saveTracking = function(pointData) {
  akUtils.log('IN SAVE TRACKING');
  const self = this;
  pointData.pdTrLbdTm = new Date();
  delete pointData.deviceInfo.attrs;
  return commonTrackingService
    .getLocationInformation(pointData)
    .then(currentLocation =>
      bluebirdPromise.join(
        deviceTrackingService.saveDeviceTracking(pointData, currentLocation),
        productTrackingService.saveProductTracking(pointData, currentLocation),
        userTrackingService.saveUserTracking(pointData, currentLocation),
        shipmentTrackingService.saveShipmentTracking(pointData, currentLocation),
        commonTrackingService.addCloudWatchMetrics(pointData),
        (productResults, trackingResults, iotResults) => {}
      )
    )
    .then(() =>
      // console.log('---- ENTR PREV -------------------')
      bluebirdPromise.join(
        entranceService.saveTrackingLocationEntrance(pointData),
        entranceService.saveTrackingZoneEntrance(pointData),
        (locationEntranceResults, zoneEntranceResults, iotResults) => {}
      )
    );
};

trackingService.prototype.processShipmentStatusRow = function(data) {
  return shipmentStatusTrackingService.getShipmentData(data).then(shipments => {
    const promises = shipments.map((row, idx) =>
      bluebirdPromise.all([
        shipmentStatusTrackingService.saveShipmentShipStatus(row._id, data),
        shipmentStatusTrackingService.saveShipmentDeliverStatus(row._id, data)
      ])
    );
    return bluebirdPromise.all(promises);
  });
};

/**
 * Process  Mobile Log Data 
 * 
 * @param {Object} pointData
 * @return {Promise} Promise to represent the product for tracking data
 * 
 */
trackingService.prototype.getMobileLogs = function(bucketName, fileName) {
  const aws = require('aws-sdk');
  // SR_2017Sep19_cJ3num.csv
  const fileNameArr = fileName.split('.csv')[0].split('_');
  const app = fileNameArr[0];
  const fdt = fileNameArr[1];
  const did = fileNameArr[2];

  const s3 = new aws.S3({ apiVersion: '2006-03-01' });
  const params = {
    Bucket: bucketName,
    Key: fileName
  };
  const self = this;
  return new bluebirdPromise((resolve, reject) => {
    s3.getObject(params, (err, s3data) => {
      if (err) {
        akUtils.log(`ERROR ${err}`);
        reject(err);
      } else {
        akUtils.log('SUCCESS ');
        // akUtils.log(s3data);
        // akUtils.log(s3data.Body.toString());
        const data = s3data.Body.toString();
        const csvArray = data.split('\n');
        const headers = csvArray[0].split(',');
        const csvData = [];
        for (let i = 1; i < csvArray.length; i++) {
          csvData.push(csvArray[i].split(','));
        }
        akUtils.log(headers);
        // akUtils.log(csvData);
        akUtils.log(csvData.length);
        const promises = csvData.map(row => {
          // akUtils.log("ROW ---> ")
          // akUtils.log(row)
          if (row.length >= 20) {
            const logObj = {
              filename: fileName,
              app,
              filedt: fdt,
              did,
              uuid: row[0],
              maj: self.filterData(row[1], 'number'),
              min: self.filterData(row[2], 'number'),
              rng: self.filterData(row[3], 'number'),
              lat: self.filterData(row[4], 'number'),
              lon: self.filterData(row[5], 'number'),
              acc: self.filterData(row[6], 'number'),
              spd: self.filterData(row[7], 'number'),
              alt: self.filterData(row[8], 'number'),
              dir: self.filterData(row[9], 'number'),
              ts: self.filterData(row[10], 'number'),
              // prv: row[11],
              localts: row[11],
              mqttts: self.filterData(row[12], 'number'),
              logts: self.filterData(row[13], 'number'),
              batt: row[14],
              ble: row[15],
              gps: row[16],
              wifi: row[17],
              pkid: row[18],
              code: row[19],
              ack: row[20],
              message: row[21],
              dt: new Date()
            };
            return self.saveMobileLog(logObj);
          }
          return false;
        });

        resolve(bluebirdPromise.all(promises));

        // resolve(csvData);
        // the data has the content of the uploaded file
      }
    });
  });
};

trackingService.prototype.filterData = function(data, type) {
  if (data === 'NA') {
    return 'NA';
  }
  if (type === 'number') {
    return Number(data);
  }
  return data;
};

trackingService.prototype.saveMobileLog = function(logData) {
  let conditions;
  if (logData.pkid !== 'NA') {
    conditions = {
      filename: logData.filename,
      pkid: logData.pkid,
      uuid: logData.uuid,
      maj: logData.maj,
      min: logData.min
    };
  } else {
    conditions = {
      filename: logData.filename,
      logts: logData.logts,
      code: logData.code,
      message: logData.message
    };
  }
  // let obj  = new mobileLogsModel();
  /* for (let v in logData) {
    obj[v] = logData[v];
  } */
  // return obj.collection.insert(logData);
  // return obj.save();
  // akUtils.log(logData);
  return mobileLogsModel.collection.findOneAndUpdate(conditions, logData, {
    upsert: true,
    new: true
  });
};

module.exports = new trackingService();
