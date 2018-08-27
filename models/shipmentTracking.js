/*jshint esversion: 6 */
"use strict";
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const subdocuments = require('./subdocuments');
const GeoJSON = require('mongoose-geojson-schema');
const clientHandler = require('../lib/clientHandler');
const auditTrail = require('../helpers/auditTrail');
const ShipmentTrackingSchema = new Schema({
  client: subdocuments.Client,
  shipment: subdocuments.Shipment,
  currentLocation: {
    id: Schema.Types.ObjectId,
    code: { type: String },
    name: { type: String },
    pointCoordinates: Schema.Types.Point,
    address: [subdocuments.Attributes],
    zones:
    {
      id: Schema.Types.ObjectId,
      code: { type: String },
      name: { type: String },
      thing: subdocuments.Things,
    },
    floor : 
    {
      id: Schema.Types.ObjectId,
      code: { type: String },
      name: { type: String }
    }
  },
  sensor: subdocuments.Things,
  device: {
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
  lastTracked: { type: Date },
  lastMoved: { type: Date }
});


// ShipmentTrackingSchema.pre('find', function() {
//   this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
// });

// ShipmentTrackingSchema.pre('count', function() {
//   this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
// });

ShipmentTrackingSchema.plugin(auditTrail.auditTrail, { model: 'ShipmentTracking' });

let shipmentTrackingModel;

try {
  shipmentTrackingModel = mongoose.model('shipmentTracking');
} catch (error) {
  shipmentTrackingModel = mongoose.model('shipmentTracking', ShipmentTrackingSchema);
}

module.exports = shipmentTrackingModel;
