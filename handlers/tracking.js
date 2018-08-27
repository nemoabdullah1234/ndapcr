/* jshint esversion: 6 */
const commonHelper = require('../helpers/common');
const bluebirdPromise = require('bluebird');
const mongoose = require('mongoose');
const trackingHelper = require('../helpers/tracking');
const LambdaLib = require('../lib/aws/lambda');
const akResponses = require('../lib/respones');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');

const lambda = new LambdaLib();

module.exports.trackingApi = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    commonHelper.connectToDb(dbURI);
    clientHandler.setClient(clientHandler.getClientObject({}));
    return trackingHelper
      .getApiData(parsedEvent)
      .then(result => akResponses.success(result, 'Tracking API Data', 'Success'))
      .catch(err => {
        console.log(err);
        return akResponses.somethingWentWrong({});
      })
      .then(response => {
        callback(null, response);
        mongoose.disconnect();
      });
  });
};

/**
 * Front face lambda for product tracking
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.trackKinesis = (event, context, callback) => {
  // console.log(`Start Lambda${new Date()}`);
  event.kinTrLbdTm = new Date();
  lambda.executeAsync(
    process.env.trackingLambda,
    event,
    () => {
      // console.log('Request transferred');
      const response = {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          code: 200,
          message: 'Ok',
          description: 'Tracking Request transferred'
        })
      };
      // console.log(`End Lambda${new Date()}`);
      callback(null, response);
    },
    process.env.stage
  );
};

/**
 * Process Tracking Data for product tracking
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.processTracking = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    commonHelper.connectToDb(dbURI);

    // const req = commonHelper.lambdaEventToBodyParserReq(event);
    processRequest(event)
      .then(() => {
        // // console.log(results);
        // console.log('IN SUCCSS');
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 200,
            message: 'Ok',
            description: 'Tracking data added successfully'
          })
        };
        mongoose.disconnect();
        callback(null, response);
      })
      .catch(error => {
        // console.log('IN ERRR');
        // console.log(error);
        const response = {
          statusCode: 422,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 422,
            message: `Error in process tracking data :  ${error.message}`,
            description: 'Error in process tracking data ',
            data: {}
          })
        };
        mongoose.disconnect();
        callback(null, response);
      });
  });

  function processRequest(data) {
    const pkids = [];
    let records = [];

    records = data.Records.filter((row, idx) => {
      const parsedData = Buffer.from(row.kinesis.data, 'base64').toString();
      const jParsedData = JSON.parse(parsedData);
      if (pkids.indexOf(`${jParsedData.pkid}--${jParsedData.sensors.code}`) === -1) {
        pkids.push(`${jParsedData.pkid}--${jParsedData.sensors.code}`);
        return true;
      }
      return false;
    });

    const promises = records.map((row, idx) => {
      // // console.log(row);
      // // console.log(row.kinesis);
      const parsedData = Buffer.from(row.kinesis.data, 'base64').toString();
      // // console.log(parsedData);
      const jParsedData = JSON.parse(parsedData);
      // // console.log(jParsedData.pkid + ' -- ' + jParsedData.sensors.code);
      jParsedData.blStrmTm = new Date(row.kinesis.approximateArrivalTimestamp * 1000);
      jParsedData.kinTrLbdTm = new Date(data.kinTrLbdTm);
      // // console.log(`Current Time : ${new Date()}`);
      // // console.log(`Track Time : ${new Date(data.ts)}`);

      return trackingHelper.saveTracking(jParsedData);
    });

    return bluebirdPromise.all(promises);
  }

  /* function processRow(data) {
    // console.log(`Current Time : ${new Date()}`);
    // console.log(`Track Time : ${new Date(data.ts)}`);

    // return trackingHelper.saveTracking(data);
    
    return trackingHelper.getProductData(data).then(
      productData => trackingHelper.saveProductTracking(data, productData)
      // return new Promise( (resolve) => {
      // resolve('INSID')
      // } );
    );
  } */
};

/**
 * Front face lambda for shipment tracking
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.trackKinesisShipment = (event, context, callback) => {
  // console.log(`Start Lambda${new Date()}`);
  event.kinTrLbdTm = new Date();
  // // console.log([process.env.shipmentLambda, process.env.shipmentStatusLambda]);

  lambda.executeAsync(
    process.env.shipmentStatusLambda,
    event,
    () => {
      // console.log('Request transferred');
      const response = {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          code: 200,
          message: 'Ok',
          description: 'Shipment Status Tracking Request transferred'
        })
      };
      // console.log(`End Lambda${new Date()}`);
      callback(null, response);
    },
    process.env.stage
  );
};

/**
 * Process Tracking Data for shipment status tracking
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.processShipmentStatus = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    commonHelper.connectToDb(dbURI);
    // const req = commonHelper.lambdaEventToBodyParserReq(event);
    prepareShipmentStatus(event)
      .then(results => {
        // console.log(results);
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 200,
            message: 'Ok',
            description: 'Shipment Status Tracking processed successfully'
          })
        };
        mongoose.disconnect();
        callback(null, response);
      })
      .catch(error => {
        // console.log(error);
        const response = {
          statusCode: 422,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 422,
            message: `Error in process tracking data :  ${error.message}`,
            description: 'Error in process tracking data ',
            data: {}
          })
        };
        mongoose.disconnect();
        callback(null, response);
      });
  });

  function prepareShipmentStatus(data) {
    const promises = data.Records.map((row, idx) => {
      const parsedData = Buffer.from(row.kinesis.data, 'base64').toString();
      const jParsedData = JSON.parse(parsedData);
      return trackingHelper.processShipmentStatusRow(jParsedData);
    });

    return bluebirdPromise.all(promises);
  }

  function processShipmentStatusRow(data) {
    return trackingHelper.getShipmentData(data).then(shipments => {
      const promises = shipments.map((row, idx) =>
        bluebirdPromise.all([
          trackingHelper.saveShipmentShipStatus(row._id, data),
          trackingHelper.saveShipmentDeliverStatus(row._id, data)
        ])
      );
      return bluebirdPromise.all(promises);
    });
  }
};

/**
 * Get Mobile Logs & save to Mongo
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getMobileLogs = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    commonHelper.connectToDb(dbURI);
    // const req = commonHelper.lambdaEventToBodyParserReq(event);
    getLogsData(event)
      .then(results => {
        // // console.log(results);
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 200,
            message: 'Ok',
            description: 'Shipment Status Tracking processed successfully'
          })
        };
        mongoose.disconnect();
        callback(null, response);
      })
      .catch(error => {
        // console.log(error);
        const response = {
          statusCode: 422,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 422,
            message: `Error in process tracking data :  ${error.message}`,
            description: 'Error in process tracking data ',
            data: {}
          })
        };
        mongoose.disconnect();
        callback(null, response);
      });
  });

  function getLogsData(data) {
    const promises = data.Records.map((row, idx) => {
      // console.log(row.s3);
      // console.log(row.s3.object);
      // return row.s3;
      // let parsedData = Buffer.from(row.kinesis.data, 'base64').toString();
      // let jParsedData = JSON.parse(parsedData);
      if (typeof row.s3.object.key !== 'undefined') {
        return trackingHelper.getMobileLogs(row.s3.bucket.name, row.s3.object.key);
      }
      return false;
    });

    return bluebirdPromise.all(promises);
  }
};
