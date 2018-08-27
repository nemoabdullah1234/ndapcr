/* jshint esversion: 6 */

const commonHelper = require('../helpers/common');
const bluebirdPromise = require('bluebird');
const http = require('http');
const thingshelper = require('../helpers/things');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');

const typemap = {
  battery_level: 'number',
  major: 'number',
  minor: 'number',
  interval: 'number'
};
const optionals = [
  'master',
  'battery_level',
  'last_connection',
  'rssi',
  'interval',
  'uuid',
  'major',
  'minor',
  'manufacturer'
];
/**
 * Sync things by fetching data from third party API
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.thingsSync = (event, context, callback) => {
  event = commonHelper.parseLambdaEvent(event);
  clientHandler.setClient(clientHandler.getClientObject(event));
  currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
  const obj = commonHelper.parseLambdaEvent(event);
  const options = {
    host: 'api.kontakt.io',
    path: '/device?deviceType=beacon&maxResult=1000',
    headers: {
      'Api-Key': process.env.kontaktApiKey,
      Accept: 'application/vnd.com.kontakt+json; version=8'
    }
  };
  commonHelper.decryptDbURI().then(dbURI => {
    // const mongoose = require('mongoose');//TODO: change from mongoose to dbconnection
    commonHelper.connectToDb(dbURI);

    http.get(options, res => {
      let body = '';
      res.on('data', chunk => {
        body += chunk;
      });
      res
        .on('end', () => {
          const apiResponse = JSON.parse(body);
          const kontactBecons = apiResponse.devices;
          const arraythings = [];
          for (let i = 0; i < kontactBecons.length; i++) {
            const row = kontactBecons[i];
            const thing = {};
            const event = {};
            event.headers = obj.headers;
            thing.interval = kontactBecons[row].interval;
            thing.uuid = kontactBecons[row].proximity;
            thing.major = kontactBecons[row].major;
            thing.minor = kontactBecons[row].minor;
            thing.code = kontactBecons[row].uniqueId;
            thing.manufacturer = kontactBecons[row].name;
            thing.txPower = kontactBecons[row].txPower;
            if (kontactBecons[row].alias !== undefined && kontactBecons[row].alias !== null) {
              thing.name = kontactBecons[row].alias;
            } else {
              thing.name = kontactBecons[row].uniqueId;
            }
            thing.tags = [];
            thing.attributes = [];
            thing.product = '';
            thing.categories = [];
            thing.battery_level = 70;
            thing.last_connection = '';
            thing.type = 'beacon';
            thing.status = 1;
            thing.client = {};
            event.body = thing;
            arraythings.push(event);
          }

          const collectionHelper = require('../helpers/collection');
          const attributeHelper = require('../helpers/attribute');
          const errors = [];
          return collectionHelper.getByCode('thing_system_attributes').then(result =>
            bluebirdPromise
              .map(result.items, element => attributeHelper.getById(element.id))
              .then(sysDefAttrList => {
                bluebirdPromise
                  .map(arraythings, event => {
                    const sysDefinedAttrPair = [];
                    for (const i in sysDefAttrList) {
                      if (sysDefAttrList.hasOwnProperty(i)) {
                        const sysDefAttr = {};
                        sysDefAttr.id = sysDefAttrList[i].id;
                        sysDefAttr.name = sysDefAttrList[i].name;
                        sysDefAttr.value = event.body[sysDefAttrList[i].name];
                        sysDefAttr.sysDefined = sysDefAttrList[i].sysDefined;
                        sysDefAttr.status = sysDefAttrList[i].status;
                        if (!event.body[sysDefAttrList[i].name]) {
                          if (optionals.indexOf(sysDefAttrList[i].name) < 0) {
                            errors.push({
                              code: Number(`${220}${i}`),
                              message: `${sysDefAttrList[i].name} is required.`
                            });
                          }
                        } else if (
                          typemap[sysDefAttrList[i].name] &&
                          typeof event.body[sysDefAttrList[i].name] !==
                            typemap[sysDefAttrList[i].name]
                        ) {
                          errors.push({
                            code: Number(`${220}${i}`),
                            message: `${sysDefAttrList[i].name} must be ${typemap[
                              sysDefAttrList[i].name
                            ]}.`
                          });
                        } else if (
                          typeof event.body[sysDefAttrList[i].name] !== 'string' &&
                          !typemap[sysDefAttrList[i].name]
                        ) {
                          errors.push({
                            code: Number(`${220}${i}`),
                            message: `${sysDefAttrList[i].name} must be string`
                          });
                        }
                        if (sysDefAttr.value !== null && sysDefAttr.value !== undefined) {
                          sysDefinedAttrPair.push(sysDefAttr);
                        }
                      }
                    }
                    event.body.attributes = sysDefinedAttrPair;
                    return event;
                  })
                  .then(result => {
                    bluebirdPromise
                      .map(
                        result,
                        event => thingshelper.updateorinsert(event)

                        //  event.headers = {};
                        //  event.headers.authorizer = {};
                        //  // console.log(event);

                        //   return thingshelper.save(event);
                      )
                      .then(success =>
                        thingshelper.syncBatteryLevel(success).then(() => {
                          const response = {
                            statusCode: 200,
                            body: ['success', 'success']
                          };
                          // this.thingsSyncBatterylevel(response);
                          callback(null, response);
                        })
                      );
                  });
              })
          );
        })
        .on('error', e => {
          // console.log(`Got error: ${e.message}`);
          context.done(null, e.message);
        });
    });
  });
};
// db.getCollection('things').update({'code':'g3BE','attributes.name':'battery_level'},{ $set: { 'attributes.$.value': 0 }},false,true)
module.exports.thingsSyncAxios = (event, context, callback) => {
  const axios = require('axios');

  const axiosObj = axios.create({
    baseURL: process.env.kontaktBaseUrl,
    headers: {
      'Api-Key': process.env.kontaktApiKey,
      Accept: 'application/vnd.com.kontakt+json; version=8'
    }
  });

  axiosObj
    .get('/device/status', { params: { uniqueId: 'HEA1G' } })
    .then(result => {
      // console.log(result);
      const response = {
        statusCode: 200,
        body: result.data
      };
      callback(null, response);
    })
    .catch(error => {
      // console.log(error);
    });
};
