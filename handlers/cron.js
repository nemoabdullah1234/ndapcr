/* jshint esversion: 6 */
const commonHelper = require('../helpers/common');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');
const mongoose = require('mongoose');
const helper = require('../helpers/cron');

/**
 * Update a emails.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.markNotReporting = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    commonHelper.connectToDb(dbURI);
    clientHandler.setClient(clientHandler.getClientObject({}));
    helper
      .markNotReporting()
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

/**
 * Update a emails.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.sendDelayedShipmentNotification = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    commonHelper.connectToDb(dbURI);
    clientHandler.setClient(commonHelper.getClientObject({}));
    currentUserHandler.setCurrentUser(commonHelper.getActionSourceUser({}));
    helper
      .sendDelayedShipmentNotification()
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

/**
 * Update a emails.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.sendDeviceSilentPush = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    commonHelper.connectToDb(dbURI);
    clientHandler.setClient(commonHelper.getClientObject({}));
    currentUserHandler.setCurrentUser(commonHelper.getActionSourceUser({}));
    helper
      .sendDeviceSilentPush()
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

/**
 * Update a emails.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.markDevicesInactive = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    commonHelper.connectToDb(dbURI);
    clientHandler.setClient(commonHelper.getClientObject({}));
    currentUserHandler.setCurrentUser(commonHelper.getActionSourceUser({}));
    helper
      .markDevicesInactive()
      .then(() => {
        mongoose.disconnect();
        // console.log('SUCCESS');
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

module.exports.disassociateNamedUsersFromOldChannels = (event, context, callback) => {
  // commonHelper.decryptDbURI().then(dbURI => {
  // commonHelper.connectToDb(dbURI);
  clientHandler.setClient(commonHelper.getClientObject({}));
  currentUserHandler.setCurrentUser(commonHelper.getActionSourceUser({}));
  helper
    .disassociateNamedUsersFromOldChannels()
    .then(() => {
      // mongoose.disconnect();
      callback(null, 'Done!');
      context.done(null, 'Function Finished!');
    })
    .catch(() => {
      // mongoose.disconnect();
      callback(null, 'Done!');
      context.done(null, 'Function Finished!');
    });
  // });
};

module.exports.markClosed = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    commonHelper.connectToDb(dbURI);
    clientHandler.setClient(commonHelper.getClientObject({}));
    currentUserHandler.setCurrentUser(commonHelper.getActionSourceUser({}));
    helper
      .markClosed()
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
