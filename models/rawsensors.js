'use strict';
const mongoose = require('mongoose');
const GeoJSON = require('mongoose-geojson-schema');

var Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
//const auditTrail = require('../helpers/auditTrail');

const RawSensorsSchema = new Schema(
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
    sensors: 
    {
      uuid: { type: String },
      maj: { type: Number },
      min: { type: Number },
      rng: { type: Number },
      dis: { type: Number },
      rssi: { type: Number }
    },
    hit: { type: Date },
    dt: { type: Date },
    tsdt: { type: Date },
    locStrmTm: { type: Date },
    trLbdTm: { type: Date },
    ptLbdTm: { type: Date }
  },
  { collection: 'rawsensors' }
);

let rawSensorsModel;

try {
  rawSensorsModel = mongoose.model('rawsensors');
} catch (e) {
  rawSensorsModel = mongoose.model('rawsensors', RawSensorsSchema);
}

module.exports = rawSensorsModel;
