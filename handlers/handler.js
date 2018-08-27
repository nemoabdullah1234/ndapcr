/* jshint esversion: 6 */

const commonHelper = require('../helpers/common');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');

module.exports.getDependencyCount = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const helper = require('../helpers/dependency');
    const mongoose = require('mongoose');
    helper.create({
      bbPromise: require('bluebird'),
      mongoose,
      commonHelper
    });
    commonHelper.connectToDb(dbURI);
    helper
      .findDependentCount({
        entity: event.pathParameters.entity,
        id: event.pathParameters.id
      })
      .then(totalCount => {
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 200,
            message: 'OK',
            description: 'Dependent Count',
            data: {
              entity: event.pathParameters.entity,
              id: event.pathParameters.id,
              dependentCount: totalCount
            }
          })
        };
        return response;
      })
      .catch(err => {
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 400,
            message: 'Bad Request',
            description: 'Something went wrong',
            data: {
              entity: event.pathParameters.entity,
              id: event.pathParameters.id
            },
            error: err.message
          })
        };
        return response;
      })
      .then(response => {
        callback(null, response);
        mongoose.disconnect();
      });
  });
};
