const commonHelper = require('../helpers/common');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');
// const bluebirdPromise = require('bluebird');

/**
 * Webhook for analytics data from kontakt.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.recieveKontaktData = (event, context, callback) => {
  // // console.log(event);
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const kontaktHelper = require('../helpers/kontakt');
    kontaktHelper.setHeaders(event.headers);
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    // console.log('kontakt request event=============');
    // console.log(`type of event.body${typeof event.body}`);
    if (event.headers.type === 'SUBSCRIPTION_CONFIRMATION') {
      kontaktHelper.confirmSubscription(event).then(res => {
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify(res)
        };
        // console.log('response given to kontakt......');
        // console.log(response);
        mongoose.disconnect();
        callback(null, response);
      });
    }
    if (event.headers.type === 'DATA') {
      kontaktHelper
        .recieveData(event)
        .then(() => {
          const response = {
            statusCode: 202,
            headers: {
              'Access-Control-Allow-Origin': '*'
            }
          };
          mongoose.disconnect();
          // console.log('request saved success...');
          // console.log(response);
          callback(null, response);
        })
        .catch(error => {
          // console.log('error in handler');
          // console.log(error);

          const response = {
            statusCode: 202,
            headers: {
              'Access-Control-Allow-Origin': '*'
            }
          };
          mongoose.disconnect();
          callback(null, response);
        });
    }
  });
};

/**
 * Subscribe webhook on kontakt for analyticts data.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.subscribeWebHook = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const kontaktHelper = require('../helpers/kontakt');
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    kontaktHelper
      .subscribe(event)
      .then(result => {
        const response = {
          statusCode: result.statusCode,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify(result)
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
            message: 'Update Failed',
            description: 'Update Failed',
            data: {}
          })
        };
        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Webhook resubscription function.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.resubscribe = (event, context, callback) => {
  // // console.log(event);
  commonHelper.decryptDbURI().then(dbURI => {
    // commonHelper.setClientAndUpdatedBy(commonHelper.getClientObject(event), commonHelper.getActionSourceUser(event));
    const kontaktHelper = require('../helpers/kontakt');
    kontaktHelper.setHeaders(event.headers);
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    // console.log('kontakt resubscription event=============');
    kontaktHelper
      .webhookResubscribe(event)
      .then(res => {
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          }
        };
        mongoose.disconnect();
        // console.log('request resubscribed success...');
        // console.log(res);
        callback(null, response);
      })
      .catch(error => {
        // console.log('error in handler');
        // console.log(error);

        const response = {
          statusCode: 202,
          headers: {
            'Access-Control-Allow-Origin': '*'
          }
        };
        mongoose.disconnect();
        callback(null, response);
      });
  });
};
