const commonHelper = require('../helpers/common');
const bluebirdPromise = require('bluebird');
const messages = require('../mappings/messagestring.json');
const mongoose = require('mongoose');
const productTrackingHelper = require('../helpers/trackingreports/productTracking');
const rawSensorsTrackingHelper = require('../helpers/trackingreports/rawSensorsTracking');
const pointStatusHelper = require('../helpers/trackingreports/pointStatusTracking');
const mobileLogsHelper = require('../helpers/trackingreports/mobileLogs');
const rawLocationHelper = require('../helpers/trackingreports/rawLocationTracking');

const trackingEntranceHelper = require('../helpers/trackingreports/trackingEntrance');
const productLocatorHelper = require('../helpers/trackingreports/productLocator');
const deviceLocatorHelper = require('../helpers/trackingreports/deviceLocator');
const userLocatorHelper = require('../helpers/trackingreports/userLocator');
const shipmentLocatorHelper = require('../helpers/trackingreports/shipmentLocator');
const sensorLocatorHelper = require('../helpers/trackingreports/sensorLocator');
const deepTrim = require('deep-trim');
const akUtils = require('../lib/utility');
const akResponse = require('../lib/respones');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');
const userEntranceHelper = require('../helpers/trackingreports/userEntrance');

module.exports.successResponse = data => ({
  statusCode: 200,
  headers: {
    'Access-Control-Allow-Origin': '*'
  },
  body: JSON.stringify(
    deepTrim(
      akUtils.cleanFormatReportResponse({
        code: 200,
        message: 'Success',
        description: messages.COLLECTION_LIST,
        totalRecords: data[1],
        recordsCount: data[0].length,
        data: data[0]
      })
    )
  )
});

module.exports.nodataResponse = () => ({
  statusCode: 404,
  headers: {
    'Access-Control-Allow-Origin': '*'
  },
  body: JSON.stringify({
    code: 404,
    message: messages.NO_RECORDS,
    description: messages.NO_RECORDS,
    data: []
  })
});

/**
 * Get product tracking List
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.productTracking = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(parsedEvent));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(parsedEvent));

    commonHelper.connectToDb(dbURI);

    bluebirdPromise
      .all([
        productTrackingHelper.get(
          productTrackingHelper.getFilterParams(parsedEvent),
          productTrackingHelper.getExtraParams(parsedEvent)
        ),
        productTrackingHelper.count(productTrackingHelper.getFilterParams(parsedEvent))
      ])
      .then(resultObj => {
        const response = akResponse.listSuccess(resultObj, messages.DIAGN_PRODUCT_TRACKING_LIST);

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
 * Get point thing tracking List
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.rawSensorsTracking = (event, context, callback) => {
  commonHelper.decryptTrackingDbURI().then(trackingDbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    commonHelper.connectToDb(trackingDbURI);

    bluebirdPromise
      .all([
        rawSensorsTrackingHelper.get(
          rawSensorsTrackingHelper.getFilterParams(parsedEvent),
          rawSensorsTrackingHelper.getExtraParams(parsedEvent)
        ),
        rawSensorsTrackingHelper.count(rawSensorsTrackingHelper.getFilterParams(parsedEvent))
      ])
      .then(resultObj => {
        const response = akResponse.listSuccess(
          resultObj,
          messages.DIAGN_POINTSENSOR_TRACKING_LIST
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
 * Get point location tracking List
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.pointStatusTracking = (event, context, callback) => {
  commonHelper.decryptTrackingDbURI().then(trackingDbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    // commonHelper.setClientAndUpdatedBy(commonHelper.getClientObject(event), commonHelper.getActionSourceUser(event));

    commonHelper.connectToDb(trackingDbURI);

    bluebirdPromise
      .all([
        pointStatusHelper.get(
          pointStatusHelper.getFilterParams(parsedEvent),
          pointStatusHelper.getExtraParams(parsedEvent)
        ),
        pointStatusHelper.count(pointStatusHelper.getFilterParams(parsedEvent))
      ])
      .then(resultObj => {
        const response = akResponse.listSuccess(
          resultObj,
          messages.DIAGN_POINTSENSOR_TRACKING_LIST
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
 * Get mobile logs List
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.mobileLogs = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    // commonHelper.setClientAndUpdatedBy(commonHelper.getClientObject(event), commonHelper.getActionSourceUser(event));
    commonHelper.connectToDb(dbURI);

    bluebirdPromise
      .all([
        mobileLogsHelper.get(
          mobileLogsHelper.getFilterParams(parsedEvent),
          mobileLogsHelper.getExtraParams(parsedEvent)
        ),
        mobileLogsHelper.count(mobileLogsHelper.getFilterParams(parsedEvent))
      ])
      .then(resultObj => {
        const response = akResponse.listSuccess(
          resultObj,
          messages.DIAGN_POINTSENSOR_TRACKING_LIST
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
 * Get raw location tracking List
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.rawLocationTracking = (event, context, callback) => {
  commonHelper.decryptTrackingDbURI().then(trackingDbURI => {
    const parsedEvent = commonHelper.parseLambdaEvent(event);
    // commonHelper.setClientAndUpdatedBy(commonHelper.getClientObject(event), commonHelper.getActionSourceUser(event));

    commonHelper.connectToDb(trackingDbURI);
    // const req = commonHelper.lambdaEventToBodyParserReq(event);

    bluebirdPromise
      .all([
        rawLocationHelper.get(
          rawLocationHelper.getFilterParams(parsedEvent),
          rawLocationHelper.getExtraParams(parsedEvent)
        ),
        rawLocationHelper.count(rawLocationHelper.getFilterParams(parsedEvent))
      ])
      .then(resultObj => {
        const response = akResponse.listSuccess(
          resultObj,
          messages.DIAGN_POINTSENSOR_TRACKING_LIST
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
 * Get sensor locator
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.sensorLocator = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    sensorLocatorHelper
      .sensorLocator(event)
      .then(resultObj => {
        // // console.log(resultObj);
        const response = this.successResponse(resultObj);

        mongoose.disconnect();

        callback(null, response);
      })
      .catch(err => {
        // console.log(err);

        const response = this.nodataResponse();

        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Get sensor locator history
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.sensorLocatorHistory = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    sensorLocatorHelper
      .sensorLocatorHistory(event)
      .then(resultObj => {
        // // console.log(resultObj);
        const response = this.successResponse(resultObj);

        mongoose.disconnect();

        callback(null, response);
      })
      .catch(err => {
        // console.log(err);

        const response = this.nodataResponse();

        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Get device locator
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.deviceLocator = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    // const deviceLocatorHelper = require('../helpers/trackingreports/deviceLocator')
    // console.log(dbURI);
    deviceLocatorHelper
      .deviceLocator(event)
      .then(resultObj => {
        // console.log(resultObj);
        const response = this.successResponse(resultObj);

        mongoose.disconnect();

        callback(null, response);
      })
      .catch(err => {
        // console.log(err);

        const response = this.nodataResponse();

        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Get device locator map data
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.deviceLocatorMap = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    deviceLocatorHelper
      .deviceLocatorMap(event)
      .then(resultObj => {
        // // console.log(resultObj);
        const response = this.successResponse(resultObj);

        mongoose.disconnect();

        callback(null, response);
      })
      .catch(err => {
        // console.log(err);

        const response = this.nodataResponse();

        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Get device locator history
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.deviceLocatorHistory = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    deviceLocatorHelper
      .deviceLocatorHistory(event)
      .then(resultObj => {
        // // console.log(resultObj);
        const response = this.successResponse(resultObj);

        mongoose.disconnect();

        callback(null, response);
      })
      .catch(err => {
        // console.log(err);

        const response = this.nodataResponse();

        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Get device locator history map data
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.deviceLocatorHistoryMap = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    deviceLocatorHelper
      .deviceLocatorHistoryMap(event)
      .then(resultObj => {
        // // console.log(resultObj);
        const response = this.successResponse(resultObj);

        mongoose.disconnect();

        callback(null, response);
      })
      .catch(err => {
        // console.log(err);

        const response = this.nodataResponse();

        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Get device locator
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.userLocator = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    userLocatorHelper
      .userLocator(event)
      .then(resultObj => {
        // // console.log(resultObj);
        const response = this.successResponse(resultObj);

        mongoose.disconnect();

        callback(null, response);
      })
      .catch(err => {
        // console.log(err);

        const response = this.nodataResponse();

        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Get device locator map data
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.userLocatorMap = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    userLocatorHelper
      .userLocatorMap(event)
      .then(resultObj => {
        // // console.log(resultObj);
        const response = this.successResponse(resultObj);

        mongoose.disconnect();

        callback(null, response);
      })
      .catch(err => {
        // console.log(err);

        const response = this.nodataResponse();

        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Get device locator history
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.userLocatorHistory = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    userLocatorHelper
      .userLocatorHistory(event)
      .then(resultObj => {
        // // console.log(resultObj);
        const response = this.successResponse(resultObj);

        mongoose.disconnect();

        callback(null, response);
      })
      .catch(err => {
        // console.log(err);

        const response = this.nodataResponse();

        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Get device locator history map data
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.userLocatorHistoryMap = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    userLocatorHelper
      .userLocatorHistoryMap(event)
      .then(resultObj => {
        // // console.log(resultObj);
        const response = this.successResponse(resultObj);

        mongoose.disconnect();

        callback(null, response);
      })
      .catch(err => {
        // console.log(err);

        const response = this.nodataResponse();

        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Get shipment locator map data
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.shipmentLocatorMap = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    shipmentLocatorHelper
      .shipmentLocatorMap(event)
      .then(resultObj => {
        // // console.log(resultObj);
        const response = this.successResponse(resultObj);

        mongoose.disconnect();

        callback(null, response);
      })
      .catch(err => {
        // console.log(err);

        const response = this.nodataResponse();

        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Get product locator
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.productLocator = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    productLocatorHelper
      .productLocator(event)
      .then(resultObj => {
        // // console.log(resultObj);
        const response = this.successResponse(resultObj);

        mongoose.disconnect();

        callback(null, response);
      })
      .catch(err => {
        // console.log(err);

        const response = this.nodataResponse();

        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Get product locator map data
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.productLocatorMap = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    productLocatorHelper
      .productLocatorMap(event)
      .then(resultObj => {
        // // console.log(resultObj);
        const response = this.successResponse(resultObj);

        mongoose.disconnect();

        callback(null, response);
      })
      .catch(err => {
        // console.log(err);

        const response = this.nodataResponse();

        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Get product locator history
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.productLocatorHistory = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    productLocatorHelper
      .productLocatorHistory(event)
      .then(resultObj => {
        // // console.log(resultObj);
        const response = this.successResponse(resultObj);

        mongoose.disconnect();

        callback(null, response);
      })
      .catch(err => {
        // console.log(err);

        const response = this.nodataResponse();

        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Get product locator history map data
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.productLocatorHistoryMap = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    productLocatorHelper
      .productLocatorHistoryMap(event)
      .then(resultObj => {
        // // console.log(resultObj);
        const response = this.successResponse(resultObj);

        mongoose.disconnect();

        callback(null, response);
      })
      .catch(err => {
        // console.log(err);

        const response = this.nodataResponse();

        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Get product locator history map data
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.sensorEntraceTracking = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    trackingEntranceHelper
      .sensorEntrance(event)
      .then(resultObj => {
        // // console.log(resultObj);
        const response = this.successResponse(resultObj);

        mongoose.disconnect();

        callback(null, response);
      })
      .catch(err => {
        // console.log(err);

        const response = this.nodataResponse();

        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Get User Entrace Tracking
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.userEntraceTracking = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    userEntranceHelper
      .userEntrance(event)
      .then(resultObj => {
        // // console.log(resultObj);
        const response = this.successResponse(resultObj);

        mongoose.disconnect();

        callback(null, response);
      })
      .catch(err => {
        // console.log(err);

        const response = this.nodataResponse();

        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Get shipment locator history map data
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */

module.exports.shipmentLocatorHistoryMap = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    const self = this;

    // const shipmentOrchestrationHelper = require('../helpers/shipmentOrchestration');
    // shipmentOrchestrationHelper.get(
    //   event.pathParameters.id,
    //   {},
    //   shipmentOrchestrationHelper.getExtraParams(event)
    // )
    // .then(orchestrationResultObj => {
    shipmentLocatorHelper
      .shipmentLocatorHistoryMap(event, {})
      .then(resultObj => {
        const response = self.successResponse(resultObj);
        mongoose.disconnect();
        callback(null, response);
      })
      .catch(err => {
        // console.log(err);
        const response = self.nodataResponse();
        mongoose.disconnect();
        callback(null, response);
      });
  });

  // })
  // .catch(err => {
  //   // console.log(err);
  //   const response = this.nodataResponse();
  //   mongoose.disconnect();
  //   callback(null, response);
  // });
};
