const commonHelper = require('../helpers/common');
const bluebirdPromise = require('bluebird');
const messages = require('../mappings/messagestring.json');
const mongoose = require('mongoose');
const auditTrailHelper = require('../helpers/auditTrail');
const akResponse = require('../lib/respones');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');
/**
 * Get auditTrail List
 *  
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getAuditTrails = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));

    commonHelper.connectToDb(dbURI);

    // const req = commonHelper.lambdaEventToBodyParserReq(event);
    bluebirdPromise
      .all([
        auditTrailHelper.get(
          auditTrailHelper.getFilterParams(parsedEvent),
          auditTrailHelper.getExtraParams(parsedEvent)
        ),
        auditTrailHelper.count(auditTrailHelper.getFilterParams(parsedEvent))
      ])
      .then(resultObj => {
        const response = akResponse.listSuccess(resultObj, messages.AUDIT_LIST_SUCCESS);

        mongoose.disconnect();
        callback(null, response);
      })
      .catch(() => {
        // TODO : please remove 404 from catch block as it is a valid success response. catch should only catught exceptions and return with status in range of 500
        const response = akResponse.noDataFound(messages.NO_RECORDS, messages.NO_RECORDS);

        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Get Single auditTrail for specified ID
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getAuditTrailById = (event, context, callback) => {
  // // console.log(event);
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));
    commonHelper.connectToDb(dbURI);

    auditTrailHelper
      .getById(parsedEvent.pathParameters.id)
      .then(result => {
        const response = akResponse.success(result, messages.AUDIT_FETCH_SUCCESS, messages.OK);

        mongoose.disconnect();
        callback(null, response);
      })
      .catch(() => {
        // TODO : please remove 404 from catch block as it is a valid success response. catch should only catught exceptions and return with status in range of 500
        const response = akResponse.noDataFound(messages.NO_RECORDS, messages.NO_RECORDS);

        mongoose.disconnect();
        callback(null, response);
      });
  });
};
