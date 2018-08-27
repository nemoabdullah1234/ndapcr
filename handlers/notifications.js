const commonHelper = require('../helpers/common');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');
const akResponse = require('../lib/respones');
const akUtils = require('../lib/utility');
const messages = require('../mappings/messagestring.json');
const bluebirdPromise = require('bluebird');

module.exports.sendNotification = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    // console.log(event);
    clientHandler.setClient(event.client);
    currentUserHandler.setCurrentUser(event.currentUser);
    const mongoose = require('mongoose');
    const notificationHelper = require('../helpers/notification');
    commonHelper.connectToDb(dbURI);
    akUtils.log(event.notificationId, 'event.notificationId');
    notificationHelper
      .sendNotification(event.notificationId)
      .then(result => {
        // console.log('SUCCESS');
        mongoose.disconnect();
        callback(null, 'Done!');
        context.done(null, 'Function Finished!');
      })
      .catch(reason => {
        // console.log(reason);
        mongoose.disconnect();
        callback(null, 'Done!');
        context.done(null, 'Function Finished!');
      });
  });
};

module.exports.getNotifications = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    const mongoose = require('mongoose');
    const notificationHelper = require('../helpers/notification');
    commonHelper.connectToDb(dbURI);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    return bluebirdPromise
      .all([
        notificationHelper.get(
          notificationHelper.getFilterParams(event),
          notificationHelper.getExtraParams(event)
        ),
        notificationHelper.count(notificationHelper.getFilterParams(event))
      ])
      .then(resultObj => {
        const response = akResponse.listSuccess(resultObj, messages.ATTRIBUTE_LIST);

        mongoose.disconnect();
        callback(null, response);
      })
      .catch(e => {
        // console.log(e);
        // TODO : please remove 404 from catch block as it is a valid success response. catch should only catught exceptions and return with status in range of 500
        const response = akResponse.noDataFound(messages.NO_RECORDS, messages.NO_RECORDS);
        mongoose.disconnect();
        callback(null, response);
      });
  });
};

module.exports.archiveNotifications = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    const mongoose = require('mongoose');
    const notificationHelper = require('../helpers/notification');
    commonHelper.connectToDb(dbURI);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    // console.log(event.body);
    // console.log('event.body');
    return notificationHelper
      .archive(event.body)
      .then(() => {
        const response = akResponse.success([], 'Archived', 'Success');
        mongoose.disconnect();
        callback(null, response);
      })
      .catch(e => {
        // console.log(e);
        const response = akResponse.somethingWentWrong([]);
        mongoose.disconnect();
        callback(null, response);
      });
  });
};

module.exports.testNotification = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    const mongoose = require('mongoose');
    const notificationLib = require('../lib/notification');
    commonHelper.connectToDb(dbURI);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    return notificationLib
      .sendTestNotification(event.pathParameters.devicecode)
      .then(() => {
        const response = akResponse.accepted('Accepted', 'Request Accepted.', {});
        mongoose.disconnect();
        callback(null, response);
      })
      .catch(e => {
        // console.log(e);
        const response = akResponse.somethingWentWrong({});
        mongoose.disconnect();
        callback(null, response);
      });
  });
};
