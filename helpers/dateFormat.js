/* jshint esversion: 6 */

const dateFormatmodel = require('../models/dateFormat');
const bluebirdPromise = require('bluebird');
const mongoose = require('mongoose');

const dateFormatService = function() {};
/**
 * Fetch all time zones from databse
 * 
 * @param {Void}
 * @return {Void}
 * 
 */

dateFormatService.prototype.getdateFormats = function() {
  return dateFormatmodel
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
dateFormatService.prototype.countdateFormats = function(filters = {}) {
  return dateFormatmodel.count(filters).exec();
};
/**
 * dateFormatt response to standard dateFormat
 * 
 * @param {Object} data raw data from DB
 * @return {Object} dateFormattedResponse  data dateFormatted in standard respnse form
 * 
 */
dateFormatService.prototype.formatResponse = function(data) {
  const dateFormattedResponse = {};
  dateFormattedResponse.id = data._id;
  dateFormattedResponse.name = data.name;
  dateFormattedResponse.code = data.code;
  dateFormattedResponse.example = data.example;

  return dateFormattedResponse;
};

/**
 * Fetch a particular Date format by providing its ID
 * 
 * @param {String} dateformatId ID of the attribute to Fetch
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
dateFormatService.prototype.getById = function(dateId = 'default') {
  const conditions = {
    _id: mongoose.Types.ObjectId(dateId)
  };

  return dateFormatmodel
    .find(conditions)
    .exec()
    .then(result => {
      if (result.length > 0) {
        return bluebirdPromise.resolve(this.formatResponse(result[0]));
      }
      return bluebirdPromise.reject('Date format not found');
    });
};

module.exports = new dateFormatService();
