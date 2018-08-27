/* jshint esversion: 6 */

// var config = require('../../../config.'+process.env.NODE_ENV);
const mongoose = require('mongoose');
const bluebirdPromise = require('bluebird');
const commonHelper = require('./common');
const clientHandler = require('../lib/clientHandler');

const akUtils = require('../lib/utility');

const itemStatusLabelMap = require('../mappings/itemStatusLabel.json');

const itemOrchestrationModel = require('../models/itemOrchestration');

const itemOrchestrationService = function() {};

itemOrchestrationService.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

itemOrchestrationService.prototype.formatResponse = function(data) {
  const formattedResponse = {};
  formattedResponse.id = data._id;
  formattedResponse.itemStatus = data.itemStatus;
  formattedResponse.itemStatusLabel = akUtils.objectKeyByValue(itemStatusLabelMap, data.itemStatus);

  formattedResponse.actionTime = data.actionTime;
  return formattedResponse;
};

itemOrchestrationService.prototype.getFilterParams = function(event) {
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
  if (event.queryStringParameters.name) {
    filters.Name = new RegExp(event.queryStringParameters.name, 'i');
  }
  if (event.queryStringParameters.status === '1') {
    filters.status = 1;
  } else if (event.queryStringParameters.status === '0') {
    filters.status = 0;
  }
  if (event.queryStringParameters.dd === '1') {
    filters.status = 1;
  }

  return filters;
};

itemOrchestrationService.prototype.getExtraParams = function(event) {
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
    params.sort.updatedOn = -1;
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
itemOrchestrationService.prototype.save = function save(itemOrchestrationData) {
  return itemOrchestrationModel
    .findOne({ itemId: itemOrchestrationData.itemId })
    .sort({ _id: -1 })
    .exec()
    .then(itemOrchestrationExObj => {
      if (
        !(
          itemOrchestrationExObj !== null &&
          itemOrchestrationExObj.itemStatus === itemOrchestrationData.itemStatus &&
          itemOrchestrationExObj.parentType === itemOrchestrationData.parentType &&
          itemOrchestrationExObj.parentId === itemOrchestrationData.parentId
        )
      ) {
        const itemOrchestrationObj = new itemOrchestrationModel(); // create a new instance of the  model
        itemOrchestrationObj.itemId = itemOrchestrationData.itemId;
        itemOrchestrationObj.itemStatus = itemOrchestrationData.itemStatus;
        itemOrchestrationObj.parentType = itemOrchestrationData.parentType;
        itemOrchestrationObj.parentId = itemOrchestrationData.parentId;
        itemOrchestrationObj.actionTime = itemOrchestrationData.actionTime;
        itemOrchestrationObj.client = clientHandler.getClient();

        // return bluebirdPromise.resolve(orderObj);
        return itemOrchestrationObj.save();
      }
      return bluebirdPromise.resolve({});
    });
};

itemOrchestrationService.prototype.get = function(itemId, parentId, searchParams, otherParams) {
  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    return bluebirdPromise.reject();
  }

  searchParams.itemId = mongoose.Types.ObjectId(itemId);
  searchParams.parentId = mongoose.Types.ObjectId(parentId);
  searchParams = clientHandler.addClientFilterToConditions(searchParams);

  return itemOrchestrationModel
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

itemOrchestrationService.prototype.count = function(itemId, parentId, searchParams = {}) {
  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    return bluebirdPromise.reject();
  }

  searchParams.itemId = mongoose.Types.ObjectId(itemId);
  searchParams.parentId = mongoose.Types.ObjectId(parentId);
  searchParams = clientHandler.addClientFilterToConditions(searchParams);

  return itemOrchestrationModel
    .aggregate()
    .match(searchParams)
    .exec()
    .then(result => result.length);
};

module.exports = new itemOrchestrationService();
