const commonHelper = require('../helpers/common');
const bluebirdPromise = require('bluebird');
const mongoose = require('mongoose');
const appSettingHelper = require('../helpers/appSettings');
const akResponse = require('../lib/respones');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');

// const search = require('../services/search');
// const util = require('util');

/**
 * Get appSetting List
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getAppSettings = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));
    commonHelper.connectToDb(dbURI);

    bluebirdPromise
      .all([
        appSettingHelper.getAppSettings(parsedEvent, 'general'),
        appSettingHelper.count(appSettingHelper.getFilterParams(parsedEvent))
      ])
      .then(resultObj => {
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 200,
            message: 'Success',
            status: 1,
            description: '',
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
          statusCode: 404,
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
 * Get Single appSetting for specified ID
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getAppSettingById = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));

    commonHelper.connectToDb(dbURI);
    appSettingHelper
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
            description: 'appSetting fetched successfully',
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
 * Update an appSetting.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.updateAppSettings = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));

    commonHelper.connectToDb(dbURI);
    appSettingHelper
      .validateRequest(parsedEvent)
      .then(() => {
        appSettingHelper
          .update(parsedEvent)
          .then(result => appSettingHelper.getAppSettings(event, 'general'))
          .then(
            result =>
              // index document in es
              // return search.indexData('appSettings', result);
              result
          )
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
                description: 'Settings updated successfully',
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
 * Save an appSetting.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.saveAppSetting = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));

    commonHelper.connectToDb(dbURI);
    appSettingHelper
      .validateRequest(parsedEvent)
      .then(populatedTags => {
        parsedEvent.body.tags = populatedTags.body.tags;
        appSettingHelper
          .save(parsedEvent)
          .then(result => appSettingHelper.getById(result._id, true))
          .then(
            result =>
              // index document in es
              // return search.indexData('appSettings', result);
              result
          )
          .then(result => {
            const response = commonHelper.formatResponse(
              201,
              'Settings updated successfully',
              'Ok',
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
                message: 'appSetting create failed',
                description: 'appSetting create failed',
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

/**
 * Get appSetting List
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getSpecificSettingForApp = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));

    commonHelper.connectToDb(dbURI);

    return appSettingHelper
      .getAppSettings(parsedEvent, event.pathParameters.settingType)
      .then(resultObj => {
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 200,
            message: 'OK',
            description: `${event.pathParameters.settingType} settings`,
            data: resultObj
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
        callback(null, response);
      });
  });
};

/**
 * Update an appSetting.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.updateSpecificSettingForApp = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));
    commonHelper.connectToDb(dbURI);
    const settingTypeMessageMap = {
      emergencyContacts: 'Contact List updated successfully',
      trackingHours: 'Settings Updated Successfully'
    };
    let body = {};
    body[event.pathParameters.settingType] = event.body;
    if (event.pathParameters.settingType === 'emergencyContacts') {
      body = (body || {}).emergencyContacts;
    }
    event.body = body;
    appSettingHelper
      .validateRequest(parsedEvent)
      .then(() => {
        appSettingHelper
          .update(parsedEvent)
          .then(result => appSettingHelper.getAppSettings(event, event.pathParameters.settingType))
          .then(
            result =>
              // index document in es
              // return search.indexData('appSettings', result);
              result
          )
          .then(result => {
            const response = akResponse.created(
              result,
              settingTypeMessageMap[event.pathParameters.settingType] ||
                'Settings updated successfully',
              'Created'
            );
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
