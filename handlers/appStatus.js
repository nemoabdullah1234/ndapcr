const commonHelper = require('../helpers/common');
const bluebirdPromise = require('bluebird');
const mongoose = require('mongoose');
const appStatusHelper = require('../helpers/appStatus');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');
// const search = require('../services/search');
// const util = require('util');

/**
 * Get appStatus List
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getAppStatus = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));

    commonHelper.connectToDb(dbURI);

    bluebirdPromise
      .all([
        appStatusHelper.getAppStatus(parsedEvent),
        appStatusHelper.count(appStatusHelper.getFilterParams(parsedEvent))
      ])
      .then(resultObj => {
        // // console.log(util.inspect(resultObj, true, null))
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 200,
            message: 'Success',
            status: 1,
            description: 'appStatus List',
            totalRecords: resultObj[1],
            recordsCount: resultObj[0].length,
            data: {
              readerGetSettingsResponse: resultObj[0]
            },
            _links: {
              self: {
                href: 'http://strykerapi.nicbit.ossclients.com/reader/feedback'
              }
            }
          })
        };
        mongoose.disconnect();
        callback(null, response);
      })
      .catch(() => {
        const response = {
          statusCode: 403,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 404,
            status: 0,
            message: 'No Records Found',
            description: 'No Records Found',
            data: {},
            _links: {
              self: {
                href: 'http://strykerapi.nicbit.ossclients.com/reader/feedback'
              }
            }
          })
        };
        callback(null, response);
      });
  });
};

/**
 * Get Single appStatus for specified ID
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getAppStatusById = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));
    commonHelper.connectToDb(dbURI);
    appStatusHelper
      .getById(parsedEvent.pathParameters.id)
      .then(result => {
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 200,
            message: 'Ok',
            description: 'appStatus fetched successfully',
            data: result
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
            message: 'No Record Found',
            description: 'No Record Found',
            data: {}
          })
        };
        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Update an appStatus.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.updateAppStatus = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));
    commonHelper.connectToDb(dbURI);
    appStatusHelper
      .validateRequest(parsedEvent)
      .then(() => {
        appStatusHelper
          .update(parsedEvent)
          .then(result => appStatusHelper.getById(result._id))
          .then(result => {
            const response = {
              statusCode: 200,
              headers: {
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                code: 200,
                status: 1,
                message: 'Ok',
                description: 'appStatus updated successfully',
                data: {
                  ReaderUpdateSettingsResponse: result
                },
                _links: {
                  self: {
                    href: 'http://strykerapi.nicbit.ossclients.com/reader/feedback'
                  }
                }
              })
            };
            mongoose.disconnect();
            callback(null, response);
          })
          .catch(() => {
            const response = {
              statusCode: 304,
              headers: {
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                code: 304,
                status: 0,
                message: 'Update Failed',
                description: 'Update Failed',
                data: {},
                _links: {
                  self: {
                    href: 'http://strykerapi.nicbit.ossclients.com/reader/feedback'
                  }
                }
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
 * Save an appStatus.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.saveAppStatus = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));
    commonHelper.connectToDb(dbURI);
    appStatusHelper
      .validateRequest(parsedEvent)
      .then(populatedTags => {
        parsedEvent.body.tags = populatedTags.body.tags;
        appStatusHelper
          .save(parsedEvent)
          .then(result => appStatusHelper.getById(result._id, true))
          .then(
            result =>
              // index document in es
              // return search.indexData('appStatus', result);
              result
          )
          .then(result => {
            const response = commonHelper.formatResponse(
              201,
              'Ok',
              'appStatus saved successfully',
              result
            );
            mongoose.disconnect();
            callback(null, response);
          })
          .catch(() => {
            const response = {
              statusCode: 400,
              headers: {
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                code: 400,
                message: 'appStatus create failed',
                description: 'appStatus create failed',
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

module.exports.valErrors = (event, context, callback) => {
  const response = {
    statusCode: 422,
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      code: 422,
      message: 'ValidationErrors',
      description: 'Validation Errors Occured',
      data: [
        {
          message: 'Code is mandatory',
          code: 'required',
          field: 'code'
        },
        {
          message: 'Name is mandatory',
          code: 'required',
          field: 'name'
        }
      ]
    })
  };
  callback(null, response);
};
