/*jshint esversion: 6 */
'use strict';
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const subdocuments = require('./subdocuments');
const auditTrail = require('../helpers/auditTrail');
const clientHandler = require('../lib/clientHandler');

const DeviceSchema = new Schema({
  code: { type: String },
  name: { type: String },
  sysDefined: { type: Number },
  status: { type: Number },
  updatedOn: { type: Date, default: Date.now() },
  attributes: [subdocuments.Attributes],
  updatedBy: subdocuments.UpdatedBy,
  client: subdocuments.Client,
  tags: [subdocuments.Tags]
});

DeviceSchema.pre('find', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

DeviceSchema.pre('count', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

DeviceSchema.plugin(auditTrail.auditTrail, { model: 'device' });

let deviceModel;

try {
  deviceModel = mongoose.model('device');
} catch (error) {
  deviceModel = mongoose.model('device', DeviceSchema);
}

module.exports = deviceModel;
