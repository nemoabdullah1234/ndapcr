/*jshint esversion: 6 */
'use strict';
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const subdocuments = require('./subdocuments');
const clientHandler = require('../lib/clientHandler');
const ProductTemperatureHistorySchema = new Schema({
  client: subdocuments.Client,
  product: subdocuments.Products,
  trackingId: Schema.Types.ObjectId,
  recordedTemp: { type: Number },
  scanTime: { type: Date }
});

ProductTemperatureHistorySchema.pre('find', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

ProductTemperatureHistorySchema.pre('count', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

let productTemperatureHistoryModel;

try {
  productTemperatureHistoryModel = mongoose.model('productTemperatureHistory');
} catch (error) {
  productTemperatureHistoryModel = mongoose.model('productTemperatureHistory', ProductTemperatureHistorySchema);
}

module.exports = productTemperatureHistoryModel;
