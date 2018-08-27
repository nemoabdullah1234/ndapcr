const commonHelper = require('../helpers/common');
const bluebirdPromise = require('bluebird');
const messages = require('../mappings/messagestring.json');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');

/**
 * Get tag List
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getTags = (event, context, callback) => {
  commonHelper
    .decryptDbURI()
    .then(dbURI => {
      event = commonHelper.parseLambdaEvent(event);
      clientHandler.setClient(clientHandler.getClientObject(event));
      currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
      const mongoose = require('mongoose');
      commonHelper.connectToDb(dbURI);
      const tagHelper = require('../helpers/tags');
      bluebirdPromise
        .all([
          tagHelper.get(tagHelper.getFilterParams(event), tagHelper.getExtraParams(event)),
          tagHelper.count(tagHelper.getFilterParams(event))
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
              description: messages.TAG_LIST,
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
              message: messages.NO_RECORDS,
              description: messages.NO_RECORDS,
              data: []
            })
          };
          mongoose.disconnect();
          callback(null, response);
        });
    })
    .catch(err => {
      // console.log(err);
      const response = {
        statusCode: 403,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          code: 403,
          message: messages.NOT_AUTHORIZED
        })
      };
      callback(null, response);
    });
};

/**
 * Get Single tag for specified ID
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getTagById = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    const tagHelper = require('../helpers/tags');
    tagHelper
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
            description: messages.TAG_FETCH_SUCCESS,
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
 * Update a tag.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.updateTag = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const tagHelper = require('../helpers/tags');
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    tagHelper
      .validateUpdate(event)
      .then(() => {
        tagHelper
          .update(event)
          .then(() => tagHelper.getById(event.pathParameters.id))
          .then(result => {
            const response = {
              statusCode: 200,
              headers: {
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                code: 200,
                message: messages.OK,
                description: messages.TAG_UPDATE_SUCCESS,
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
                message: messages.TAG_UPDATE_FAIL,
                description: messages.TAG_UPDATE_FAIL,
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
 * Save a tag.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.saveTag = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const tagHelper = require('../helpers/tags');
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    tagHelper
      .validateRequest(event)
      .then(() => {
        tagHelper
          .save(event)
          .then(result => tagHelper.getById(result._id))
          .then(result => {
            const response = {
              statusCode: 201,
              headers: {
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                code: 201,
                message: messages.TAG_SAVE_SUCCESS,
                description: messages.TAG_SAVE_SUCCESS,
                data: result
              })
            };
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
                message: messages.TAG_CREATE_FAIL,
                description: messages.TAG_CREATE_FAIL,
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
