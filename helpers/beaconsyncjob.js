/* jshint esversion: 6 */

const bluebirdPromise = require('bluebird');
const thingshelper = require('../helpers/things');
const configHelper = require('../helpers/configuration');
const axios = require('axios');

// const typemap = {
//     'battery_level': 'number',
//     'major': 'number',
//     'minor': 'number',
//     'interval': 'number'
// };
// const optionals = [
//     'master',
//     'battery_level',
//     'last_connection',
//     'rssi',
//     'interval',
//     'uuid',
//     'major',
//     'minor',
//     'manufacturer'
// ];
const beaconsyncjobService = function() {};
/**
 * Initiate fetch and save of Beacons from kontakt. Accept sync job
 * 
 * @param {Object} jobObj
 * @return {Void} 
 *   
 */
beaconsyncjobService.prototype.syncThings = function(jobObj) {
  return configHelper.getConfigurations().then(config => {
    const startIndex = parseInt(jobObj.cursor, 10);
    const maxResult = parseInt(process.env.syncCount, 10);
    let countOfrecords = 0;
    const axiosObj = axios.create({
      baseURL: process.env.kontaktBaseUrl,
      headers: {
        'Api-Key': config.kontaktApiKey,
        Accept: 'application/vnd.com.kontakt+json; version=10'
      }
    });

    return axiosObj
      .get('/device', {
        params: {
          deviceType: 'beacon',
          startIndex,
          maxResult,
          managerId: process.env.kontaktManagerId || '_',
          q: `(proximity==${process.env.defaultBeaconUUID})`
        }
      })
      .catch(error => {
        // console.log('error in catch step 2');
        // console.log(error);
        return {
          data: {
            devices: []
          }
        };
      })
      .then(apiResponse => {
        const kontactBecons = apiResponse.data.devices || [];
        // console.log('kontactBecons');
        // console.log(kontactBecons);
        // console.log('countOfrecords');
        // console.log(countOfrecords);
        const arraythings = [];
        countOfrecords = kontactBecons.length;
        for (let row = 0; row < kontactBecons.length; row += 1) {
          const thing = {};
          const event = {};
          event.headers = {};
          thing.interval = kontactBecons[row].interval;
          thing.uuid = kontactBecons[row].proximity;
          thing.major = kontactBecons[row].major;
          thing.minor = kontactBecons[row].minor;
          thing.code = kontactBecons[row].uniqueId;
          thing.firmware = kontactBecons[row].firmware;
          thing.manufacturer = kontactBecons[row].name;
          thing.txPower = kontactBecons[row].txPower;
          thing.beaconType = kontactBecons[row].model;
          thing.beaconSpecification = kontactBecons[row].specification;
          thing.type = 'beacon';
          if (kontactBecons[row].alias !== undefined && kontactBecons[row].alias !== null) {
            thing.name = kontactBecons[row].alias;
          } else {
            thing.name = kontactBecons[row].uniqueId;
          }
          thing.tags = [];
          thing.attributes = [];
          thing.product = '';
          thing.categories = [];
          thing.battery_level = 0;
          thing.last_connection = '';
          thing.status = 1;
          thing.client = jobObj.client;
          event.body = thing;
          arraythings.push(event);
        }
        const indexedArrayThingsByCode = {};

        for (let i = 0; i < arraythings.length; i++) {
          indexedArrayThingsByCode[arraythings[i].body.code] = arraythings[i];
        }

        const codeList = Object.getOwnPropertyNames(indexedArrayThingsByCode);

        return thingshelper
          .syncBatteryLevel(codeList)
          .then(result => {
            for (const uniqueId in result) {
              if (result.hasOwnProperty(uniqueId)) {
                indexedArrayThingsByCode[uniqueId].body.last_connection =
                  result[uniqueId].last_connection;
                indexedArrayThingsByCode[uniqueId].body.battery_level =
                  result[uniqueId].battery_level;
              }
            }
            // indexedArrayThingsByCode = Object.assign({}, indexedArrayThingsByCode, result);
          })
          .then(() =>
            bluebirdPromise
              .map(codeList, code =>
                thingshelper
                  .getByCode(code)
                  .then(result => {
                    if (!indexedArrayThingsByCode[code].pathParameters) {
                      indexedArrayThingsByCode[code].pathParameters = {};
                    }
                    indexedArrayThingsByCode[code].pathParameters.id = result.id;
                    indexedArrayThingsByCode[code].body.name = result.name;
                    indexedArrayThingsByCode[code].body.product = result.product.id || '';
                    return thingshelper.update(indexedArrayThingsByCode[code]);
                  })
                  .catch(() => thingshelper.save(indexedArrayThingsByCode[code]))
              )
              .then(result => result.length)
          );
      });
  });
};
module.exports = new beaconsyncjobService();
