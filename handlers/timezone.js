/* jshint esversion: 6 */
const commonHelper = require('../helpers/common');
const bluebirdPromise = require('bluebird');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');

/**
 * Get Time Zone list
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */

module.exports.getTimezones = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose'); // TODO: change from mongoose to dbconnection
    commonHelper.connectToDb(dbURI);
    const timezonehelper = require('../helpers/timezone');
    bluebirdPromise
      .all([timezonehelper.getTimezones(), timezonehelper.countTimezones()])
      .then(resultObj => {
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 200,
            message: 'Success',
            description: 'Timezones List',
            totalRecords: resultObj[1],
            recordsCount: resultObj[0].length,
            data: resultObj[0]
          })
        };
        mongoose.disconnect();
        callback(null, response);
      })
      .catch(() => {
        const response = {
          statusCode: 404,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 404,
            message: 'No Records Found',
            description: 'No Records Found',
            data: []
          })
        };
        mongoose.disconnect();
        callback(null, response);
      });
  });
};
