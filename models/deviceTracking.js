/* jshint esversion: 6 */

const mongoose = require('mongoose');

const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const subdocuments = require('./subdocuments');
const GeoJSON = require('mongoose-geojson-schema');
const clientHandler = require('../lib/clientHandler');
const auditTrail = require('../helpers/auditTrail');

const DeviceTrackingSchema = new Schema(
  {
    client: subdocuments.Client,
    currentLocation: {
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
    device: subdocuments.Things,
    isReporting: { type: Number },
    pointId: { type: String },
    lastTracked: { type: Date },
    lastMoved: { type: Date }
  },
  { minimize: false }
);
// DeviceTrackingSchema.plugin(auditTrail.auditTrail, { model: 'DeviceTracking' });

DeviceTrackingSchema.pre('find', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

DeviceTrackingSchema.pre('count', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

let deviceTrackingModel;

try {
  deviceTrackingModel = mongoose.model('deviceTracking');
} catch (error) {
  deviceTrackingModel = mongoose.model('deviceTracking', DeviceTrackingSchema);
}

module.exports = deviceTrackingModel;
