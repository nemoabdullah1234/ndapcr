/* jshint esversion: 6 */

// var config = require('../../../config.'+process.env.NODE_ENV);
const mongoose = require('mongoose');
const bluebirdPromise = require('bluebird');
const commonHelper = require('./common');
const clientHandler = require('../lib/clientHandler');
const akUtils = require('../lib/utility');
const orderStatusLabelMap = require('../mappings/orderStatusLabel.json');

const orderOrchestrationModel = require('../models/orderOrchestration');
const ordermodel = require('../models/order');

const orderOrchestrationService = function() {};

orderOrchestrationService.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

orderOrchestrationService.prototype.formatResponse = function(data) {
  const formattedResponse = {};
  formattedResponse.id = data._id;
  formattedResponse.orderStatus = data.orderStatus;
  formattedResponse.orderStatusLabel = akUtils.objectKeyByValue(
    orderStatusLabelMap,
    data.orderStatus
  );

  formattedResponse.actionTime = data.actionTime;
  return formattedResponse;
};

orderOrchestrationService.prototype.getFilterParams = function(event) {
  const filters = {};
  if (!event.queryStringParameters) {
    return filters;
  }
  if (event.queryStringParameters && event.queryStringParameters.filter) {
    // filters._all = event.queryStringParameters.filter;

    filters.$or = [
      { 'product.name': new RegExp(event.queryStringParameters.filter, 'i') },
      { code: new RegExp(event.queryStringParameters.filter, 'i') }
    ];
  }

  if (event.queryStringParameters.id) {
    filters._id = mongoose.Types.ObjectId(event.queryStringParameters.id);
  }
  if (event.queryStringParameters.status) {
    filters.shipmentStatus = new RegExp(event.queryStringParameters.shipmentStatus, 'i');
  }

  return filters;
};

orderOrchestrationService.prototype.getExtraParams = function(event) {
  const params = {};
  params.sort = {};
  if (!event.queryStringParameters) {
    params.pageParams = {
      offset: 0,
      limit: 20
    };
    params.sort.updatedOn = -1;
    return params;
  }
  const dd = event.queryStringParameters.dd === '1';
  const offset = event.queryStringParameters.offset ? event.queryStringParameters.offset : 0;
  const limit = event.queryStringParameters.limit ? event.queryStringParameters.limit : 20;
  params.isDropdown = dd;
  params.pageParams = {
    offset: dd ? 0 : parseInt(offset, 10),
    limit: dd ? 65535 : parseInt(limit, 10)
  };
  if (event.queryStringParameters.sort) {
    const sortQuery = event.queryStringParameters.sort;
    const sortColumns = sortQuery.split(',');
    sortColumns.forEach(function(col) {
      // let sortOrder = 1;
      col = col.trim();
      const isValidColumn = this.getColumnMap(col) || this.getColumnMap(col.replace('-', ''));
      if (isValidColumn) {
        let sortOrder;
        if (col.startsWith('-')) {
          sortOrder = -1;
          col = col.replace('-', '');
        }

        col = this.getColumnMap(col);
        params.sort[col] = sortOrder;
      }
    }, this);
  } else {
    params.sort.actionTime = 1;
  }

  return params;
};

/**
 * Save an order
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of save operation.
 * 
 */
orderOrchestrationService.prototype.save = function save(orderOrchestrationData) {
  return orderOrchestrationModel
    .findOne({ orderId: orderOrchestrationData.orderId })
    .sort({ _id: -1 })
    .exec()
    .then(orderOrchestrationExObj => {
      if (
        !(
          orderOrchestrationExObj !== null &&
          orderOrchestrationExObj.orderStatus === orderOrchestrationData.orderStatus
        )
      ) {
        const orderOrchestrationObj = new orderOrchestrationModel(); // create a new instance of the  model
        orderOrchestrationObj.orderId = orderOrchestrationData.orderId;
        orderOrchestrationObj.orderStatus = orderOrchestrationData.orderStatus;
        orderOrchestrationObj.actionTime = orderOrchestrationData.actionTime;
        orderOrchestrationObj.done = orderOrchestrationData.done;
        orderOrchestrationObj.client = clientHandler.getClient();

        // return bluebirdPromise.resolve(orderObj);
        return orderOrchestrationObj.save().then(
          result => bluebirdPromise.resolve(result)
          // // update order orderStatusUpdatedOn field
          // let condition = {
          //   '_id': orderOrchestrationData.orderId
          // };
          // condition = clientHandler.addClientFilterToConditions(condition);
          // return ordermodel.findOne(condition).then((orderObj) => {
          //   if (orderObj === null) {
          //     return bluebirdPromise.resolve(result);
          //   }
          //   let obj = {
          //     'orderStatusUpdatedOn': orderOrchestrationData.actionTime
          //   };
          //   orderObj.orderStatusUpdatedOn = orderOrchestrationData.actionTime;
          //   return ordermodel.findOneAndUpdate(condition, obj);
          //   // return orderObj.save();
          // }).then((orderObj) => {
          //   return bluebirdPromise.resolve(result);
          // });
        );
      }
      return bluebirdPromise.resolve({});
    });
};

/**
 * Update an order orchestration
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of save operation.
 * 
 */
orderOrchestrationService.prototype.update = function(orderOrchestrationData) {
  return orderOrchestrationModel
    .findOne({
      orderId: orderOrchestrationData.orderId,
      done: 0,
      orderStatus: orderOrchestrationData.orderStatus
    })
    .exec()
    .then(orderOrchestrationObj => {
      if (orderOrchestrationObj !== null) {
        orderOrchestrationObj.actionTime = orderOrchestrationData.actionTime;
        orderOrchestrationObj.done = 1;

        // return bluebirdPromise.resolve(orderObj);
        return orderOrchestrationObj.save().then(result => {
          // update shipment shipmentStatusUpdatedOn field
          let condition = {
            _id: orderOrchestrationData.orderId
          };
          condition = clientHandler.addClientFilterToConditions(condition);
          return ordermodel
            .findOne(condition)
            .then(orderObj => {
              if (orderObj === null) {
                return bluebirdPromise.resolve(result);
              }
              orderObj.orderStatusUpdatedOn = orderOrchestrationData.actionTime;
              return orderObj.save();
            })
            .then(orderObj => bluebirdPromise.resolve(result));
        });
      }
      return bluebirdPromise.resolve({});
    });
};

orderOrchestrationService.prototype.get = function(orderId, searchParams, otherParams) {
  // console.log('IN GET');
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return bluebirdPromise.reject();
  }
  // console.log('Search Params');
  searchParams.orderId = mongoose.Types.ObjectId(orderId);
  // console.log('Search Params 1');
  searchParams.done = 1;
  searchParams = clientHandler.addClientFilterToConditions(searchParams);
  // console.log(searchParams);
  return orderOrchestrationModel
    .aggregate()
    .match(searchParams)
    .sort(otherParams.sort)
    .skip(otherParams.pageParams.offset)
    .limit(otherParams.pageParams.limit)
    .exec()
    .then(result => {
      // console.log('In Results');
      const list = [];
      if (result) {
        // console.log('Results OK');
        for (const i in result) {
          // console.log('1');
          if (result.hasOwnProperty(i)) {
            // console.log('2');
            list.push(this.formatResponse(result[i], otherParams.isDropdown));
          }
        }
      }
      // console.log('LIST ');
      // console.log(list);
      return list;
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

orderOrchestrationService.prototype.count = function(orderId, searchParams = {}) {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return bluebirdPromise.reject();
  }
  searchParams.done = 1;
  searchParams.orderId = mongoose.Types.ObjectId(orderId);
  return orderOrchestrationModel
    .aggregate()
    .match(searchParams)
    .exec()
    .then(result => result.length);
};

module.exports = new orderOrchestrationService();
