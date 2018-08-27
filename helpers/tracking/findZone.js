const bluebirdPromise = require('bluebird');
const locationModel = require('../../models/location');
const commonHelper = require('../common');
const locationHelper = require('../core/location');
const floorHelper = require('../core/floor');
const clientHandler = require('../../lib/clientHandler');
const zoneHelper = require('../core/zone');

const findZoneHelper = function() {};

/**
 * Set client of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void} 
 * 
 */
findZoneHelper.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

/**
 * Format Result so as to generate structure to return as API response
 * 
 * @param {Object} data result data
 * @param {Object} thingsToMatch List of thing codes on the basis of which zones were queried
 * @return {Object} formatted Result
 * 
 */
findZoneHelper.prototype.formatZoneData = function(data, thingsToMatch) {
  const formattedResult = {};
  for (const i in thingsToMatch) {
    formattedResult[thingsToMatch[i]] = [];
  }
  data.forEach(element => {
    // console.log(element.parentInfo);
    // process.exit(1)
    const formattedResultElem = {};
    formattedResultElem.id = element.id;
    formattedResultElem.code = element.code;
    formattedResultElem.name = element.name;
    formattedResultElem.address = element.address;
    formattedResultElem.city = element.city;
    formattedResultElem.state = element.state;
    formattedResultElem.zipcode = element.zipcode;
    formattedResultElem.country = element.country;
    formattedResultElem.location = {};
    formattedResultElem.floor = {};
    formattedResultElem.location.id = element.parentInfo.location.id;
    formattedResultElem.location.code = element.parentInfo.location.code;
    formattedResultElem.location.name = element.parentInfo.location.name;
    formattedResultElem.location.coordinates = element.parentInfo.location.coordinates;
    formattedResultElem.location.radius = element.parentInfo.location.radius;
    formattedResultElem.location.address = element.parentInfo.location.address;
    formattedResultElem.location.city = element.parentInfo.location.city;
    formattedResultElem.location.state = element.parentInfo.location.state;
    formattedResultElem.location.zipcode = element.parentInfo.location.zipcode;
    formattedResultElem.location.country = element.parentInfo.location.country;
    formattedResultElem.floor.id = element.parentInfo.floor.id;
    formattedResultElem.floor.code = element.parentInfo.floor.code;
    formattedResultElem.floor.name = element.parentInfo.floor.name;
    const thingCodes = [];
    for (const i in element.things) {
      thingCodes.push(element.things[i].code);
    }
    const matchedThings = commonHelper.getArrayIntersection(thingCodes, thingsToMatch);
    for (const i in matchedThings) {
      formattedResult[matchedThings[i]].push(formattedResultElem);
    }
  }, this);
  return formattedResult;
};

/**
 * Get zones who have things attached from a particular list of things
 * 
 * @param {Object} data result data
 * @param {array<string>} thingsToMatch List of thing codes on the basis of which zones were queried
 * @return {Promise} Result of the operation.
 * 
 */
findZoneHelper.prototype.getZonesFromThings = function(event) {
  const thingsToMatch = event.body.things;
  let conditions = {
    'things.code': { $in: thingsToMatch }
  };
  conditions.type = 'zone';
  conditions.status = 1;
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return locationModel
    .find(conditions)
    .then(result => {
      if (result.length === 0) {
        const resultData = {};
        for (const i in thingsToMatch) {
          resultData[thingsToMatch[i]] = [];
        }
        return bluebirdPromise.reject([resultData]);
      }
      for (const i in result) {
        result[i] = zoneHelper.formatResponse(result[i]);
      }
      return result;
    })
    .then(result => {
      const locationIdList = [];
      const floorIdList = [];
      for (const i in result) {
        if ((result[i].ancestors[1] || {}).id) {
          locationIdList.push(`${result[i].ancestors[1].id}`);
          floorIdList.push(`${result[i].ancestors[0].id}`);
        }
      }
      // console.log(locationIdList);
      return bluebirdPromise
        .all([
          bluebirdPromise.map(locationIdList, locationId =>
            locationHelper.getById(locationId).catch(reason => {
              if (reason instanceof Error) {
                // console.log(reason);
              }
              return false;
            })
          ),

          bluebirdPromise.map(floorIdList, locationId =>
            floorHelper.getById(locationId).catch(reason => {
              if (reason instanceof Error) {
                // console.log(reason);
              }
              return false;
            })
          )
        ])
        .then(result => [...result[0], ...result[1]])
        .then(parentListIfExist => {
          const mappedParentList = {};
          for (const i in parentListIfExist) {
            if (parentListIfExist[i]) {
              mappedParentList[parentListIfExist[i].id] = parentListIfExist[i];
            }
          }
          return mappedParentList;
        })
        .then(mappedParentList => {
          // console.log(mappedParentList);
          const results = [];
          for (const i in result) {
            result[i].parentInfo = {};
            result[i].parentInfo.location = mappedParentList[`${result[i].ancestors[1].id}`];
            result[i].parentInfo.floor = mappedParentList[`${result[i].ancestors[0].id}`];
            results.push(result[i]);
          }
          return results;
        });
    })
    .then(result => this.formatZoneData(result, thingsToMatch))
    .catch(reason => {
      if (Array.isArray(reason)) {
        return reason[0];
      }
      return bluebirdPromise.reject(reason);
    });
};

module.exports = new findZoneHelper();
