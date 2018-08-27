const commonHelper = require('../helpers/common');
const bluebirdPromise = require('bluebird');
const mongoose = require('mongoose');
const configHelper = require('../helpers/configuration');
const akResponse = require('../lib/respones');
const messages = require('../mappings/messagestring.json');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');
/**
 * Get configuration List
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getConfigurations = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));

    commonHelper.connectToDb(dbURI);

    bluebirdPromise
      .all([
        configHelper.get(
          configHelper.getFilterParams(parsedEvent),
          configHelper.getExtraParams(parsedEvent)
        ),
        configHelper.count(configHelper.getFilterParams(parsedEvent))
      ])
      .then(resultObj => {
        const response = akResponse.listSuccess(resultObj, 'Configuration List');

        mongoose.disconnect();
        callback(null, response);
      })
      .catch(() => {
        // TODO : please remove 404 from catch block as it is a valid success response. catch should only catught exceptions and return with status in range of 500
        const response = akResponse.noDataFound(messages.NO_RECORDS, messages.NO_RECORDS);
        callback(null, response);
      });
  });
};

/**
 * Get Single configuration for specified ID
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getConfigurationById = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));

    commonHelper.connectToDb(dbURI);
    configHelper
      .getById(parsedEvent.pathParameters.id)
      .then(result => {
        const response = akResponse.success(
          result,
          'configuration fetched successfully',
          messages.OK
        );

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
 * Update an configuration.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.updateConfiguration = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));
    commonHelper.connectToDb(dbURI);
    configHelper
      .validateRequest(parsedEvent)
      .then(populatedTags => {
        parsedEvent.body.tags = populatedTags.body.tags;
        configHelper
          .update(parsedEvent)
          .then(result => configHelper.getById(result._id))
          .then(result => {
            const response = akResponse.success(
              result,
              'configuration updated successfully',
              messages.OK
            );

            mongoose.disconnect();
            callback(null, response);
          })
          .catch(() => {
            // TODO : please remove 301 from catch block as it is a not valid success response. catch should only catught exceptions and return with status in range of 500
            const response = akResponse.notModified(
              messages.ATTRIBUTE_UPDATE_FAIL,
              messages.ATTRIBUTE_UPDATE_FAIL
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
 * Save an configuration.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.saveConfiguration = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));

    commonHelper.connectToDb(dbURI);
    configHelper
      .validateRequest(parsedEvent)
      .then(populatedTags => {
        parsedEvent.body.tags = populatedTags.body.tags;
        configHelper
          .save(parsedEvent)
          .then(result => configHelper.getById(result._id, true))
          .then(result => {
            const response = akResponse.created(
              result,
              'configuration saved successfully',
              messages.OK
            );

            mongoose.disconnect();
            callback(null, response);
          })
          .catch(() => {
            // TODO : please remove 400 from catch block as it is a not valid response it will be send if Json format is not valid. catch should only catught exceptions and return with status in range of 500
            const response = akResponse.badRequest(
              'configuration create failed',
              'configuration create failed'
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

module.exports.valErrors = (event, context, callback) => {
  const response = {
    statusCode: 422,
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      code: 422,
      message: 'ValidationErrors',
      description: 'Validation Errors Occured',
      data: [
        {
          message: 'Code is mandatory',
          code: 'required',
          field: 'code'
        },
        {
          message: 'Name is mandatory',
          code: 'required',
          field: 'name'
        }
      ]
    })
  };
  callback(null, response);
};
