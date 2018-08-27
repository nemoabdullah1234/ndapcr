const commonHelper = require('../helpers/common');
const bluebirdPromise = require('bluebird');
const messages = require('../mappings/messagestring.json');
const mongoose = require('mongoose');
const nfcTagHelper = require('../helpers/nfcTag');
const akResponse = require('../lib/respones');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');
/**
 * Get nfcTag List
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getNfcTags = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));

    commonHelper.connectToDb(dbURI);

    bluebirdPromise
      .all([
        nfcTagHelper.get(
          nfcTagHelper.getFilterParams(parsedEvent),
          nfcTagHelper.getExtraParams(parsedEvent)
        ),
        nfcTagHelper.count(nfcTagHelper.getFilterParams(parsedEvent))
      ])
      .then(resultObj => {
        const response = akResponse.listSuccess(resultObj, messages.DEVICE_LIST);
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
 * Get Single nfcTag for specified ID
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getNfcTagbyId = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));

    commonHelper.connectToDb(dbURI);
    nfcTagHelper
      .getById(parsedEvent.pathParameters.id)
      .then(result => {
        const response = akResponse.success(result, messages.DEVICE_FETCH_SUCCESS, messages.OK);

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
 * Update a nfcTag.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.updateNfcTag = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));
    commonHelper.connectToDb(dbURI);

    nfcTagHelper
      .validateUpdate(parsedEvent)
      .then(populatedEvent => {
        nfcTagHelper
          .update(populatedEvent)
          .then(result => {
            const response = akResponse.success(
              result,
              messages.DEVICE_UPDATE_SUCCESS,
              messages.OK
            );

            mongoose.disconnect();
            callback(null, response);
          })
          .catch(() => {
            // TODO : please remove 301 from catch block as it is a not valid success response. catch should only catught exceptions and return with status in range of 500
            const response = akResponse.notModified(
              messages.DEVICE_UPDATE_FAIL,
              messages.DEVICE_UPDATE_FAIL
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
 * Save a nfcTag.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.saveNfcTag = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));
    commonHelper.connectToDb(dbURI);
    nfcTagHelper
      .validateRequest(parsedEvent)
      .then(populatedEvent => {
        nfcTagHelper
          .save(populatedEvent)
          .then(result => nfcTagHelper.getById(result._id))
          .then(result => {
            const response = akResponse.created(result, messages.DEVICE_SAVE_SUCCESS, messages.OK);

            mongoose.disconnect();
            callback(null, response);
          })
          .catch(() => {
            // TODO : please remove 404 from catch block as it is a valid success response. catch should only catught exceptions and return with status in range of 500
            const response = akResponse.noDataFound(messages.NO_RECORDS, messages.NO_RECORDS);
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
    // });
  });
};

/**
 * Save a nfcTag.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.updateNfcTagStatus = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));
    commonHelper.connectToDb(dbURI);
    nfcTagHelper
      .validateStatusChange(parsedEvent)
      .then(() => nfcTagHelper.createStatusChangeRequest(parsedEvent))
      .then(populatedEvent =>
        nfcTagHelper
          .save(populatedEvent)
          .then(result => nfcTagHelper.getById(result._id))
          .then(() => {
            const response = {
              statusCode: 200,
              headers: {
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                code: 0,
                status: 1,
                message: 'Ok',
                data: {
                  ReaderSaveNfcTagOnlineStatusResponse: {}
                }
              })
            };
            mongoose.disconnect();
            callback(null, response);
          })
          .catch(() => {
            // TODO : please remove 400 from catch block as it is a not valid response it will be send if Json format is not valid. catch should only catught exceptions and return with status in range of 500
            const response = akResponse.badRequest(
              messages.ATTRIBUTE_CREATE_FAIL,
              messages.ATTRIBUTE_CREATE_FAIL
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
    // });
  });
};

/**
 * Save a nfcTag.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.link = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));
    commonHelper.connectToDb(dbURI);
    nfcTagHelper.link(parsedEvent).then(() => {
      const response = {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          code: 200,
          status: 1,
          message: 'Ok',
          data: {
            status: true
          }
        })
      };
      mongoose.disconnect();
      callback(null, response);
    });
    // });
  });
};

/**
 * Save a nfcTag.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.unlink = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));
    commonHelper.connectToDb(dbURI);
    nfcTagHelper.unlink(parsedEvent).then(() => {
      const response = {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          code: 200,
          status: 1,
          message: 'Ok',
          data: {
            status: true
          }
        })
      };
      mongoose.disconnect();
      callback(null, response);
    });
    // });
  });
};

module.exports.getScanHistoryDataForProduct = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));
    commonHelper.connectToDb(dbURI);
    nfcTagHelper
      .getScanHistoryDataForProduct(parsedEvent.pathParameters.productId)
      .then(result => {
        const response = akResponse.success(result, 'Success', 'Success');
        mongoose.disconnect();
        callback(null, response);
      })
      .catch(e => {
        // console.log(e);
        const response = akResponse.somethingWentWrong([]);
        mongoose.disconnect();
        callback(null, response);
      });
    // });
  });
};
