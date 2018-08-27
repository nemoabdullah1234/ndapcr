/* jshint esversion: 6 */

const timezonemodel = require('../models/timezone');
const bluebirdPromise = require('bluebird');
const mongoose = require('mongoose');

const timezoneService = function() {};
/**
 * Fetch all time zones from databse
 * 
 * @param {Void}
 * @return {Void}
 * 
 */

timezoneService.prototype.getTimezones = function() {
  return timezonemodel
    .find()
    .sort({
      Name: 1
    })
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
 * Fetch count of all time zones from databse
 * 
 * @param {Object} filters filters are condition based on which time zones are retured
 * @return {Number} count of time zones 
 * 
 */
timezoneService.prototype.countTimezones = function(filters = {}) {
  return timezonemodel.count(filters).exec();
};
/**
 * Formatt response to standard format
 * 
 * @param {Object} data raw data from DB
 * @return {Object} formattedResponse  data formatted in standard respnse form
 * 
 */
timezoneService.prototype.formatResponse = function(data) {
  const formattedResponse = {};
  formattedResponse.id = data.id;
  formattedResponse.name = data.Name;
  formattedResponse.offset = data.Offset;

  return formattedResponse;
};

/**
 * Fetch a particular Datetime format by providing its ID
 * 
 * @param {String} DatetimeId ID of the attribute to Fetch
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
timezoneService.prototype.getById = function(timezoneId = 'default') {
  const conditions = {
    _id: mongoose.Types.ObjectId(timezoneId)
  };

  return timezonemodel
    .find(conditions)
    .exec()
    .then(result => {
      if (result.length > 0) {
        return bluebirdPromise.resolve(this.formatResponse(result[0]));
      }
      return bluebirdPromise.reject('Timezone not found');
    });
};
module.exports = new timezoneService();
