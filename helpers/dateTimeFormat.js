/* jshint esversion: 6 */

const dateTimeFormatmodel = require('../models/dateTimeFormat');
const bluebirdPromise = require('bluebird');
const mongoose = require('mongoose');

const dateTimeFormatService = function() {};
/**
 * Fetch all time zones from databse
 * 
 * @param {Void}
 * @return {Void}
 * 
 */

dateTimeFormatService.prototype.getdateTimeFormats = function() {
  return dateTimeFormatmodel
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
dateTimeFormatService.prototype.countdateTimeFormats = function(filters = {}) {
  return dateTimeFormatmodel.count(filters).exec();
};
/**
 * dateTimeFormatt response to standard dateTimeFormat
 * 
 * @param {Object} data raw data from DB
 * @return {Object} dateTimeFormattedResponse  data dateTimeFormatted in standard respnse form
 * 
 */
dateTimeFormatService.prototype.formatResponse = function(data) {
  const dateTimeFormattedResponse = {};
  dateTimeFormattedResponse.id = data._id;
  dateTimeFormattedResponse.name = data.name;
  dateTimeFormattedResponse.code = data.code;
  dateTimeFormattedResponse.example = data.example;

  return dateTimeFormattedResponse;
};

/**
 * Fetch a particular Datetime format by providing its ID
 * 
 * @param {String} DatetimeId ID of the attribute to Fetch
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
dateTimeFormatService.prototype.getById = function(dateTimeId = 'default') {
  const conditions = {
    _id: mongoose.Types.ObjectId(dateTimeId)
  };

  return dateTimeFormatmodel
    .find(conditions)
    .exec()
    .then(result => {
      if (result.length > 0) {
        return bluebirdPromise.resolve(this.formatResponse(result[0]));
      }
      return bluebirdPromise.reject('Date Time Format not found');
    });
};
module.exports = new dateTimeFormatService();
