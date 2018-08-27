/* jshint esversion: 6 */

const commonHelper = require('../helpers/common');
const bluebirdPromise = require('bluebird');
const mongoose = require('mongoose');
const aws = require('aws-sdk');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');

aws.config.update({
  region: process.env.region
});
/**
 * Schedule sync job which results in SNS pulish of sync request.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.scheduleSync = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    const syncshelper = require('../helpers/syncjob');
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    syncshelper
      .validateRequest(event)
      .then(populatedEvent => {
        syncshelper
          .save(populatedEvent)
          .then(
            result =>
              syncshelper.publish(result._id).then(() => {
                const response = {
                  statusCode: 200,
                  headers: {
                    'Access-Control-Allow-Origin': '*'
                  },
                  body: JSON.stringify({
                    code: 200,
                    message: 'Ok',
                    description: 'Sync scheduled successfully',
                    data: result
                  })
                };
                mongoose.disconnect();
                callback(null, response);
              })

            // callback(null, response);
          )
          .catch(e => {
            // console.log(e);
            const response = {
              statusCode: 404,
              headers: {
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                code: 404,
                message: 'No Record Found',
                description: 'No Record Found',
                data: {}
              })
            };
            mongoose.disconnect();
            callback(null, response);
          });
      })
      .catch(errors => {
        const response = {
          statusCode: 422,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 422,
            message: 'ValidationErrors',
            description: 'Validation Errors Occured',
            data: errors
          })
        };
        mongoose.disconnect();
        callback(null, response);
      });
  });
};
/**
 * SNS invoked lambda which initiates fetch of data from thirdy party API
 * 
 * @param {Object} event event passed to the lambda from sns
 * @param {Object} context context passed to the lambdafrom sns
 * 
 */
module.exports.invokedSync = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    commonHelper.connectToDb(dbURI);
    clientHandler.setClient(event.client);
    currentUserHandler.setCurrentUser(event.trigerredBy);
    const syncshelper = require('../helpers/syncjob');
    // const responseArray = event.Records;
    return syncshelper
      .updateHandler(event.syncjobId)
      .then(() => {
        mongoose.disconnect();
        callback(null, 'Done!');
        context.done(null, 'Function Finished!');
      })
      .catch(() => {
        mongoose.disconnect();
        callback(null, 'Done!');
        context.done(null, 'Function Finished!');
      });
  });
};
