/* jshint esversion: 6 */
// var config = require('../../../config.'+process.env.NODE_ENV);
const mongoose = require('mongoose');
const bluebirdPromise = require('bluebird');
const commonHelper = require('./common');

const akUtils = require('../lib/utility');
const shipmentStatusLabelMap = require('../mappings/shipmentStatusLabel.json');
const shipmentStatusMap = require('../mappings/shipmentStatus.json');

const shipmentOrchestrationModel = require('../models/shipmentOrchestration');
const shipmentmodel = require('../models/shipment');

const clientHandler = require('../lib/clientHandler');

const shipmentOrchestrationService = function() {};

shipmentOrchestrationService.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

shipmentOrchestrationService.prototype.formatResponse = function(data) {
  const formattedResponse = {};
  formattedResponse.id = data._id;
  formattedResponse.shipmentStatus = data.shipmentStatus;
  formattedResponse.shipmentStatusLabel = akUtils.objectKeyByValue(
    shipmentStatusLabelMap,
    data.shipmentStatus
  );

  formattedResponse.actionTime = data.actionTime;
  return formattedResponse;
};

shipmentOrchestrationService.prototype.getFilterParams = function(event) {
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

shipmentOrchestrationService.prototype.getExtraParams = function(event) {
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
 * Save an shipment orchestration
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of save operation.
 * 
 */
shipmentOrchestrationService.prototype.save = function save(shipmentOrchestrationData) {
  return shipmentOrchestrationModel
    .findOne({ shipmentId: shipmentOrchestrationData.shipmentId })
    .sort({ _id: -1 })
    .exec()
    .then(shipmentOrchestrationExObj => {
      if (
        !(
          shipmentOrchestrationExObj !== null &&
          shipmentOrchestrationExObj.shipmentStatus === shipmentOrchestrationData.shipmentStatus
        )
      ) {
        const shipmentOrchestrationObj = new shipmentOrchestrationModel(); // create a new instance of the  model
        shipmentOrchestrationObj.shipmentId = shipmentOrchestrationData.shipmentId;
        shipmentOrchestrationObj.shipmentStatus = shipmentOrchestrationData.shipmentStatus;
        shipmentOrchestrationObj.actionTime = shipmentOrchestrationData.actionTime;
        shipmentOrchestrationObj.done = shipmentOrchestrationData.done;
        shipmentOrchestrationObj.client = clientHandler.getClient();

        // return bluebirdPromise.resolve(orderObj);
        return shipmentOrchestrationObj.save().then(result => {
          // update shipment shipmentStatusUpdatedOn field
          let condition = {
            _id: shipmentOrchestrationData.orderId
          };
          condition = clientHandler.addClientFilterToConditions(condition);
          return shipmentmodel
            .findOne(condition)
            .then(shipmentObj => {
              if (shipmentObj === null) {
                return bluebirdPromise.resolve(result);
              }
              shipmentObj.shipmentStatusUpdatedOn = shipmentOrchestrationData.actionTime;
              return shipmentObj.save();
            })
            .then(shipmentObj => bluebirdPromise.resolve(result));
        });
      }
      return bluebirdPromise.resolve({});
    });
};

/**
 * Update an shipment orchestration
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of save operation.
 * 
 */
shipmentOrchestrationService.prototype.update = function(shipmentOrchestrationData) {
  return shipmentOrchestrationModel
    .findOne({
      shipmentId: shipmentOrchestrationData.shipmentId,
      done: 0,
      shipmentStatus: shipmentOrchestrationData.shipmentStatus
    })
    .exec()
    .then(shipmentOrchestrationObj => {
      if (shipmentOrchestrationObj !== null) {
        shipmentOrchestrationObj.actionTime = shipmentOrchestrationData.actionTime;
        shipmentOrchestrationObj.done = 1;

        // return bluebirdPromise.resolve(orderObj);
        return shipmentOrchestrationObj.save().then(result => {
          // update shipment shipmentStatusUpdatedOn field
          let condition = {
            _id: mongoose.Types.ObjectId(shipmentOrchestrationData.shipmentId)
          };
          condition = clientHandler.addClientFilterToConditions(condition);
          return shipmentmodel
            .findOne(condition)
            .then(shipmentObj => {
              if (shipmentObj === null) {
                return bluebirdPromise.resolve(result);
              }
              shipmentObj.shipmentStatusUpdatedOn = shipmentOrchestrationData.actionTime;
              return shipmentObj.save();
            })
            .then(shipmentObj => bluebirdPromise.resolve(result));
        });
      }
      return bluebirdPromise.resolve({});
    });
};

shipmentOrchestrationService.prototype.get = function(shipmentId, searchParams, otherParams) {
  if (!mongoose.Types.ObjectId.isValid(shipmentId)) {
    return bluebirdPromise.reject();
  }

  searchParams.shipmentId = mongoose.Types.ObjectId(shipmentId);
  searchParams.done = 1;
  searchParams = clientHandler.addClientFilterToConditions(searchParams);

  return shipmentOrchestrationModel
    .aggregate()
    .match(searchParams)
    .sort(otherParams.sort)
    .skip(otherParams.pageParams.offset)
    .limit(otherParams.pageParams.limit)
    .exec()
    .then(result => {
      const list = [];
      if (result) {
        for (const i in result) {
          if (result.hasOwnProperty(i)) {
            list.push(this.formatResponse(result[i], otherParams.isDropdown));
          }
        }
      }
      return list;
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

shipmentOrchestrationService.prototype.count = function(shipmentId, searchParams = {}) {
  if (!mongoose.Types.ObjectId.isValid(shipmentId)) {
    return bluebirdPromise.reject();
  }
  searchParams.done = 1;
  searchParams.shipmentId = mongoose.Types.ObjectId(shipmentId);
  searchParams = clientHandler.addClientFilterToConditions(searchParams);
  return shipmentOrchestrationModel
    .aggregate()
    .match(searchParams)
    .exec()
    .then(result => result.length);
};

shipmentOrchestrationService.prototype.getOrchestrationDatesObject = function(shipmentId) {
  if (!mongoose.Types.ObjectId.isValid(shipmentId)) {
    return bluebirdPromise.reject();
  }
  const resultObj = {};
  return this.get(
    shipmentId,
    this.getFilterParams({ queryStringParameters: {} }),
    this.getExtraParams({ queryStringParameters: {} })
  )
    .catch(e => {
      akUtils.log(e, `getOrchestrationDatesObject ${shipmentId}`);
      return [];
    })
    .then(result => {
      for (let i = 0; i < result.length; i++) {
        switch (result[i].shipmentStatus) {
          case shipmentStatusMap.Open:
            resultObj.openTime = result[i].actionTime;
            break;
          case shipmentStatusMap.Scheduled:
            resultObj.scheduleTime = result[i].actionTime;
            break;
          case shipmentStatusMap.PartialShipped:
            resultObj.partialShipTime = result[i].actionTime;
            break;
          case shipmentStatusMap.SoftShipped:
            resultObj.softShipTime = result[i].actionTime;
            break;
          case shipmentStatusMap.Shipped:
            resultObj.shipTime = result[i].actionTime;
            break;
          case shipmentStatusMap.PartialDelivered:
            resultObj.partialDeliverTime = result[i].actionTime;
            break;
          case shipmentStatusMap.SoftDelivered:
            resultObj.softDeliverTime = result[i].actionTime;
            break;
          case shipmentStatusMap.Delivered:
            resultObj.deliverTime = result[i].actionTime;
            break;
          case shipmentStatusMap.Canceled:
            resultObj.cancelTime = result[i].actionTime;
            break;
          case shipmentStatusMap.Closed:
            resultObj.closeTime = result[i].actionTime;
            break;
          default:
        }
      }
      return resultObj;
    });
};

module.exports = new shipmentOrchestrationService();
