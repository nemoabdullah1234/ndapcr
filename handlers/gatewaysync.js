/* jshint esversion: 6 */

const commonHelper = require('../helpers/common');
const bluebirdPromise = require('bluebird');
const http = require('http');
const gatewayhelper = require('../helpers/gateways');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');

const typemap = {};
const optionals = ['last_connection', 'uuid', 'manufacturer', 'type', 'location'];
/**
 * Sync gateway.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.gatewaySync = (event, context, callback) => {
  event = commonHelper.parseLambdaEvent(event);
  clientHandler.setClient(clientHandler.getClientObject(event));
  currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
  const obj = commonHelper.parseLambdaEvent(event);
  const options = {
    host: 'api.kontakt.io',
    path: `/receiver?placeId=${process.env.kontaktPlaceId}`,
    headers: {
      'Api-Key': process.env.kontaktApiKey,
      Accept: 'application/vnd.com.kontakt+json'
    }
  };
  commonHelper.decryptDbURI().then(dbURI => {
    commonHelper.connectToDb(dbURI);

    http.get(options, res => {
      let body = '';
      res.on('data', chunk => {
        body += chunk;
      });
      res
        .on('end', () => {
          const apiResponse = JSON.parse(body);
          const kontactBecons = apiResponse.receivers;
          const arraythings = [];
          for (let i = 0; i < kontactBecons.length; i++) {
            const row = kontactBecons[i];
            const thing = {};
            const event = {};
            event.headers = obj.headers;
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
            thing.client = {};
            thing.type = 'hardware';
            event.body = thing;
            arraythings.push(event);
          }

          const collectionHelper = require('../helpers/collection');
          const attributeHelper = require('../helpers/attribute');
          const errors = [];
          return collectionHelper.getByCode('gateway_system_attributes').then(result =>
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
                        event => gatewayhelper.updateorinsert(event)

                        // event.headers = {};
                        // event.headers.authorizer = {};
                        // // console.log(event);
                        // return thingshelper.save(event);
                      )
                      .then(() => {
                        const response = {
                          statusCode: 200,
                          body: result
                        };
                        callback(null, response);
                      });
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

module.exports.gatewaySyncAxios = (event, context, callback) => {
  event = commonHelper.parseLambdaEvent(event);
  clientHandler.setClient(clientHandler.getClientObject(event));
  currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
  const axios = require('axios');

  const axiosObj = axios.create({
    baseURL: process.env.kontaktBaseUrl,
    headers: {
      'Api-Key': process.env.kontaktApiKey,
      Accept: 'application/vnd.com.kontakt+json'
    }
  });

  axiosObj
    .get('/receiver', {
      params: {
        placeId: process.env.kontaktPlaceId
      }
    })
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
