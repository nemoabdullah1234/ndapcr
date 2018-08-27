const bluebirdPromise = require('bluebird');
const locationModel = require('../../models/location');
const coreLocationHelper = require('../core/location');
const cacheClient = require('../../lib/cache');
const clientHandler = require('../../lib/clientHandler');

const nearbyLocationHelper = function() {};

/**
 * Set client of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
nearbyLocationHelper.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

/**
 * Format Known Location Result so as to generate structure to return as API response
 * 
 * @param {Object} data result data
 * @param {Number} latitude latitude
 * @param {Number} longitude longitude
 * @return {Object} formatted Result
 * 
 */
nearbyLocationHelper.prototype.formatKnownLocationData = function(data, latitude, longitude) {
  return {
    id: data.id,
    name: data.name,
    address: data.address,
    city: data.city,
    state: data.state,
    country: data.country,
    zipcode: data.zipcode,
    latitude,
    longitude
  };
};

/**
 * Format unknown Location Result from google Geolocation API so as to generate structure to return as API response
 * 
 * @param {Object} data result data
 * @param {Number} latitude latitude
 * @param {Number} longitude longitude
 * @return {Object} formatted Result
 * 
 */
nearbyLocationHelper.prototype.formatUnknownGeoLocationData = function(data, latitude, longitude) {
  let city = '';
  let state = '';
  let country = '';
  let address = '';
  const addressArray = [];
  if (data.results.length > 0 && typeof data.results[0].address_components !== 'undefined') {
    const gaddress_components = data.results[0].address_components;
    for (let i = 0; i < gaddress_components.length; i++) {
      // // console.log('In D2');
      const comps = gaddress_components[i];
      if (
        comps.types.indexOf('administrative_area_level_2') >= 0 ||
        comps.types.indexOf('locality') >= 0
      ) {
        city = comps.long_name;
      }

      if (comps.types.indexOf('administrative_area_level_1') >= 0) {
        state = comps.long_name;
      }

      if (comps.types.indexOf('country') >= 0) {
        country = comps.long_name;
      }

      if (comps.types.indexOf('premise') >= 0) {
        addressArray.push(comps.long_name);
      }

      if (comps.types.indexOf('sublocality_level_3') >= 0) {
        addressArray.push(comps.long_name);
      }

      if (comps.types.indexOf('sublocality_level_2') >= 0) {
        addressArray.push(comps.long_name);
      }

      if (comps.types.indexOf('sublocality_level_1') >= 0) {
        addressArray.push(comps.long_name);
      }

      if (comps.types.indexOf('sublocality_level_1') >= 0) {
        addressArray.push(comps.long_name);
      }
    }
    address = addressArray.join(',');
  }

  return {
    id: null,
    name: null,
    city,
    state,
    country,
    address,
    latitude,
    longitude
  };
};

/**
 * Get known or unknown location result
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise representing result of the search.
 * 
 */
nearbyLocationHelper.prototype.getLocationFromLatLong = function(event) {
  const commonHelper = require('../common');
  let latitude = event.queryStringParameters.latitude;
  let longitude = event.queryStringParameters.longitude;
  if (!latitude || !longitude) {
    return bluebirdPromise.reject('Latitude and/or Longitude not provided');
  }
  latitude = Number(latitude);
  longitude = Number(longitude);
  if (
    !commonHelper.isValidLatitude(Number(latitude)) ||
    !commonHelper.isValidLongitude(Number(longitude))
  ) {
    return bluebirdPromise.reject('Invalid latitude and/or Longitude provided');
  }
  let conditions = {};
  conditions.perimeter = {
    $geoIntersects: {
      $geometry: {
        type: 'Point',
        coordinates: [longitude, latitude]
      }
    }
  };

  conditions.type = 'location';
  conditions.status = 1;
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return locationModel.findOne(conditions).then(result => {
    // console.log(result);
    if (result) {
      return this.formatKnownLocationData(
        coreLocationHelper.formatResponse(result),
        latitude,
        longitude
      );
    }
    return this.getUnknownLocation(latitude, longitude);
  });
};

/**
 * Get unknown location on basis of latitude or longitude and caches it.
 * 
 * @param {Number} latitude latitude
 * @param {Number} longitude longitude
 * @return {Promise} Promise representing result of the search.
 * 
 */
nearbyLocationHelper.prototype.getUnknownLocation = function(latitude, longitude) {
  const mlatitude = latitude.toFixed(4);
  const mlongitude = longitude.toFixed(4);
  const cacheKey = `gloc-${mlatitude}-${mlongitude}`;
  // // console.log(cacheKey);
  return new bluebirdPromise((resolve, reject) =>
    cacheClient.getData(cacheKey, (err, data) => {
      // console.log(data);
      if (typeof data === 'undefined') {
        data = null;
      }
      return err ? reject(err) : resolve(JSON.parse(data));
    })
  )
    .then(data => {
      if (data !== null) {
        data.latitude = latitude;
        data.longitude = longitude;
        return data;
      }
      return this.getLocationFromGeo(mlatitude, mlongitude)
        .then(data => this.formatUnknownGeoLocationData(data.data, latitude, longitude))
        .then(result => this.saveLocationInCache(result, mlatitude, mlongitude))
        .then(data => data);
    })
    .then(location => {
      cacheClient.close();
      return location;
    })
    .catch(() => false);
};

/**
 * Actually hits the Google API to get Address from latitude and longitude
 * 
 * @param {Number} latitude latitude
 * @param {Number} longitude longitude
 * @return {Promise} Promise representing result of the search.
 * 
 */
nearbyLocationHelper.prototype.getLocationFromGeo = function(latitude, longitude) {
  const axios = require('axios');
  return axios.get(process.env.googleGeocodeApiUrl, {
    params: {
      latlng: `${latitude},${longitude}`,
      sensor: 'true'
    }
  });
};

/**
 * Stores unknown location in cache
 * 
 * @param {Object} data unknown location data
 * @param {Number} latKey latKey to use as a part in cache-key
 * @param {Number} longKey longKey to use as a part in cache-key
 * @return {Object} formatted Result
 * 
 */
nearbyLocationHelper.prototype.saveLocationInCache = function(data, latKey, longKey) {
  const cacheKey = `gloc-${latKey}-${longKey}`;
  return new bluebirdPromise(resolve => {
    cacheClient.set(cacheKey, JSON.stringify(data), () => {
      resolve(data);
    });
  });
};

module.exports = new nearbyLocationHelper();
