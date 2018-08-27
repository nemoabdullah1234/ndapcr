const pointsThingsModel = require('../../models/pointsThings');
const mongoose = require('mongoose');
const bluebirdPromise = require('bluebird');

const pointSensorTrackingService = function() {};

/**
 * Set client of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void} 
 * 
 */
pointSensorTrackingService.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

/**
 * Set headers of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
pointSensorTrackingService.prototype.setHeaders = function(headers) {
  this.headers = headers;
};

/**
 * Set headers of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
pointSensorTrackingService.prototype.setConfigs = function() {
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
pointSensorTrackingService.prototype.get = function(searchParams, otherParams) {
  return pointsThingsModel
    .find(searchParams)
    .sort(otherParams.sort)
    .skip(otherParams.pageParams.offset)
    .limit(otherParams.pageParams.limit)
    .exec()
    .then(result => {
      // console.log(result);
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
pointSensorTrackingService.prototype.count = function(searchParams = {}) {
  // console.log('IN COUNT');
  return pointsThingsModel.count(searchParams).exec();
};

/**
 * Performs response from DB operations to return as API response.
 * 
 * @param {Object} data Database operation result.
 * @param {Boolean} isDropdown Whether the APi is requesting a dropdown.
 * @return {Promise} formattedResponse Formatted Response
 * 
 */
pointSensorTrackingService.prototype.formatResponse = function(data) {
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
pointSensorTrackingService.prototype.getColumnMap = function(key) {
  const map = {
    pkid: 'pkid',
    deviceCode: 'deviceInfo.code',
    location: 'locationdetails.name',
    sensors_uuid: 'sensors.uuid',
    sensors_maj: 'sensors.maj',
    sensors_min: 'sensors.min',
    sensors_rng: 'sensors.rng',
    lat: 'location.coordinates',
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
pointSensorTrackingService.prototype.getFilterParams = function(event) {
  const filters = {};
  // filters = require('../../lib/clientHandler').addClientFilterToConditions(filters);
  if (event.queryStringParameters && event.queryStringParameters.filter) {
    // filters._all = event.queryStringParameters.filter;
    filters.$or = [
      {
        did: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        pkid: new RegExp(event.queryStringParameters.filter, 'i')
      }
    ];
  }

  if (event.queryStringParameters.deviceCode) {
    filters.did = new RegExp(event.queryStringParameters.deviceCode, 'i');
  }

  // console.log('==============================================');
  // console.log(event.queryStringParameters);
  if (event.queryStringParameters.pkid) {
    filters.pkid = new RegExp(event.queryStringParameters.pkid, 'i');
  }

  if (event.queryStringParameters.sensors_uuid) {
    filters['sensors.uuid'] = new RegExp(event.queryStringParameters.sensors_uuid, 'i');
  }

  if (event.queryStringParameters.sensors_maj) {
    filters['sensors.maj'] = Number(event.queryStringParameters.sensors_maj);
  }

  if (event.queryStringParameters.sensors_min) {
    filters['sensors.min'] = Number(event.queryStringParameters.sensors_min);
  }

  if (event.queryStringParameters.location) {
    filters['locationdetails.name'] = new RegExp(event.queryStringParameters.location, 'i');
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
    filters.tsdt.$gte = new Date(event.queryStringParameters.trackedFrom);
  }

  if (event.queryStringParameters.trackedTo) {
    filters.tsdt.$lte = event.queryStringParameters.trackedTo;
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
pointSensorTrackingService.prototype.getExtraParams = function(event) {
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
    params.sort.tsdt = -1;
  }

  // console.log(params.sort);

  return params;
};

module.exports = new pointSensorTrackingService();
