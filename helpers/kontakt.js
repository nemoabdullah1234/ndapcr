const kontaktmodel = require('../models/kontakt');
const bluebirdPromise = require('bluebird');
const http = require('https');
const iotLib = require('../lib/aws/iot');

const iot = new iotLib();
const axios = require('axios');

const kontaktService = function() {};

/**
 * Set client of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
kontaktService.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

/**
 * Set headers of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
kontaktService.prototype.setHeaders = function(headers) {
  this.headers = headers;
};

/**
 * Recieve data 
 * 
 * @param {any} event 
 */
kontaktService.prototype.recieveData = function(event) {
  let rawData;
  if (typeof event.body === typeof '') {
    rawData = JSON.parse(event.body || []);
  }
  rawData = event.body || [];
  if (!Array.isArray(rawData)) {
    return bluebirdPromise.resolve();
  }
  const analyticsData = this.filterData(rawData);
  const uniqueBeacons = [...new Set(analyticsData.map(item => item.trackingId))];
  let uniqueDidTsComb = this.getUniqueDidTsCombination(analyticsData);

  const uniqueDids = [...new Set(uniqueDidTsComb.map(item => item.did))];

  const equalSizeArray = this.splitArray(uniqueBeacons, 10);
  const konApiUrl = process.env.kontaktBaseUrl;
  let beaconData = {};

  return this.fetchZoneData(uniqueDids)
    .then(res => {
      uniqueDidTsComb = uniqueDidTsComb.map(item => {
        if (
          res[item.did].length > 0 &&
          typeof res[item.did][0] === typeof {} &&
          res[item.did][0].location &&
          typeof res[item.did][0].location.coordinates === typeof {}
        ) {
          const loc = res[item.did][0].location.coordinates;
          item.lat = Number(loc.latitude);
          item.lon = Number(loc.longitude);
        } else {
          item.lat = 28.62495;
          item.lon = 77.373603;
        }
        return item;
      });

      return bluebirdPromise.each(equalSizeArray, res => {
        // console.log('in each.......');

        const axiosObj = axios.create({
          baseURL: konApiUrl,
          headers: {
            'Api-Key': process.env.kontaktApiKey,
            Accept: 'application/vnd.com.kontakt+json;version=10',
            'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
          }
        });
        return axiosObj
          .get('/device', {
            params: {
              uniqueId: res.join(',')
            }
          })
          .then(res => {
            res.body = res.data;
            if (res.body && res.body !== '') {
              let bData;
              if (typeof res.body === typeof {}) {
                bData = res.body;
              } else {
                bData = JSON.parse(res.body);
              }
              const formatBeaconData = this.formatBeaconData(bData.devices);

              beaconData = Object.assign(beaconData, formatBeaconData);
            }
          });
      });
    })
    .then(() => {
      const list = [];
      uniqueDidTsComb.forEach(u => {
        const b = analyticsData.filter(obj => obj.sourceId === u.did && obj.timestamp === u.ts);
        if (u.ts.toString().length === 10) {
          u.ts *= 1000;
        }
        u.projectid = process.env.cognitoUserpoolId;
        u.clientid = process.env.accountNo;
        u.dir = 0;
        u.spd = 0;
        u.prv = '';
        u.alt = 0;
        u.pkid = u.did + u.ts;
        u.ht = new Date().getTime();
        // u.lat = 28.62495;
        // u.lon = 77.373603;
        u.acc = 0;
        u.sensors = b.map(item => {
          if (!beaconData[item.trackingId]) {
            // console.log(`no beacon data for---${item.trackingId}`);
          }
          const rObj = beaconData[item.trackingId] || {};
          rObj.rssi = item.rssi;
          rObj.dis = 0;
          rObj.rng = 0;
          return rObj;
        });
        list.push(u);
      });
      return iot.publish(process.env.iotTopic, JSON.stringify(list));
    });
};

/**
 * confirm subscription
 * 
 * @param {any} event 
 */
kontaktService.prototype.confirmSubscription = function(event) {
  // console.log('in confirmSubscription========');
  return this.save(event)
    .then(res => {
      const response = {};
      response.managerId = res.managerId;
      response.requestId = res.uid;
      return bluebirdPromise.resolve(response);
    })
    .catch(err => {
      // console.log('err+----------');
      // console.log(err);
      const response = {};
      response.managerId = event.headers.managerid;
      response.requestId = event.headers['X-Request-ID'];
      return bluebirdPromise.resolve(response);
    });
};

/**
 * Save an kontakt
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of save operation.
 * 
 */
kontaktService.prototype.save = function save(event) {
  // console.log('in save========');
  const kontaktObj = new kontaktmodel(); // create a new instance of the  model
  kontaktObj.placeId = event.headers.placeid;
  kontaktObj.managerId = event.headers.managerid;
  kontaktObj.uid = event.headers['X-Request-ID'];
  // console.log(kontaktObj);
  return kontaktObj.save();
};

/**
 * Subscribe for analytics data as a webhook
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of update operation.
 * 
 */
kontaktService.prototype.subscribe = function(event) {
  // console.log(`event header host-----${(event.headers || {}).Host}`);
  let webHookUrl = `${process.env.apiBaseUrl}/kontakt/${process.env.stage}/webhook`;
  if (event && event.headers && event.headers.Host) {
    const hostUrl = `https://${event.headers.Host}/${process.env.stage}`;
    const webHookPath = '/kontakt/webhook';
    webHookUrl = hostUrl + webHookPath;
  }
  const konUrl = process.env.kontaktLocationEngineUrl;
  const placeId = process.env.kontaktPlaceId;
  const managerId = process.env.kontaktManagerId;
  const data = `url=${encodeURIComponent(webHookUrl)}&placeId=${encodeURIComponent(
    placeId
  )}&headers[placeId]=${placeId}&headers[managerId]=${encodeURIComponent(managerId)}`;
  const options = {
    host: konUrl,
    path: `/webhook/subscribe?${data}`,
    method: 'POST',
    headers: {
      'Api-Key': process.env.kontaktApiKey,
      Accept: 'application/vnd.com.kontakt+json;version=10',
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
    }
  };

  return this.PromiseRequest(options);
};

kontaktService.prototype.filterData = function(kontData) {
  kontData = kontData.filter(obj => obj.trackingId.length === 4);
  return Array.from(new Set(kontData.map(JSON.stringify))).map(JSON.parse);
};

kontaktService.prototype.formatBeaconData = function(data) {
  return data.reduce((result, item) => {
    result[item.uniqueId] = {};
    result[item.uniqueId].uuid = item.proximity;
    result[item.uniqueId].min = item.minor;
    result[item.uniqueId].maj = item.major;
    return result;
  }, {});
};

kontaktService.prototype.splitArray = function(arr, size) {
  const array = [];
  while (arr.length > 0) {
    array.push(arr.splice(0, size));
  }
  return array;
};

kontaktService.prototype.getUniqueDidTsCombination = function(data) {
  return [
    ...new Set(
      data.map(item => {
        const a = {};
        a.ts = item.timestamp;
        a.did = item.sourceId;
        return JSON.stringify(a);
      })
    )
  ].map(JSON.parse);
};

kontaktService.prototype.PromiseRequest = bluebirdPromise.method(
  options =>
    new bluebirdPromise((resolve, reject) => {
      const request = http.request(options, response => {
        // Bundle the result
        const result = {
          httpVersion: response.httpVersion,
          statusCode: response.statusCode,
          headers: response.headers,
          body: '',
          trailers: response.trailers
        };
        response.setEncoding('utf8');
        // Build the body
        response.on('data', chunk => {
          result.body += chunk;
        });

        // Resolve the promise
        resolve(result);
      });

      // Handle errors
      request.on('error', error => {
        // console.log('Problem with request:', error.message);
        reject(error);
      });

      // Must always call .end() even if there is no data being written to the request body
      request.end();
    })
);

kontaktService.prototype.fetchZoneData = function(things) {
  const findZoneHelper = require('./tracking/findZone');

  const event = {};
  event.body = {};
  event.body.things = things;

  return findZoneHelper.getZonesFromThings(event);
};

kontaktService.prototype.webhookResubscribe = function(event) {
  const konApiUrl = `https://${process.env.kontaktLocationEngineUrl}`;
  const axiosObj = axios.create({
    baseURL: konApiUrl,
    headers: {
      'Api-Key': process.env.kontaktApiKey,
      Accept: 'application/vnd.com.kontakt+json;version=10',
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
    }
  });
  return axiosObj.get('/webhook').then(res => {
    res.body = res.data;
    // console.log('data from kontakt of Webhooks');
    // console.log(res);
    // res = (require('deep-trim'))(res);
    if (!res.body || !(res.webhooks || []).length) {
      // console.log('resubscribe');
      return this.subscribe(event);
    }
    return bluebirdPromise.resolve('Already Subscribed');
  });
};
module.exports = new kontaktService();
