/**
 * Fetch details of a location surrounding a particular lat-long coordinate.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */

const clientHandler = require('../../lib/clientHandler');
const currentUserHandler = require('../../lib/currentUserHandler');

module.exports.findNearbyLocation = (event, context, callback) => {
  const commonHelper = require('../../helpers/common');
  event = commonHelper.parseLambdaEvent(event);
  clientHandler.setClient(clientHandler.getClientObject(event));
  currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
  commonHelper.decryptDbURI().then(dbURI => {
    const mongoose = require('mongoose'); // TODO: change from mongoose to dbconnection
    commonHelper.connectToDb(dbURI);
    const nearbyLocationHelper = require('../../helpers/tracking/nearbyLocation');

    nearbyLocationHelper
      .getLocationFromLatLong(event)
      .then(resultObj => {
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 200,
            message: 'NearbyLocation Result',
            data: resultObj
          })
        };
        mongoose.disconnect();
        callback(null, response);
      })
      .catch(error => {
        if (error instanceof Error) {
          // console.log(error);
        }
        const response = {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 400,
            message: 'Something went wrong',
            data: error
          })
        };
        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Fetch list of zones which have any thing attached to it from a particular list of things.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.findZone = (event, context, callback) => {
  const commonHelper = require('../../helpers/common');
  event = commonHelper.parseLambdaEvent(event);
  clientHandler.setClient(clientHandler.getClientObject(event));
  currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
  commonHelper.decryptDbURI().then(dbURI => {
    const mongoose = require('mongoose'); // TODO: change from mongoose to dbconnection
    commonHelper.connectToDb(dbURI);
    const findZoneHelper = require('../../helpers/tracking/findZone');
    event = commonHelper.parseLambdaEvent(event);
    findZoneHelper
      .getZonesFromThings(event)
      .then(resultObj => {
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 200,
            message: 'findZone Result',
            data: resultObj
          })
        };
        mongoose.disconnect();
        callback(null, response);
      })
      .catch(error => {
        if (error instanceof Error) {
          // console.log(error);
        }
        const response = {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 400,
            message: 'Something went wrong',
            data: error
          })
        };
        mongoose.disconnect();
        callback(null, response);
      });
  });
};
