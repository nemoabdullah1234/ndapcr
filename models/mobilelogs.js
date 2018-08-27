"use strict";
const mongoose = require('mongoose');

var Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
//const auditTrail = require('../helpers/auditTrail');

var MobileLogsSchema = new Schema({
  projectid: { type: String },
  clientid: { type: String },
  filename: { type: String },
  app: { type: String },
  filedt: { type: String },
  did: { type: String },
  uuid: { type: String },
  maj: { type: Number },
  min: { type: Number },
  rng: { type: Number },
  lat: { type: Number },
  lon: { type: Number },
  acc: { type: Number },
  spd: { type: Number },
  alt: { type: String },
  dir: { type: Number },
  ts: { type: Number },
  prv: { type: String },
  localts: { type: String },
  mqttts: { type: Number },
  logts: { type: Number },
  batt: { type: String },
  ble: { type: String },
  gps: { type: String },
  wifi: { type: String },
  pkid: { type: String },
  code: { type: String },
  message: { type: String },
  ack: { type: String },
  dt: { type: Date }
}, {collection : "mobilelogs"});

let mobileLogsModel;


try {
  mobileLogsModel = mongoose.model('mobilelogs');
} catch(e) {
  mobileLogsModel = mongoose.model('mobilelogs', MobileLogsSchema);
}

module.exports = mobileLogsModel;
