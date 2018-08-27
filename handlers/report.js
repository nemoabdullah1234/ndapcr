/* jshint esversion: 6 */

const commonHelper = require('../helpers/common');
const bluebirdPromise = require('bluebird');
const messages = require('../mappings/messagestring.json');
const reportHelper = require('../helpers/report');
const akUtils = require('../lib/utility');
const deepTrim = require('deep-trim');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');

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
 * Get report List
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getGraphReport = (event, context, callback) => {
  commonHelper
    .decryptDbURI()
    .then(dbURI => {
      event = commonHelper.parseLambdaEvent(event);
      clientHandler.setClient(clientHandler.getClientObject(event));
      currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
      const mongoose = require('mongoose');
      commonHelper.connectToDb(dbURI);

      bluebirdPromise
        .all([reportHelper.get(event)])
        .then(resultObj => {
          const response = this.successResponse(resultObj);
          mongoose.disconnect();
          callback(null, response);
        })
        .catch(error => {
          // console.log(error);
          const response = this.nodataResponse();
          mongoose.disconnect();
          callback(null, response);
        });
    })
    .catch(err => {
      // console.log(`KMS Error DbURI${err}`);
      const response = {
        statusCode: 403,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          code: 403,
          message: messages.NOT_AUTHORIZED
        })
      };
      callback(null, response);
    });
};

/**
 * Get orders by hospital
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.ordersPerHospital = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    reportHelper
      .ordersPerHospital(event)
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
 * Get orders by hospital
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.ordersBySurgery = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    reportHelper
      .ordersBySurgery(event)
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
 * Get orders by hospital
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.ordersNotClosed = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    reportHelper
      .ordersNotClosed(event)
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
 * Get orders by hospital
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.casesWithUnshippedProducts = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    reportHelper
      .casesWithUnshippedProducts(event)
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
 * Get orders by hospital
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.undeliveredProducts = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    reportHelper
      .undeliveredProducts(event)
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
 * Get orders by hospital
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.orderspersurgeon = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    reportHelper
      .orderspersurgeon(event)
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
 * Get orders by hospital
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.shipmentDue = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    reportHelper
      .shipmentDue(event)
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
 * Get orders by hospital
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.ordersPerCity = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    reportHelper
      .ordersPerCity(event)
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
 * Get orders by hospital
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.shipmentDeliveryTime = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    reportHelper
      .shipmentDeliveryTime(event)
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
 * Get orders by hospital
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.locationToZoneMapping = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    reportHelper
      .locationToZoneMapping(event)
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
 * Get orders by hospital
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.carrierWiseDelayedShipments = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    reportHelper
      .carrierWiseDelayedShipments(event)
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
 * Get orders by hospital
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.shipmentHardDelivered = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    reportHelper
      .shipmentHardDelivered(event)
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
 * Get orders by hospital
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.shipmentsInJeopardy = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    reportHelper
      .shipmentInJeopardy(event)
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
 * Get orders by hospital
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.mostUsedProductsPerSurgeon = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    reportHelper
      .mostUsedProductsPerSurgeon(event)
      .then(resultObj => {
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
 * Get orders by hospital
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.partialShipments = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    reportHelper
      .partialShipments(event)
      .then(resultObj => {
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
 * Get orders by hospital
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.salesrepWiseProductOrder = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    reportHelper
      .salesrepWiseProductOrder(event)
      .then(resultObj => {
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
 * Get orders by hospital
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.stationaryShipments = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    reportHelper
      .stationaryShipments(event)
      .then(resultObj => {
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
 * Get orders by hospital
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.internalExternalShipment = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    reportHelper
      .internalExternalShipment(event)
      .then(resultObj => {
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
module.exports.sensorConnectionStatus = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    reportHelper
      .sensorConnectionStatus(event)
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
module.exports.appStatus = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    reportHelper
      .appStatus(event)
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
module.exports.productsToDispatch = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    reportHelper
      .productsReadyToDispatch(event)
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
module.exports.productThingMapping = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    reportHelper
      .productThingMapping(event)
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
module.exports.productThingMappingHistory = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    reportHelper
      .productThingMappingHistory(event)
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
 * Get login history 
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.loginHistory = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    reportHelper
      .loginHistory(event)
      .then(resultObj => {
        // console.log(resultObj);
        const response = this.successResponse(resultObj);

        mongoose.disconnect();

        callback(null, response);
      })
      .catch(err => {
        console.log(err);

        const response = this.nodataResponse();

        mongoose.disconnect();
        callback(null, response);
      });
  });
};
