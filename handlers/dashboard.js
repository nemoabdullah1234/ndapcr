/* const userWidgetsData = require('../models/dummy/userwidgets.json'); */
const availableWidgetsData = require('../models/dummy/adddashwidget.json');
const commonHelper = require('../helpers/common');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');
const messages = require('../mappings/messagestring.json');
const mongoose = require('mongoose');
const akResponse = require('../lib/respones');
const gadgetHelper = require('../helpers/gadgets');
const akUtils = require('../lib/utility');

module.exports.availableGadgets = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));

    commonHelper.connectToDb(dbURI);
    gadgetHelper
      .getAvailableGadgets()
      .then(result => {
        const response = akResponse.success(result, 'User Gadgets', 'Success');
        mongoose.disconnect();
        callback(null, response);
      })
      .catch(e => {
        akUtils.log(e.errors.gadgets.reason, 'updateUserGadgetPositions - somethingWentWrong');
        // TODO : please remove 301 from catch block as it is a not valid success response. catch should only catught exceptions and return with status in range of 500
        const response = akResponse.somethingWentWrong({});
        mongoose.disconnect();
        callback(null, response);
      });
  });
};

module.exports.getUserGadgetPositions = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));

    commonHelper.connectToDb(dbURI);
    gadgetHelper
      .getCurrentUserGadgetPositioning()
      .then(result => {
        const response = akResponse.success(result, 'User Gadgets', 'Success');
        mongoose.disconnect();
        callback(null, response);
      })
      .catch(e => {
        akUtils.log(e, 'updateUserGadgetPositions - somethingWentWrong');
        // TODO : please remove 301 from catch block as it is a not valid success response. catch should only catught exceptions and return with status in range of 500
        const response = akResponse.somethingWentWrong({});
        mongoose.disconnect();
        callback(null, response);
      });
  });
};

module.exports.updateUserGadgetPositions = (event, context, callback) => {
  commonHelper
    .decryptDbURI()
    .then(dbURI => {
      const parsedEvent = commonHelper.parseLambdaEvent(event);
      clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
      currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));

      commonHelper.connectToDb(dbURI);
      gadgetHelper.validateUpdate(parsedEvent).then(() =>
        gadgetHelper
          .saveCurrentUserGadgetPosition(event)
          .then(gadgetHelper.getCurrentUserGadgetPositioning())
          .then(result => {
            const response = akResponse.created(result, 'User Gadgets', 'Success');
            mongoose.disconnect();
            callback(null, response);
          })
          .catch(e => {
            akUtils.log(e, 'updateUserGadgetPositions - somethingWentWrong');
            // TODO : please remove 301 from catch block as it is a not valid success response. catch should only catught exceptions and return with status in range of 500
            const response = akResponse.somethingWentWrong({});
            mongoose.disconnect();
            callback(null, response);
          })
      );
    })
    .catch(errors => {
      akUtils.log(errors, 'updateUserGadgetPositions - validationFailed');
      // TODO : please remove 422 from catch block as it is a not valid success response. catch should only catught exceptions and return with status in range of 500
      const response = akResponse.validationFailed(
        errors,
        messages.VALIDATION_ERRORS_OCCOURED,
        messages.VALIDATION_ERROR
      );

      mongoose.disconnect();
      callback(null, response);
    });
};
