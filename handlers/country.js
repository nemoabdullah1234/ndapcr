/* jshint esversion: 6 */
const commonHelper = require('../helpers/common');
const bluebirdPromise = require('bluebird');
const mongoose = require('mongoose'); // TODO: change from mongoose to dbconnection
const countryhelper = require('../helpers/country');
const akResponse = require('../lib/respones');
const messages = require('../mappings/messagestring.json');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');
/**
 * Get country List
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getCountries = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));

    commonHelper.connectToDb(dbURI);

    bluebirdPromise
      .all([countryhelper.getCountries(), countryhelper.count()])
      .then(resultObj => {
        const response = akResponse.listSuccess(resultObj, 'Country List');

        mongoose.disconnect();
        callback(null, response);
      })
      .catch(() => {
        // TODO : please remove 404 from catch block as it is a valid success response. catch should only catught exceptions and return with status in range of 500
        const response = akResponse.noDataFound(messages.NO_RECORDS, messages.NO_RECORDS);
        mongoose.disconnect();
        callback(null, response);
      });
  });
};
