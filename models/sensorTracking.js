/* jshint esversion: 6 */

const mongoose = require('mongoose');

const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const subdocuments = require('./subdocuments');
const GeoJSON = require('mongoose-geojson-schema');
const clientHandler = require('../lib/clientHandler');
// const auditTrail = require('../helpers/auditTrail');

const SensorTrackingSchema = new Schema(
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
    pointId: { type: String },
    lastTracked: { type: Date },
    lastMoved: { type: Date }
  },
  { minimize: false }
);
// DeviceTrackingSchema.plugin(auditTrail.auditTrail, { model: 'DeviceTracking' });

SensorTrackingSchema.pre('find', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

SensorTrackingSchema.pre('count', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

let sensorTrackingModel;

try {
  sensorTrackingModel = mongoose.model('sensorTracking');
} catch (error) {
  sensorTrackingModel = mongoose.model('sensorTracking', SensorTrackingSchema);
}

module.exports = sensorTrackingModel;
