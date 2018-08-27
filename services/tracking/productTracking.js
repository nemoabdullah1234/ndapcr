const productsmodel = require('./../../models/product');
const productsTrackingModel = require('./../../models/productTracking');
const productTemperatureModel = require('./../../models/productTemperature');
const productTemperatureHistoryModel = require('./../../models/productTemperatureHistory');
const akUtils = require('./../../lib/utility');
const bluebirdPromise = require('bluebird');
const mongoose = require('mongoose');
const commonTrackingService = require('./common.js');

const productTrackingService = function() {};

/**
 * Get Product information from tracking data
 * 
 * @param {Object} pointData
 * @return {Promise} Promise to represent the product for tracking data
 * 
 */
productTrackingService.prototype.getProductData = function(pointData) {
  return productsmodel.findOne({
    things: { $elemMatch: { code: pointData.sensors.code } }
  });
  /*
    akUtils.log(pointData.sensors.code);
    let cacheKey = 'product-for-sensor-' + pointData.sensors.code; 
    akUtils.log(cacheKey);
    return new bluebirdPromise((resolve,reject) => {
      akUtils.log('Getting Data from cache');
      return cacheClient.getData(cacheKey, function (err, data) {
        return resolve('III');
        akUtils.log(data);
          if(typeof data === 'undefined') {
            akUtils.log('No Data from cache');
            data = null;
          }
          //akUtils.log('Found Data from cache');
          //akUtils.log(JSON.parse(data));
          return (err) ? reject(err) : resolve(JSON.parse(data));
      });
    
    }).then((results) => {
      akUtils.log('Cache Data after parse');
      return results;
      if(results === null) {
        akUtils.log('Cache empty key / data ');
        return productsmodel.findOne({
            'things' : { '$elemMatch' : { 'code' : pointData.sensors.code } } 
        }).then((results) => {
          return new bluebirdPromise((resolve) => {
            akUtils.log('Set Cache after parse');
            cacheClient.set(cacheKey,JSON.stringify(results),function() {
              cacheClient.close();
              resolve(results);
            });
          });
        });
      } else {
        akUtils.log('Found Data from cache');
        cacheClient.close();
        return results;
      }
    }); */
};

/**
 * Update Product tracking information from tracking data
 * 
 * @param {Object} productobj Product Data
 * @param {Object} pointData Tracking Data
 * @param {Object} currenLocation Location Object
 * @return {Promise} Promise after saving
 * 
 */
productTrackingService.prototype.updateProductLocation = function(
  productObj,
  pointData,
  currentLocation
) {
  akUtils.log('IN PROD FUNCITON 1');
  // akUtils.log(productObj);
  akUtils.log(pointData.did);
  const conditions = { 'product.id': productObj._id };
  let lastLocation = null;
  let lastTrackingObj = null;
  return productsTrackingModel
    .findOne(conditions)
    .then(productTrackingObj => {
      if (productTrackingObj !== null) {
        lastTrackingObj = productTrackingObj;
        lastLocation = productTrackingObj.currentLocation;
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
            if (`${lastLocation.id}` !== `${currentLocation.id}`) {
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
            product: {
              id: productObj._id,
              code: productObj.code,
              name: productObj.name
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
        return productsTrackingModel.update(conditions, updateParams).exec();
      }
      return false;
    });
};

productTrackingService.prototype.saveProductTracking = function(pointData, currentLocation) {
  akUtils.log('IN UPD PRODUCT/TR');
  return this.getProductData(pointData).then(productObj => {
    if (productObj === null || typeof productObj._id === 'undefined') {
      // akUtils.log('No valid product attached.');
      return;
    }
    const self = this;
    return bluebirdPromise.join(
      self.updateProductLocation(productObj, pointData, currentLocation),
      self.updateProductTemperature(productObj, pointData),
      commonTrackingService.updateTrackingLocation(
        'product',
        {
          id: mongoose.Types.ObjectId(productObj._id),
          code: productObj.code,
          name: productObj.name
        },
        pointData,
        currentLocation
      ),
      commonTrackingService.pushToIot(
        'product',
        {
          id: mongoose.Types.ObjectId(productObj._id),
          code: productObj.code,
          name: productObj.name
        },
        pointData,
        currentLocation,
        process.env.productTrackingIotTopic
      ),
      (productResults, trackingResults, iotResults) => {}
    );
  });
};

/**
 * Update Product tracking information from tracking data
 * 
 * @param {Object} productobj Product Data
 * @param {Object} pointData Tracking Data
 * @param {Object} currenLocation Location Object
 * @return {Promise} Promise after saving
 * 
 */
productTrackingService.prototype.updateProductTemperature = function(productObj, pointData) {
  if (pointData.sensors.type !== 'tempTag') {
    return {};
  }
  akUtils.log('IN PROD TEMP FUNCITON');
  const self = this;
  const conditions = { 'product.id': productObj._id };
  let lastLocation = null;
  let lastTrackingObj = null;
  return productsTrackingModel
    .findOne(conditions)
    .then(productTrackingObj => {
      if (productTrackingObj !== null) {
        lastTrackingObj = productTrackingObj;
        lastLocation = productTrackingObj.currentLocation;
      }
      return lastLocation;
    })
    .then(() => {
      akUtils.log('IN PROD THEN');
      if (lastTrackingObj !== null) {
        let trackTime = null;

        if (lastTrackingObj.lastTracked.getTime() < new Date(pointData.ts).getTime()) {
          trackTime = new Date(pointData.ts);
        } else {
          trackTime = lastTrackingObj.lastTracked;
        }

        let lastRecordedTemp = 0;
        if (typeof pointData.sensors.lastRecordedTemp === 'number') {
          lastRecordedTemp = pointData.sensors.lastRecordedTemp;
        }

        const updateParams = {
          $set: {
            product: {
              id: productObj._id,
              code: productObj.code,
              name: productObj.name
            },
            client: pointData.client,
            pointId: pointData._id,
            currentLocation: lastLocation,
            device: pointData.deviceInfo,
            sensor: {
              id: pointData.sensors.id,
              code: pointData.sensors.code,
              name: pointData.sensors.name
            },
            lastTracked: trackTime,
            lastMoved: lastTrackingObj.lastMoved,
            lastRecordedTemp
          }
        };
        // akUtils.log(updateParams);
        return productsTrackingModel.update(conditions, updateParams).exec();
      }
    })
    .then(() => {
      let startTime = pointData.sensors.startTime;
      if (pointData.sensors.startTime !== null) {
        startTime = new Date(pointData.sensors.startTime);
      }

      return productTemperatureModel
        .findOne({
          'product.id': productObj._id,
          'temperature.startTime': new Date(pointData.sensors.startTime)
        })
        .exec()
        .then(productTemperatureObj => {
          if (productTemperatureObj === null) {
            productTemperatureObj = new productTemperatureModel();
            productTemperatureObj.product = {
              id: productObj._id,
              code: productObj.code,
              name: productObj.name
            };
            productTemperatureObj.client = pointData.client;
            productTemperatureObj.sensor = {
              id: pointData.sensors.id,
              code: pointData.sensors.code,
              name: pointData.sensors.name
            };
            productTemperatureObj.temperature = {};
            productTemperatureObj.temperature.startTime = startTime;
          }

          const breaches = pointData.sensors.breachInfos.map(row => {
            let startTime = row.start;
            if (row.start !== null) {
              startTime = new Date(row.start);
            }

            let endTime = row.end;
            if (row.end !== null) {
              endTime = new Date(row.end);
            }
            return {
              start: startTime,
              end: endTime,
              duration: Number(row.duration),
              avgTemp: Number(row.avgTemp),
              minMaxTemp: Number(row.minMaxTemp),
              breachType: row.breachType
            };
          });

          productTemperatureObj.temperature.breaches = breaches;

          let endTime = pointData.sensors.endTime;
          if (pointData.sensors.endTime !== null) {
            endTime = new Date(pointData.sensors.endTime);
          } else {
            endTime = new Date(pointData.ts);
          }

          productTemperatureObj.device = pointData.deviceInfo;

          productTemperatureObj.pointId = pointData._id;

          productTemperatureObj.lastTracked = new Date(pointData.ts);

          productTemperatureObj.lastRecordedTemp = pointData.sensors.lastRecordedTemp;

          productTemperatureObj.temperature.endTime = endTime;

          productTemperatureObj.temperature.breachCount = Number(pointData.sensors.breachCount);
          productTemperatureObj.temperature.breachDuration = Number(
            pointData.sensors.breachDuration
          );
          productTemperatureObj.temperature.breaches = breaches;
          productTemperatureObj.temperature.lastRecordedTemp = Number(
            pointData.sensors.lastRecordedTemp
          );
          productTemperatureObj.temperature.minRecordedTemp = Number(
            pointData.sensors.minRecordedTemp
          );
          productTemperatureObj.temperature.maxRecordedTemp = Number(
            pointData.sensors.maxRecordedTemp
          );
          productTemperatureObj.temperature.avgTemp = Number(pointData.sensors.avgTemp);
          productTemperatureObj.temperature.kineticMeanTemp = Number(
            pointData.sensors.kineticMeanTemp
          );
          productTemperatureObj.temperature.totalDuration = Number(pointData.sensors.totalDuration);

          return productTemperatureObj.save();
        });
    })
    .then(productTemperatureObj => {
      let conditions = {
        'product.id': productObj._id,
        trackingId: productTemperatureObj._id
      };
      const clientHandler = require('./../../lib/clientHandler');
      clientHandler.setClient({ clientId: pointData.clientid, projectId: pointData.projectid });
      conditions = clientHandler.addClientFilterToConditions(conditions);
      return productTemperatureHistoryModel
        .count(conditions)
        .exec()
        .then(productTemperatureHistCount => {
          // const clientHandler = require('../lib/clientHandler');
          // clientHandler.setClient({ clientId: pointData.clientid, projectId: pointData.projectid });

          let tempArray = [];
          if (productTemperatureHistCount === 0) {
            tempArray = pointData.sensors.temp;
          } else {
            tempArray = pointData.sensors.temp.slice(
              productTemperatureHistCount,
              pointData.sensors.temp.length
            );
          }

          const promises = tempArray.map((temperature, idx) => {
            const tm =
              pointData.sensors.startTime +
              (pointData.sensors.temp.length - tempArray.length + idx) *
                pointData.sensors.cycle *
                1000;

            const insertParams = {
              product: {
                id: productObj._id,
                code: productObj.code,
                name: productObj.name
              },
              client: pointData.client,
              trackingId: productTemperatureObj._id,
              recordedTemp: temperature,
              scanTime: new Date(tm)
            };

            return self.saveProductTemperatureHistory(insertParams);
          });

          return bluebirdPromise.all(promises);
        });
    });
};

/**
 * Update Product tracking information from tracking data
 * 
 * @param {Object} productobj Product Data
 * @param {Object} pointData Tracking Data
 * @param {Object} currenLocation Location Object
 * @return {Promise} Promise after saving
 * 
 */
productTrackingService.prototype.saveProductTemperatureHistory = function(
  productTemperatureHistoryData
) {
  const productTemperatureHistoryObj = new productTemperatureHistoryModel();
  for (const v in productTemperatureHistoryData) {
    productTemperatureHistoryObj[v] = productTemperatureHistoryData[v];
  }
  // akUtils.log(updateParams);
  // // console.log(productTemperatureModel);
  return productTemperatureHistoryObj.save();
};

module.exports = new productTrackingService();
