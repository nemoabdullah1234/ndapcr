/* jshint esversion: 6 */

const productmodel = require('../../models/product');
const locationmodel = require('../../models/location');
const mongoose = require('mongoose');
const commonHelper = require('../common');
const bluebirdPromise = require('bluebird');
const locationCore = require('../core/location');

const productService = function() {};

productService.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

productService.prototype.getProductsAtLocation = function(query) {
  return productmodel.find({
    'trackingDetails.currentLocation.name': { $regex: new RegExp(query, 'i') }
  });
};

module.exports = new productService();
