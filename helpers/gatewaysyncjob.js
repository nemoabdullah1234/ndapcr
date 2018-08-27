/* jshint esversion: 6 */

const bluebirdPromise = require('bluebird');
const gatewayhelper = require('../helpers/gateways');
const configHelper = require('../helpers/configuration');
const axios = require('axios');

/* const typemap = {

};
const optionals = [
    'last_connection',
    'uuid',
    'manufacturer',
    'type',
    'location'
]; */

const gatewaySyncJobService = function() {};
/**
 * Initiate fetch and save of Gateway from kontakt. Accept sync job
 * 
 * @param {Object} jobObj
 * @return {Void} 
 *   
 */
gatewaySyncJobService.prototype.syncThings = function(jobObj) {
  return configHelper.getConfigurations().then(config => {
    const commonHelper = require('../helpers/common');
    const startIndex = parseInt(jobObj.cursor, 10);
    const maxResult = parseInt(process.env.syncCount, 10);
    const headers = commonHelper.convertUserAndClientToHeader(jobObj);
    let countOfrecords = 0;
    const axiosObj = axios.create({
      baseURL: process.env.kontaktBaseUrl,
      headers: {
        'Api-Key': config.kontaktApiKey,
        Accept: 'application/vnd.com.kontakt+json'
      }
    });
    return axiosObj
      .get('/receiver', {
        params: {
          placeId: process.env.kontaktPlaceId,
          startIndex,
          maxResult
        }
      })
      .then(apiResponse => {
        const kontactBecons = apiResponse.data.receivers;
        const arraythings = [];
        countOfrecords = kontactBecons.length;
        for (const row in kontactBecons) {
          if (kontactBecons.hasOwnProperty(row)) {
            const thing = {};
            const event = {};
            event.headers = headers;
            thing.uuid = kontactBecons[row].id;
            thing.code = kontactBecons[row].deviceUniqueId;
            thing.manufacturer = '';
            thing.last_connection = '';
            thing.location = '';
            thing.name = kontactBecons[row].deviceUniqueId;
            thing.tags = [];
            thing.attributes = [];
            thing.categories = [];
            thing.status = 1;
            thing.client = jobObj.client;
            thing.type = 'gateway';
            thing.appName = 'hardgateway';
            event.body = thing;
            arraythings.push(event);
          }
        }
        const indexedArrayThingsByCode = {};

        for (let i = 0; i < arraythings.length; i++) {
          indexedArrayThingsByCode[arraythings[i].body.code] = arraythings[i];
        }

        const codeList = Object.getOwnPropertyNames(indexedArrayThingsByCode);
        // console.log(codeList);
        // console.log('codelist');
        return bluebirdPromise
          .map(codeList, code =>
            gatewayhelper
              .getByCode(code)
              .then(result => {
                if (!indexedArrayThingsByCode[code].pathParameters) {
                  indexedArrayThingsByCode[code].pathParameters = {};
                }
                indexedArrayThingsByCode[code].pathParameters.id = result.id;
                indexedArrayThingsByCode[code].body.name = result.name;
                indexedArrayThingsByCode[code].body.product = (result.product || {}).id || '';
                return gatewayhelper.update(indexedArrayThingsByCode[code]);
              })
              .catch(error => {
                // console.log(error);
                return gatewayhelper.save(indexedArrayThingsByCode[code]);
              })
          )
          .then(
            result =>
              // let count = result.length;
              0 // return count 0 in case of beacon
          );
      });
  });
};
module.exports = new gatewaySyncJobService();
