'use strict';
const mongoose = require('mongoose');
const GeoJSON = require('mongoose-geojson-schema');

var Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
//const auditTrail = require('../helpers/auditTrail');

const PointsSchema = new Schema(
  {
    projectid: { type: String },
    clientid: { type: String },
    did: { type: String },
    pkid: { type: String },
    alt: { type: Number },
    spd: { type: Number },
    dir: { type: Number },
    acc: { type: Number },
    prv: { type: String },
    ts: { type: Number },
    sensors: [
      {
        uuid: { type: String },
        maj: { type: Number },
        min: { type: Number },
        rng: { type: Number },
        dis: { type: Number },
        rssi: { type: Number },
        id: { type: String },
        name: { type: String },
        code: { type: String }
      }
    ],
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
    hit: { type: Date },
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
    },
    discarded: { type: Boolean },
    discardedType: { type: String },
    discardedInfo: {
      fieldName: { type: String },
      fieldValue: { type: Schema.Types.Mixed }
    }
  },
  { collection: 'points' }
);

let pointsModel;

try {
  pointsModel = mongoose.model('points');
} catch (e) {
  pointsModel = mongoose.model('points', PointsSchema);
}

module.exports = pointsModel;
