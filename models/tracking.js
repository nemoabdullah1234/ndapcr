

const mongoose = require('mongoose');
const GeoJSON = require('mongoose-geojson-schema');

let Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const subdocuments = require('./subdocuments');
// const auditTrail = require('../helpers/auditTrail');

const TrackingSchema = new Schema(
  {
    client: subdocuments.Client,
    pointId: { type: String },
    did: { type: String },
    pkid: { type: String },
    alt: { type: Number },
    spd: { type: Number },
    dir: { type: Number },
    acc: { type: Number },
    prv: { type: String },
    ts: { type: Number },
    sensors: {
      uid: { type: String },
      type: { type: String },
      uuid: { type: String },
      maj: { type: Number },
      min: { type: Number },
      rng: { type: Number },
      dis: { type: Number },
      rssi: { type: Number },
      id: Schema.Types.ObjectId,
      name: { type: String },
      code: { type: String },
      product: subdocuments.Products,
      shipment: subdocuments.Shipment,
      device: subdocuments.Things,
      user: {
        id: Schema.Types.ObjectId,
        name: { type: String },
        code: { type: String }
      }
    },
    location: {
      addresses: {
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
      }
    },
    locationEntry: {type: Boolean},
    locationExit: {type: Boolean},
    zoneEntry: {type: Boolean},
    zoneExit: {type: Boolean},
    ht: { type: Date },
    locStrmTm: { type: Date },
    trLbdTm: { type: Date },
    ptLbdTm: { type: Date },
    blStrmTm: { type: Date },
    kinTrLbdTm: { type: Date },
    pdTrLbdTm: { type: Date },
    deviceInfo: {
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
    trackedAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { collection: 'tracking' }
);

// TrackingSchema.plugin(auditTrail.auditTrail,{ "model" : "Tracking"});

let trackingModel;

try {
  trackingModel = mongoose.model('tracking');
} catch (e) {
  trackingModel = mongoose.model('tracking', TrackingSchema);
}

module.exports = trackingModel;
