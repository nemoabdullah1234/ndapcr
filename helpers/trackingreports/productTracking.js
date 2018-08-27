const trackingModel = require('../../models/tracking');
const mongoose = require('mongoose');
const bluebirdPromise = require('bluebird');

const productTrackingService = function() {};

/**
 * Set client of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
productTrackingService.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

/**
 * Set headers of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
productTrackingService.prototype.setHeaders = function(headers) {
  this.headers = headers;
};

/**
 * Set headers of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
productTrackingService.prototype.setConfigs = () => {
  // console.log('config');
  return require('./../configuration')
    .getConfigurations()
    .then(configs => {
      this.configs = configs;
    });
};
/**
 * Query the database to fetch attributes on the basis of search parameters and other parameters
 * 
 * @param {Object} searchParams search filters
 * @param {Object} otherParams pagination, sorting etc other params.
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
productTrackingService.prototype.get = function(searchParams, otherParams) {
  return trackingModel
    .find(searchParams)
    .sort(otherParams.sort)
    .skip(otherParams.pageParams.offset)
    .limit(otherParams.pageParams.limit)
    .exec()
    .then(result => {
      const list = [];
      // console.log('result');
      // console.log(result.length);
      if (result) {
        for (let i = 0; i < result.length; i++) {
          list.push(this.formatResponse(result[i]));
        }
      }
      // console.log('list');
      // console.log(list.length);
      return list;
    })
    .then(result => {
      if (result.length === 0) {
        // console.log('In Reject');
        return bluebirdPromise.reject();
      }
      // console.log('In Resolve');
      return bluebirdPromise.resolve(result);
    });
};

/**
 * Count attributes on the basis of some search conditions.
 * 
 * @param {Object} searchParams Search Conditions
 * @return {Promise<Number>} Number of matching attributes.
 * 
 */
productTrackingService.prototype.count = function(searchParams = {}) {
  // console.log('IN COUNT');
  return trackingModel.count(searchParams).exec();
};

/**
 * Performs response from DB operations to return as API response.
 * 
 * @param {Object} data Database operation result.
 * @param {Boolean} isDropdown Whether the APi is requesting a dropdown.
 * @return {Promise} formattedResponse Formatted Response
 * 
 */
productTrackingService.prototype.formatResponse = function(data) {
  const formattedResponse = {};
  formattedResponse.id = data._id;
  formattedResponse.device = data.deviceInfo;
  formattedResponse.pkid = data.pkid;
  formattedResponse.spd = data.spd;
  formattedResponse.prv = data.prv;
  formattedResponse.acc = data.acc;
  formattedResponse.sensor = { id: data.sensors.id, code: data.sensors.code };
  let location = '';
  let known = false;
  if (data.location.addresses.id !== null) {
    location = data.location.addresses.name;
    known = true;
  } else {
    const addressArray = data.location.addresses.address.map(row => row.value);
    location = addressArray.join(', ');
    known = false;
  }

  formattedResponse.location = {
    id: data.location.addresses.id,
    name: location,
    known
  };
  formattedResponse.zone = null;
  if (typeof data.location.addresses.zones === 'object') {
    formattedResponse.zone = data.location.addresses.zones;
  }

  formattedResponse.product = null;
  if (typeof data.sensors.product === 'object') {
    formattedResponse.product = data.sensors.product;
  }

  formattedResponse.shipment = null;
  if (typeof data.sensors.shipment === 'object') {
    formattedResponse.shipment = data.sensors.shipment;
  }

  formattedResponse.trackedAt = data.trackedAt;
  formattedResponse.updatedAt = data.updatedAt;
  formattedResponse.client = data.client;

  return formattedResponse;
};

/**
 * Map keys for sorting.
 * 
 * @param {String} key
 * @return {String} 
 * 
 */
productTrackingService.prototype.getColumnMap = function(key) {
  const map = {
    pkid: 'pkid',
    deviceCode: 'deviceInfo.code',
    location: 'location.addresses.code',
    zone: 'location.addresses.zones.code',
    product: 'sensors.product.code',
    shipment: 'sensors.shipment.code',
    sensor: 'sensors.code',
    acc: 'acc',
    prv: 'prv',
    spd: 'spd',
    trackedAt: 'trackedAt',
    updatedAt: 'updatedAt'
  };

  if (key) {
    return map[key] || key;
  }
  return map;
};

/**
 * Generate the search conditions for the GET operation.
 * 
 * @param {Object} event Lambda Event
 * @return {Object} filters.
 * 
 */
productTrackingService.prototype.getFilterParams = function(event) {
  const filters = {};
  // filters = require('../../lib/clientHandler').addClientFilterToConditions(filters);
  if (event.queryStringParameters && event.queryStringParameters.filter) {
    // filters._all = event.queryStringParameters.filter;
    filters.$or = [
      {
        pkid: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        did: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'sensors.code': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'location.addresses.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'location.addresses.zones.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'sensors.shipment.code': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'sensors.product.code': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        prv: new RegExp(event.queryStringParameters.filter, 'i')
      }
    ];
  }

  // console.log('==============================================');
  // console.log(event.queryStringParameters);
  if (event.queryStringParameters.pkid) {
    filters.pkid = new RegExp(event.queryStringParameters.pkid, 'i');
  }

  if (event.queryStringParameters.deviceCode) {
    filters.did = new RegExp(event.queryStringParameters.deviceCode, 'i');
  }

  if (event.queryStringParameters.product) {
    filters['sensors.product.code'] = new RegExp(event.queryStringParameters.product, 'i');
  }

  if (event.queryStringParameters.shipment) {
    filters['sensors.shipment.code'] = new RegExp(event.queryStringParameters.shipment, 'i');
  }

  if (event.queryStringParameters.location) {
    filters['location.addresses.name'] = new RegExp(event.queryStringParameters.location, 'i');
  }

  if (event.queryStringParameters.zone) {
    filters['location.addresses.zones.name'] = new RegExp(event.queryStringParameters.zone, 'i');
  }

  if (event.queryStringParameters.acc) {
    filters.acc = event.queryStringParameters.acc;
  }

  if (event.queryStringParameters.prv) {
    filters.prv = new RegExp(event.queryStringParameters.prv, 'i');
  }

  if (event.queryStringParameters.spd) {
    filters.spd = event.queryStringParameters.spd;
  }

  if (event.queryStringParameters.trackedFrom || event.queryStringParameters.trackedTo) {
    filters.trackedAt = {};
  }

  if (event.queryStringParameters.trackedFrom) {
    filters.trackedAt.$gte = new Date(event.queryStringParameters.trackedFrom);
  }

  if (event.queryStringParameters.trackedTo) {
    filters.trackedAt.$lte = event.queryStringParameters.trackedTo;
  }

  if (event.queryStringParameters.updatedFrom || event.queryStringParameters.updatedTo) {
    filters.updatedAt = {};
  }

  if (event.queryStringParameters.updatedFrom) {
    filters.updatedAt.$gte = new Date(event.queryStringParameters.updatedFrom);
  }

  if (event.queryStringParameters.updatedTo) {
    filters.updatedAt.$lte = event.queryStringParameters.updatedTo;
  }

  // if (request.queryStringParameters.status === '1' || request.queryStringParameters.status === '0') filters.status = request.queryStringParameters.status === '1';
  if (event.queryStringParameters.dd === '1') {
    filters.status = 1;
    filters.sysDefined = 0;
  }
  // console.log(filters);
  return filters;
};

/**
 * Generate the extra parameters for the GET operation like sorting, pagination etc.
 * 
 * @param {Object} request Lambda Event
 * @return {Object} extraParams
 * 
 */
productTrackingService.prototype.getExtraParams = function(event) {
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
    offset: dd ? 0 : Number(offset),
    limit: dd ? 65535 : Number(limit)
  };
  if (event.queryStringParameters.sort) {
    const sortQuery = event.queryStringParameters.sort;
    const sortColumns = sortQuery.split(',');
    sortColumns.forEach(col => {
      let sortOrder = 1;
      col = col.trim();
      const isValidColumn = this.getColumnMap(col) || this.getColumnMap(col.replace('-', ''));
      if (isValidColumn) {
        if (col.startsWith('-')) {
          sortOrder = -1;
          col = col.replace('-', '');
        }

        col = this.getColumnMap(col);
        params.sort[col] = sortOrder;
      }
    }, this);
  } else {
    params.sort.trackedAt = -1;
  }

  return params;
};

module.exports = new productTrackingService();
