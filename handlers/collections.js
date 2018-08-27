const commonHelper = require('../helpers/common');
const bluebirdPromise = require('bluebird');
const messages = require('../mappings/messagestring.json');
const collectionHelper = require('../helpers/collection');
const mongoose = require('mongoose');
const akResponse = require('../lib/respones');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');
/**
 * Save a collection.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.saveCollection = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));

    commonHelper.connectToDb(dbURI);

    collectionHelper
      .validateRequest(parsedEvent)
      .then(() =>
        collectionHelper
          .save(parsedEvent)
          .then(result => collectionHelper.getById(result.id))
          .then(result => {
            const response = akResponse.created(
              result,
              messages.COLLECTION_SAVE_SUCCESS,
              messages.OK
            );

            mongoose.disconnect();
            callback(null, response);
          })
          .catch(() => {
            // TODO : please remove 400 from catch block as it is a not valid response it will be send if Json format is not valid. catch should only catught exceptions and return with status in range of 500
            const response = akResponse.badRequest(
              messages.COLLECTION_CREATE_FAIL,
              messages.COLLECTION_CREATE_FAIL
            );

            mongoose.disconnect();
            callback(null, response);
          })
      )
      .catch(errors => {
        // TODO : please remove 422 from catch block as it is a not valid success response. catch should only catught exceptions and return with status in range of 500
        const response = akResponse.validationFailed(
          errors,
          messages.VALIDATION_ERRORS_OCCOURED,
          messages.VALIDATION_ERROR
        );

        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Get collection List
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getCollections = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));
    commonHelper.connectToDb(dbURI);
    bluebirdPromise
      .all([
        collectionHelper.get(
          collectionHelper.getFilterParams(parsedEvent),
          collectionHelper.getExtraParams(parsedEvent)
        ),
        collectionHelper.count(collectionHelper.getFilterParams(parsedEvent))
      ])
      .then(resultObj => {
        const response = akResponse.listSuccess(resultObj, messages.COLLECTION_LIST);

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
 * Get Single collection for specified ID
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getCollectionById = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));
    commonHelper.connectToDb(dbURI);
    collectionHelper
      .getById(parsedEvent.pathParameters.id)
      .then(result => {
        const response = akResponse.success(result, messages.COLLECTION_FETCH_SUCCESS, messages.OK);

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
 * Update a collection.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.updateCollection = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));

    commonHelper.connectToDb(dbURI);
    collectionHelper
      .validateUpdate(parsedEvent)
      .then(() => {
        collectionHelper
          .update(parsedEvent)
          .then(() => collectionHelper.getById(parsedEvent.pathParameters.id))
          .then(result => {
            const response = akResponse.success(
              result,
              messages.COLLECTION_UPDATE_SUCCESS,
              messages.OK
            );

            mongoose.disconnect();
            callback(null, response);
          })
          .catch(() => {
            // TODO : please remove 301 from catch block as it is a not valid success response. catch should only catught exceptions and return with status in range of 500
            const response = akResponse.notModified(
              messages.COLLECTION_UPDATE_FAIL,
              messages.COLLECTION_UPDATE_FAIL
            );
            mongoose.disconnect();
            callback(null, response);
          });
      })
      .catch(errors => {
        // TODO : please remove 422 from catch block as it is a not valid success response. catch should only catught exceptions and return with status in range of 500
        const response = akResponse.validationFailed(
          errors,
          messages.VALIDATION_ERRORS_OCCOURED,
          messages.VALIDATION_ERROR
        );

        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Get items of a specific collection by it's code.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getCollectionItems = (event, context, callback) => {
  const parsedEvent = commonHelper.parseLambdaEvent(event);
  clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
  currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));
  commonHelper.decryptDbURI().then(dbURI => {
    commonHelper.connectToDb(dbURI);
    collectionHelper
      .getItemByCode(parsedEvent)
      .then(result => {
        const response = akResponse.success(result, messages.COLLECTION_FETCH_SUCCESS, messages.OK);

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
