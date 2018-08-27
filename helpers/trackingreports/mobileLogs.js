const mobileLogsModel = require('../../models/mobilelogs');
const mongoose = require('mongoose');
const bluebirdPromise = require('bluebird');

const mobileLogsService = function() {};

/**
 * Set client of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
mobileLogsService.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

/**
 * Set headers of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
mobileLogsService.prototype.setHeaders = function(headers) {
  this.headers = headers;
};

/**
 * Set headers of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
mobileLogsService.prototype.setConfigs = function() {
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
mobileLogsService.prototype.get = function(searchParams, otherParams) {
  return mobileLogsModel
    .find(searchParams)
    .sort(otherParams.sort)
    .skip(otherParams.pageParams.offset)
    .limit(otherParams.pageParams.limit)
    .exec()
    .then(result => {
      const list = [];
      if (result) {
        for (let i = 0; i < result.length; i++) {
          list.push(this.formatResponse(result[i]));
        }
      }
      // console.log(list);
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
mobileLogsService.prototype.count = function(searchParams = {}) {
  // console.log('IN COUNT');
  return mobileLogsModel.count(searchParams).exec();
};

/**
 * Performs response from DB operations to return as API response.
 * 
 * @param {Object} data Database operation result.
 * @param {Boolean} isDropdown Whether the APi is requesting a dropdown.
 * @return {Promise} formattedResponse Formatted Response
 * 
 */
mobileLogsService.prototype.formatResponse = function(data) {
  return data;
  /* var formattedResponse = {};
  formattedResponse.id = data._id;
  formattedResponse.device = data.deviceInfo;
  formattedResponse.pkid = data.pkid;
  formattedResponse.spd = data.spd;
  formattedResponse.prv = data.prv;
  formattedResponse.acc = data.acc;
  formattedResponse.sensor = { 'id': data.sensors.id, 'code': data.sensors.code };
  let location = '';
  let known = false;
  if(data.locationdetails[0].locationId !== null) {
    location = data.locationdetails[0].name;
    known = true;
  } else {
    let addressArray = [ data.locationdetails[0].address, data.locationdetails[0].city, data.locationdetails[0].state, data.locationdetails[0].country ];
    location = addressArray.join(', ');
    known = false;
  }
  
  formattedResponse.location = { 
    id: data.locationdetails[0].locationId,
    name: location,
    known: known
  };
  formattedResponse.zone = null;
  formattedResponse.ts = data.ts;
  formattedResponse.trackedAt = data.tsdt;
  formattedResponse.hit = data.hit;
  
  return formattedResponse;
*/
};

/**
 * Map keys for sorting.
 * 
 * @param {String} key
 * @return {String} 
 * 
 */
mobileLogsService.prototype.getColumnMap = function(key) {
  const map = {
    pkid: 'pkid',
    deviceCode: 'code',
    sensors_uuid: 'uuid',
    sensors_maj: 'maj',
    sensors_min: 'min',
    sensors_rng: 'rng',
    lat: 'lat',
    lon: 'lon',
    acc: 'acc',
    prv: 'prv',
    spd: 'spd',
    ts: 'ts',
    dt: 'dt'
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
mobileLogsService.prototype.getFilterParams = function(event) {
  const filters = {};
  // filters = require('../../lib/clientHandler').addClientFilterToConditions(filters);
  if (event.queryStringParameters && event.queryStringParameters.filter) {
    // filters._all = event.queryStringParameters.filter;
    filters.$or = [
      {
        did: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        uuid: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        pkid: new RegExp(event.queryStringParameters.filter, 'i')
      }
    ];

    if (!isNaN(Number(event.queryStringParameters.filter))) {
      filters.$or.push({
        maj: Number(event.queryStringParameters.filter)
      });
      filters.$or.push({
        min: Number(event.queryStringParameters.filter)
      });
    }
  }

  if (event.queryStringParameters.deviceCode) {
    filters.did = event.queryStringParameters.deviceCode;
  }

  // console.log('==============================================');
  // console.log(event.queryStringParameters);
  if (event.queryStringParameters.pkid) {
    filters.pkid = new RegExp(event.queryStringParameters.pkid, 'i');
  }

  if (event.queryStringParameters.sensors_uuid) {
    filters.uuid = new RegExp(event.queryStringParameters.sensors_uuid, 'i');
  }

  if (event.queryStringParameters.sensors_maj) {
    filters.maj = Number(event.queryStringParameters.sensors_maj);
  }

  if (event.queryStringParameters.sensors_min) {
    filters.min = Number(event.queryStringParameters.sensors_min);
  }

  if (event.queryStringParameters.acc) {
    filters.acc = Number(event.queryStringParameters.acc);
  }

  if (event.queryStringParameters.prv) {
    filters.prv = new RegExp(event.queryStringParameters.prv, 'i');
  }

  if (event.queryStringParameters.spd) {
    filters.spd = Number(event.queryStringParameters.spd);
  }

  if (event.queryStringParameters.trackedFrom || event.queryStringParameters.trackedTo) {
    filters.tsdt = {};
  }

  if (event.queryStringParameters.trackedFrom) {
    filters.ts.$gte = new Date(event.queryStringParameters.trackedFrom).getTime();
  }

  if (event.queryStringParameters.trackedTo) {
    filters.ts.$lte = new Date(event.queryStringParameters.trackedTo).getTime();
  }

  if (event.queryStringParameters.mqttDateFrom) {
    filters.mqttts.$gte = new Date(event.queryStringParameters.mqttDateFrom).getTime();
  }

  if (event.queryStringParameters.mqttDateTo) {
    filters.mqttts.$lte = new Date(event.queryStringParameters.mqttDateTo).getTime();
  }

  if (event.queryStringParameters.logDateFrom) {
    filters.logts.$gte = new Date(event.queryStringParameters.logDateFrom).getTime();
  }

  if (event.queryStringParameters.logDateTo) {
    filters.logts.$lte = new Date(event.queryStringParameters.logDateTo).getTime();
  }

  if (event.queryStringParameters.updatedFrom || event.queryStringParameters.updatedTo) {
    filters.dt = {};
  }

  if (event.queryStringParameters.updatedFrom) {
    filters.dt.$gte = new Date(event.queryStringParameters.updatedFrom);
  }

  if (event.queryStringParameters.updatedTo) {
    filters.dt.$lte = event.queryStringParameters.updatedTo;
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
mobileLogsService.prototype.getExtraParams = function(event) {
  const params = {};
  params.sort = {};
  if (!event.queryStringParameters) {
    params.pageParams = {
      offset: 0,
      limit: 20
    };
    params.sort.dt = -1;
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
    params.sort.dt = -1;
  }

  return params;
};

module.exports = new mobileLogsService();
