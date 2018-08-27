const commonHelper = require('../helpers/common');
const bluebirdPromise = require('bluebird');
const messages = require('../mappings/messagestring.json');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');
// const search = require('../services/search');
// const util = require('util');

/**
 * Get issue List
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getIssues = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    const issueHelper = require('../helpers/issue');
    // const req = commonHelper.lambdaEventToBodyParserReq(event);

    bluebirdPromise
      .all([
        issueHelper.get(issueHelper.getFilterParams(event), issueHelper.getExtraParams(event)),
        issueHelper.count(issueHelper.getFilterParams(event))
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
            status: 1,
            message: 'Success',
            description: messages.ATTRIBUTE_LIST,
            totalRecords: resultObj[1],
            recordsCount: resultObj[0].length,
            data: {
              readerGetIssueCommentsResponse: resultObj[0]
            }
          })
        };
        mongoose.disconnect();
        callback(null, response);
      })
      .catch(() => {
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 404,
            status: 0,
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
 * Get Single issue for specified ID
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getIssueById = (event, context, callback) => {
  // // console.log(event);
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    const issueHelper = require('../helpers/issue');
    issueHelper.setHeaders(event.headers);
    // issueHelper.setConfigs();
    issueHelper
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
            description: messages.ISSUE_FETCH_SUCCESS,
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
 * Get Single issue for specified ID
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getIssueByOrderId = (event, context, callback) => {
  // // console.log(event);
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    const issueHelper = require('../helpers/issue');
    issueHelper.setHeaders(event.headers);
    // issueHelper.setConfigs();
    issueHelper
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
            description: messages.ISSUE_FETCH_SUCCESS,
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
 * Update an issue.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.updateIssue = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const issueHelper = require('../helpers/issue');
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    issueHelper
      .validateUpdate(event)
      .then(() => {
        // event.body.tags = populatedTags.body.tags;
        issueHelper
          .update(event)
          .then(() =>
            // // console.log(result)
            issueHelper.getById(event.pathParameters.id, true)
          )
          .then(
            result =>
              // index document in es
              // return search.indexData('issues', result);
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
 * Save an issue.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.saveIssue = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const issueHelper = require('../helpers/issue');
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    issueHelper
      .validateRequest(event)
      .then(() => {
        issueHelper
          .save(event)
          .then(result => {
            const response = {
              statusCode: 200,
              headers: {
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                code: 200,
                status: 1,
                message: 'success',
                data: {
                  readerReportShippingIssueResponse: result
                },
                _links: {
                  self: {
                    href: 'http://strykerapi.nicbit.ossclients.com/reader/reportShippingIssue'
                  }
                }
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
 * Get Single issue for specified ID
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getIssueDetails = (event, context, callback) => {
  // // console.log(event);
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    const issueHelper = require('../helpers/issue');
    issueHelper.setHeaders(event.headers);
    // issueHelper.setConfigs();
    issueHelper
      .getById(event.pathParameters.id, 'web')
      .then(result => {
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 200,
            message: 'Ok',
            description: messages.ISSUE_FETCH_SUCCESS,
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
