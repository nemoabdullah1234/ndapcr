/* jshint esversion: 6 */

const commonHelper = require('../helpers/common');
const bluebirdPromise = require('bluebird');
const messages = require('../mappings/messagestring.json');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');

/**
 * Save a thing.
 *  
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.saveThing = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    const thingshelper = require('../helpers/things');
    thingshelper
      .validateRequest(event)
      .then(() => {
        thingshelper
          .save(event)
          .then(result => thingshelper.getById(result._id))
          .then(result => {
            const response = {
              statusCode: 200,
              headers: {
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                code: 200,
                message: messages.OK,
                description: messages.BEACON_SAVE_SUCCESS,
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
                message: messages.NO_RECORD_FOUND,
                description: messages.NO_RECORD_FOUND,
                data: {}
              })
            };
            mongoose.disconnect();
            callback(null, response);
          });
      })
      .catch(errors => {
        // console.log(errors);
        const response = {
          statusCode: 422,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 422,
            message: messages.VALIDATION_ERROR,
            description: messages.VALIDATION_ERRORS_OCCOURED,
            data: errors
          })
        };
        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Get Single thing for specified ID
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getThingById = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    const thingHelper = require('../helpers/things');
    thingHelper
      .getById(event.pathParameters.id)
      .then(result => {
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 200,
            message: messages.OK,
            description: messages.BEACON_FETCH_SUCCESS,
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
            message: messages.NO_RECORD_FOUND,
            description: messages.NO_RECORD_FOUND,
            data: {}
          })
        };
        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Get thing List
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getThings = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose'); // TODO: change from mongoose to dbconnection
    commonHelper.connectToDb(dbURI);
    const thingHelper = require('../helpers/things');
    bluebirdPromise
      .all([
        thingHelper.get(thingHelper.getFilterParams(event), thingHelper.getExtraParams(event)),
        thingHelper.count(thingHelper.getFilterParams(event))
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
            description: messages.BEACON_LIST,
            totalRecords: resultObj[1],
            recordsCount: resultObj[0].length,
            data: resultObj[0]
          })
        };
        mongoose.disconnect();
        callback(null, response);
      })
      .catch(error => {
        const response = {
          statusCode: 404,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 404,
            message: messages.No_RECORDS,
            description: messages.No_RECORDS,
            data: []
          })
        };
        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Update a things.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.updateThing = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    const thinghelper = require('../helpers/things');
    thinghelper
      .validateUpdate(event)
      .then(() => {
        thinghelper
          .update(event)
          .then(result => {
            const response = {
              statusCode: 200,
              headers: {
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                code: 200,
                message: messages.OK,
                description: messages.BEACON_UPDATE_SUCCESS,
                data: result
              })
            };
            mongoose.disconnect();
            callback(null, response);
          })
          .catch(error => {
            // console.log(error);
            const response = {
              statusCode: 304,
              headers: {
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                code: 304,
                message: messages.BEACON_UPDATE_FAIL,
                description: messages.BEACON_UPDATE_FAIL,
                data: {}
              })
            };
            mongoose.disconnect();
            callback(null, response);
          });
      })
      .catch(errors => {
        // console.log(errors);
        const response = {
          statusCode: 422,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 422,
            message: messages.VALIDATION_ERROR,
            description: messages.VALIDATION_ERRORS_OCCOURED,
            data: errors
          })
        };
        mongoose.disconnect();
        callback(null, response);
      });
  });
};
/**
 * Returns things data specific to things ids provided.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getFilteredThings = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    const thingHelper = require('../helpers/things');
    thingHelper
      .validateInput(event)
      .then(() => {
        thingHelper
          .getFilterArrayThings(event.body.things, event.body.type)
          .then(result => {
            const response = {
              statusCode: 200,
              headers: {
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                code: 200,
                message: messages.OK,
                description: messages.BEACON_FETCH_SUCCESS,
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
                message: messages.No_RECORDS,
                description: messages.No_RECORDS,
                data: {}
              })
            };
            mongoose.disconnect();
            callback(null, response);
          });
      })
      .catch(error => {
        const response = {
          statusCode: 422,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 422,
            message: messages.VALIDATION_ERROR,
            description: messages.VALIDATION_ERRORS_OCCOURED,
            data: error
          })
        };
        mongoose.disconnect();
        callback(null, response);
      });
  });
};
/**
 * Fetch things by code
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getThingByCode = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    const thingHelper = require('../helpers/things');
    thingHelper
      .getByCode(event.queryStringParameters.code)
      .then(result => {
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 200,
            message: messages.OK,
            description: messages.BEACON_FETCH_SUCCESS,
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
            message: messages.NO_RECORD_FOUND,
            description: messages.NO_RECORD_FOUND,
            data: {}
          })
        };
        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Get thing List
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getAssociatableThings = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose'); // TODO: change from mongoose to dbconnection
    commonHelper.connectToDb(dbURI);
    const thingHelper = require('../helpers/things');
    bluebirdPromise
      .all([
        thingHelper.get(thingHelper.getFilterParams(event), thingHelper.getExtraParams(event)),
        thingHelper.count(thingHelper.getFilterParams(event))
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
            description: messages.BEACON_LIST,
            totalRecords: resultObj[1],
            recordsCount: resultObj[0].length,
            data: resultObj[0]
          })
        };
        mongoose.disconnect();
        callback(null, response);
      })
      .catch(error => {
        // console.log(error);
        const response = {
          statusCode: 404,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 404,
            message: messages.No_RECORDS,
            description: messages.No_RECORDS,
            data: []
          })
        };
        mongoose.disconnect();
        callback(null, response);
      });
  });
};
