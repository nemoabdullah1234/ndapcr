'use strict';
const mongoose = require('mongoose');
const GeoJSON = require('mongoose-geojson-schema');

var Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
//const auditTrail = require('../helpers/auditTrail');

const PointsThingsSchema = new Schema(
  {
    projectid: { type: String },
    clientid: { type: String },
    pid: Schema.Types.ObjectId,
    did: { type: String },
    pkid: { type: String },
    alt: { type: Number },
    spd: { type: Number },
    dir: { type: Number },
    acc: { type: Number },
    prv: { type: String },
    ts: { type: Number },
    sensors: {
      uuid: { type: String },
      maj: { type: Number },
      min: { type: Number },
      rng: { type: Number },
      dis: { type: Number },
      rssi: { type: Number },
      id: { type: String },
      name: { type: String },
      code: { type: String }
    },
    location: Schema.Types.Point,
    locationdetails: [
      {
        locationId: { type: String },
        name: { type: String },
        city: { type: String },
        state: { type: String },
        address: { type: String },
        country: { type: String },
        zipcode: { type: String },
        lat: { type: Number },
        lon: { type: Number }
      }
    ],
    ht: { type: Date },
    dt: { type: Date },
    tsdt: { type: Date },
    locStrmTm: { type: Date },
    trLbdTm: { type: Date },
    ptLbdTm: { type: Date },
    deviceInfo: {
      id: { type: String },
      name: { type: String },
      code: { type: String },
      type: { type: String }
    }
  },
  { collection: 'pointsThings' }
);

let pointsThingsModel;

try {
  pointsThingsModel = mongoose.model('pointsThings');
} catch (e) {
  pointsThingsModel = mongoose.model('pointsThings', PointsThingsSchema);
}

module.exports = pointsThingsModel;
