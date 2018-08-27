/*jshint esversion: 6 */
'use strict';
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const subdocuments = require('./subdocuments');
const GeoJSON = require('mongoose-geojson-schema');
const clientHandler = require('../lib/clientHandler');
const auditTrail = require('../helpers/auditTrail');
const UserTrackingSchema = new Schema(
  {
    client: subdocuments.Client,
    user: {
      id: Schema.Types.ObjectId,
      code: { type: String },
      name: { type: String }
    },
    currentLocation: {
      _id: false,
      id: Schema.Types.ObjectId,
      code: { type: String },
      name: { type: String },
      pointCoordinates: Schema.Types.Point,
      address: [subdocuments.Attributes],
      zones: {
        id: Schema.Types.ObjectId,
        code: { type: String },
        name: { type: String },
        thing: subdocuments.Things
      },
      floor: {
        id: Schema.Types.ObjectId,
        code: { type: String },
        name: { type: String }
      }
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
    lastTracked: { type: Date },
    lastRecordedTemp: { type: Number },
    lastMoved: { type: Date }
  },
  { minimize: false }
);

// UserTrackingSchema.plugin(auditTrail.auditTrail, { model: 'UserTracking' });

UserTrackingSchema.pre('find', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

UserTrackingSchema.pre('count', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

let userTrackingModel;

try {
  userTrackingModel = mongoose.model('userTracking');
} catch (error) {
  userTrackingModel = mongoose.model('userTracking', UserTrackingSchema);
}

module.exports = userTrackingModel;
