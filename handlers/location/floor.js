/* jshint esversion: 6 */

const commonHelper = require('../../helpers/common');
const bluebirdPromise = require('bluebird');
const messages = require('../../mappings/messagestring.json');
const clientHandler = require('../../lib/clientHandler');
const currentUserHandler = require('../../lib/currentUserHandler');
/**
 * Get location List
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getFloors = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose'); // TODO: change from mongoose to dbconnection
    commonHelper.connectToDb(dbURI);
    const locationhelper = require('../../helpers/core/floor');
    bluebirdPromise
      .all([
        locationhelper.get(
          locationhelper.getFilterParams(event),
          locationhelper.getExtraParams(event)
        ),
        locationhelper.count(locationhelper.getFilterParams(event))
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
            description: messages.LOCATION_LIST,
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
            message: messages.NO_RECORDS,
            description: messages.NO_RECORDS,
            data: []
          })
        };
        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Get Single location for specified ID
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getFloorById = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    const locationhelper = require('../../helpers/core/floor');
    event = commonHelper.parseLambdaEvent(event);
    locationhelper
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
            description: messages.LOCATION_FETCH_SUCCESS,
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
 * Save a location.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.saveFloor = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    const locationhelper = require('../../helpers/core/floor');
    locationhelper
      .validateRequest(event)
      .then(() => {
        locationhelper
          .save(event)
          .then(result => {
            // console.log(result);
            return locationhelper.getById(result._id);
          })
          .then(result => {
            const response = {
              statusCode: 200,
              headers: {
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                code: 200,
                message: messages.OK,
                description: messages.LOCATION_SAVE_SUCCESS,
                data: result
              })
            };
            mongoose.disconnect();
            callback(null, response);
          })
          .catch(error => {
            // console.log();
            const response = {
              statusCode: 404,
              headers: {
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                code: 404,
                message: messages.NO_RECORD_FOUND,
                description: messages.NO_RECORD_FOUND,
                data: error
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
 * Update a location.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.updateFloor = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    const locationhelper = require('../../helpers/core/floor');
    locationhelper
      .validateUpdate(event)
      .then(() => {
        locationhelper
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
                description: messages.LOCATION_UPDATE_SUCCESS,
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
                message: messages.LOCATION_UPDATE_FAIL,
                description: messages.LOCATION_UPDATE_FAIL,
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
 * Get a list of locations along with their floors
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getFloorsList = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    const locationhelper = require('../../helpers/core/floor');
    event = commonHelper.parseLambdaEvent(event);
    locationhelper
      .getFloorsList()
      .then(result => {
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 200,
            message: messages.OK,
            description: messages.LOCATION_FLOOR_LIST,
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
 * Get floors of a particular location
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getFloorByLocId = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    const locationhelper = require('../../helpers/core/floor');
    event = commonHelper.parseLambdaEvent(event);
    locationhelper
      .getFloorByLocId(event.pathParameters.id)
      .then(result => {
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 200,
            message: messages.OK,
            description: messages.LOCATION_FLOOR_LIST,
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
 * Gen Zones on a floor along with products detected on those zones.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getZoneProductsOnFloor = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    const locationhelper = require('../../helpers/core/floor');
    event = commonHelper.parseLambdaEvent(event);
    locationhelper
      .getZoneProductsOnFloor(event.pathParameters.id)
      .then(result => {
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 200,
            message: messages.OK,
            description: messages.LOCATION_ZONE_FETCH,
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

module.exports.getFloorsByLocationId = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    const locationhelper = require('../../helpers/core/floor');
    event = commonHelper.parseLambdaEvent(event);
    event.queryStringParameters.location = event.pathParameters.id;
    bluebirdPromise
      .all([
        locationhelper.get(
          locationhelper.getFilterParams(event),
          locationhelper.getExtraParams(event)
        ),
        locationhelper.count(locationhelper.getFilterParams(event))
      ])
      .then(result => {
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 200,
            message: messages.OK,
            description: messages.LOCATION_FLOOR_LIST,
            totalRecords: result[1],
            recordsCount: result[0].length,
            data: result[0]
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
            data: []
          })
        };
        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Get Single location for specified ID
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getFloorsZoneProducts = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    const locationhelper = require('../../helpers/core/floor');
    event = commonHelper.parseLambdaEvent(event);
    locationhelper
      .getFloorsZoneProducts(event.pathParameters.id)
      .then(result => {
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 200,
            message: messages.OK,
            description: messages.LOCATION_FETCH_SUCCESS,
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

module.exports.getFloorsInLocationInventory = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    const locationhelper = require('../../helpers/core/floor');
    event = commonHelper.parseLambdaEvent(event);
    event.queryStringParameters.parent = event.pathParameters.id;
    locationhelper
      .getFloorByLocId(event.pathParameters.id)
      .then(result => {
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 200,
            message: messages.OK,
            description: messages.LOCATION_FLOOR_LIST,
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
