const exportClass = require('../helpers/export');
const commonHelper = require('../helpers/common');
const bluebirdPromise = require('bluebird');
const messages = require('../mappings/messagestring.json');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');
const akResponse = require('../lib/respones');
const akUtils = require('../lib/utility');

module.exports.handleRequest = (event, context, callback) => {
  const allowedExports = ['csv'];
  const exportEntities = require('../lib/exportDataFetcher');
  let response;
  event = commonHelper.parseLambdaEvent(event);
  event.body.queryParams = event.body.queryParams || {};
  event.body.pathParams = event.body.pathParams || {};
  clientHandler.setClient(clientHandler.getClientObject(event));
  currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
  // if (process.env.IS_OFFLINE) {
  //   const currentUser = currentUserHandler.getCurrentUser();
  //   currentUser.email = 'ayush.gupta@akwa.io';
  //   currentUserHandler.setCurrentUser(currentUser);
  // }

  if (!new Set(allowedExports).has(event.pathParameters.exportFormat)) {
    response = akResponse.badRequest(
      `Export to '${event.pathParameters.exportFormat}' is not supported.`,
      `Bad Request`
    );
  } else if (!event.body.entity) {
    response = akResponse.badRequest(`No entity specified`, `Bad Request`);
  } else if (!exportEntities[event.body.entity]) {
    response = akResponse.badRequest(
      `'${event.body.entity}' export is not supported.`,
      `Bad Request`
    );
  } else if (typeof event.body.queryParams !== 'object' || Array.isArray(event.body.queryParams)) {
    response = akResponse.badRequest(`queryParams must be an object.`, `Bad Request`);
  } else if (typeof event.body.pathParams !== 'object' || Array.isArray(event.body.pathParams)) {
    response = akResponse.badRequest(`pathParams must be an object.`, `Bad Request`);
  } else if (exportEntities[event.body.entity].pathParamsMap) {
    const entityPathParams = exportEntities[event.body.entity].pathParamsMap;
    const requiredPathParams = Object.getOwnPropertyNames(
      exportEntities[event.body.entity].pathParamsMap
    );
    const missingPathParams = akUtils.getArrayDifference(
      requiredPathParams,
      Object.getOwnPropertyNames(event.body.pathParams)
    );

    if (missingPathParams.length) {
      response = akResponse.badRequest(
        `${missingPathParams.join(', ')} pathParams is/are required`,
        `Bad Request`
      );
    } else {
      for (let i = 0; i < requiredPathParams.length; i++) {
        event.body.pathParams[entityPathParams[requiredPathParams[i]]] =
          event.body.pathParams[requiredPathParams[i]];
        event.body.pathParams[requiredPathParams[i]] = undefined;
      }

      event.body.pathParams = JSON.parse(JSON.stringify(event.body.pathParams));
    }
  }
  if (response) {
    callback(null, response);
  } else {
    const exportHelper = new exportClass();
    akUtils.log(event.body);
    return exportHelper
      .initiateExport({
        entity: event.body.entity,
        format: event.pathParameters.exportFormat,
        queryParams: event.body.queryParams,
        pathParams: event.body.pathParams,
        entityDisplayName: event.body.entityDisplayName || ''
      })
      .then(() => {
        // // console.log(util.inspect(resultObj, true, null))
        response = akResponse.accepted(
          'Accepted',
          'Request Accepted. You will recieve an E-Mail when your export is complete.',
          {}
        );
      })
      .catch(e => {
        // console.log(e);
        response = akResponse.somethingWentWrong({});
      })
      .then(() => {
        callback(null, response);
      });
  }
};

module.exports.export = (event, context, callback) => {
  // console.log(event);
  commonHelper.decryptDbURI().then(dbURI => {
    clientHandler.setClient(event.client);
    currentUserHandler.setCurrentUser(event.requestedBy);
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    const exportHelper = new exportClass();

    return exportHelper
      .export({
        entity: event.entity,
        queryParams: event.queryParams,
        pathParams: event.pathParams,
        format: event.format,
        entityDisplayName: event.entityDisplayName || ''
      })
      .then(result => {
        mongoose.disconnect();
        callback(null, 'Done!');
        context.done(null, 'Function Finished!');
      })
      .catch(e => {
        // console.log(e);
        mongoose.disconnect();
        callback(null, 'Done!');
        context.done(null, 'Function Finished!');
      });
  });
};
