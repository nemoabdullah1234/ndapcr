/*jshint esversion: 6 */
'use strict';
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const subdocuments = require('./subdocuments');
const GeoJSON = require('mongoose-geojson-schema');
const clientHandler = require('../lib/clientHandler');
const auditTrail = require('../helpers/auditTrail');
const ProductTemperatureSchema = new Schema({
  client: subdocuments.Client,
  product: subdocuments.Products,
  temperature: {
    _id: false,
    startTime: { type: Date },
    endTime: { type: Date },
    breachCount: { type: Number },
    breachDuration: { type: Number },
    breaches: { type: Schema.Types.Mixed }, 
    lastRecordedTemp: { type: Number },
    minRecordedTemp: { type: Number },
    maxRecordedTemp: { type: Number },
    avgTemp: { type: Number },
    kineticMeanTemp: { type: Number },
    totalDuration: { type: Number }
  },
  sensor: subdocuments.Things,
  device: {
    _id: false,
    id: Schema.Types.ObjectId,
    code: { type: String },
    name: { type: String },
    type: { type: String },
    manufacturer: { type: String },
    appName: { type: String },
    os: { type: String },
    model: { type: String },
    version: { type: String },
    appVersion: { type: String }
  },
  pointId: { type: String },
  lastTracked: { type: Date }
});

// ProductTemperatureSchema.plugin(auditTrail.auditTrail, { model: 'ProductTracking' });

ProductTemperatureSchema.pre('find', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

ProductTemperatureSchema.pre('count', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

let productTemperatureModel;

try {
  productTemperatureModel = mongoose.model('productTemperature');
} catch (error) {
  productTemperatureModel = mongoose.model('productTemperature', ProductTemperatureSchema);
}

module.exports = productTemperatureModel;
