/* jshint esversion: 6 */

const countrymodel = require('../models/country');
const bluebirdPromise = require('bluebird');

const countryService = function() {};
/**
 * Get country list 
 * 
 * @param {Void}
 * @return {Array} Array of country object with 'shortCode','dialCode','name' 
 * 
 * 
 */

countryService.prototype.getCountries = function() {
  return countrymodel
    .find()
    .sort({ Name: 1 })
    .collation({
      locale: 'en_US',
      caseLevel: false
    })
    .exec()
    .then(result => {
      const list = [];
      if (result) {
        for (let i = 0; i < result.length; i++) {
          list.push(this.formatResponse(result[i]));
        }
      }
      return list;
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};
/**
 * Get country list 
 * 
 * @param {Void}
 * @return {number} Number of countries in db 
 * 
 * 
 */
countryService.prototype.count = function() {
  return countrymodel.count().exec();
};
/**
 * Get country list 
 * 
 * @param {Object} data country object from database
 * @return {Object} Formatted country object in standard response format 
 *  
 */
countryService.prototype.formatResponse = function(data) {
  const formattedResponse = {};
  formattedResponse.shortCode = data.ShortCode;
  formattedResponse.dialCode = data.DialCode;
  formattedResponse.name = data.Name;

  return formattedResponse;
};

countryService.prototype.getDialCodeFromShortCode = function(shortCode) {
  return countrymodel
    .findOne({
      ShortCode: shortCode
    })
    .then(result => (result || {}).DialCode || '');
};

module.exports = new countryService();
