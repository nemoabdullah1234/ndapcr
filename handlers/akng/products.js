/* jshint esversion: 6 */

const commonHelper = require('../../helpers/common');
const clientHandler = require('../../lib/clientHandler');
const currentUserHandler = require('../../lib/currentUserHandler');
// const bluebirdPromise = require('bluebird');

/**
 * Get products at given location
 * 
 * @param {Object} event event passed to the lambda 
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getProductsAtLocation = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose'); // TODO: change from mongoose to dbconnection
    commonHelper.connectToDb(dbURI);
    const producthelper = require('../../helpers/akng/product');
    producthelper
      .getProductsAtLocation(event.queryStringParameters.location)
      .then(resultObj => {
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 200,
            message: 'Success',
            description: 'Product List',
            recordsCount: resultObj.length,
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
