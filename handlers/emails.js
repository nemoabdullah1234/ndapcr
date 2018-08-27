/* jshint esversion: 6 */

const commonHelper = require('../helpers/common');
const messages = require('../mappings/messagestring.json');
const mongoose = require('mongoose');
const emailshelper = require('../helpers/emails');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');

/**
 * Update a emails.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.sendEmail = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));

    commonHelper.connectToDb(dbURI);

    emailshelper
      .sendEmail(
        parsedEvent.body.to,
        parsedEvent.body.subject,
        parsedEvent.body.action,
        parsedEvent.body.data
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
            description: 'messages.emails_UPDATE_SUCCESS',
            data: result
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
            message: messages.emails_UPDATE_FAIL,
            description: messages.emails_UPDATE_FAIL,
            data: {}
          })
        };
        mongoose.disconnect();
        callback(null, response);
      });
  });
};
