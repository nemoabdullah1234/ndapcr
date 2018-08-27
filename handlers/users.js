const commonHelper = require('../helpers/common');
const bluebirdPromise = require('bluebird');
const messages = require('../mappings/messagestring.json');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');
// const search = require('../services/search');
// const util = require('util');
const akUtils = require('../lib/utility');

/**
 * Get user List
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getUsers = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    const userHelper = require('../helpers/users');
    // const req = commonHelper.lambdaEventToBodyParserReq(event);

    bluebirdPromise
      .all([
        userHelper.get(userHelper.getFilterParams(event), userHelper.getExtraParams(event)),
        userHelper.count(userHelper.getFilterParams(event))
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
            description: messages.ATTRIBUTE_LIST,
            totalRecords: resultObj[1],
            recordsCount: resultObj[0].length,
            data: resultObj[0]
          })
        };
        mongoose.disconnect();
        callback(null, response);
      })
      .catch(err => {
        // console.log(err);
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
 * Get Single user for specified ID
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getUserById = (event, context, callback) => {
  // // console.log(event);
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    const userHelper = require('../helpers/users');
    userHelper.setHeaders(event.headers);
    // userHelper.setConfigs();
    userHelper
      .getById(event.pathParameters.id)
      .then(result => {
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 200,
            message: 'Ok',
            description: messages.ATTRIBUTE_FETCH_SUCCESS,
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
 * Update an user.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.updateUser = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const userHelper = require('../helpers/users');
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    userHelper
      .validateUpdate(event)
      .then(() => {
        // event.body.tags = populatedTags.body.tags;
        userHelper
          .update(event)
          // .then(() => {
          //     // // console.log(result)
          //     return userHelper.getById(event.pathParameters.id, true);
          // }).then((result) => {
          //     // index document in es
          //     //return search.indexData('users', result);
          //     return result;
          // })
          .then(result => {
            const response = {
              statusCode: 200,
              headers: {
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                code: 200,
                message: messages.OK,
                description: messages.ATTRIBUTE_UPDATE_SUCCESS,
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
                message: messages.ATTRIBUTE_UPDATE_FAIL,
                description: messages.ATTRIBUTE_UPDATE_FAIL,
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
 * Save an user.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.saveUser = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const userHelper = require('../helpers/users');
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    userHelper
      .validateRequest(event)
      .then(() => {
        userHelper
          .save(event)
          // .then((result) => {
          //     return userHelper.getById(result._id, true);
          // }).then((result) => {
          //     // index document in es
          //     //return search.indexData('users', result);
          //     return result;
          // })
          .then(result => {
            const response = commonHelper.formatResponse(
              201,
              messages.OK,
              messages.ATTRIBUTE_SAVE_SUCCESS,
              result
            );
            mongoose.disconnect();
            callback(null, response);
          })
          .catch(error => {
            // console.log(error);
            const response = {
              statusCode: 400,
              headers: {
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                code: 400,
                message: messages.ATTRIBUTE_CREATE_FAIL,
                description: messages.ATTRIBUTE_CREATE_FAIL,
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
 * Save an user.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.register = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject({}));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject({}));
    const userHelper = require('../helpers/users');
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    userHelper
      .validateRequest(event)
      .then(() => {
        userHelper
          .register(event)
          .then(result => {
            const response = commonHelper.formatResponse(
              201,
              messages.OK,
              messages.ATTRIBUTE_SAVE_SUCCESS,
              result
            );
            mongoose.disconnect();
            callback(null, response);
          })
          .catch(error => {
            akUtils.log(error, 'User creation error');

            const response = {
              statusCode: 400,
              headers: {
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                code: 400,
                message: messages.ATTRIBUTE_CREATE_FAIL,
                description: messages.ATTRIBUTE_CREATE_FAIL,
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
 * Update an user.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.updateProfile = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const userHelper = require('../helpers/users');
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    userHelper
      .validateUpdate(event)
      .then(() => {
        // event.body.tags = populatedTags.body.tags;
        userHelper
          .updateProfile(event)
          // .then(() => {
          //     // // console.log(result)
          //     return userHelper.getById(event.pathParameters.id, true);
          // }).then((result) => {
          //     // index document in es
          //     //return search.indexData('users', result);
          //     return result;
          // })
          .then(result => {
            const response = {
              statusCode: 200,
              headers: {
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                code: 200,
                message: messages.OK,
                description: messages.ATTRIBUTE_UPDATE_SUCCESS,
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
                message: messages.ATTRIBUTE_UPDATE_FAIL,
                description: messages.ATTRIBUTE_UPDATE_FAIL,
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
 * Update an user.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.postConfirmation = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const userHelper = require('../helpers/users');
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    // event.body.tags = populatedTags.body.tags;
    userHelper
      .updateOnTrigger(event)
      // .then(() => {
      //     // // console.log(result)
      //     return userHelper.getById(event.pathParameters.id, true);
      // }).then((result) => {
      //     // index document in es
      //     //return search.indexData('users', result);
      //     return result;
      // })
      .then(result => {
        // console.log('handler result');
        // console.log(result);
        // console.log(event);
        mongoose.disconnect();

        context.succeed(event);
      })
      .catch(error => {
        // console.log(error);
        context.succeed(event);
      });
  });
};
