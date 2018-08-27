/*jshint esversion: 6 */
'use strict';
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const subdocuments = require('./subdocuments');
const auditTrail = require('../helpers/auditTrail');
const clientHandler = require('../lib/clientHandler');

const AppStatusSchema = new Schema({
  deviceCode: { type: String },
  appName: { type: String },
  status: [
    {
      _id: false,
      statusTime: { type: Date, default: new Date() },
      gps: { type: Number },
      bluetooth: { type: Number },
      beaconService: { type: Number }
    }
  ],
  updatedBy: subdocuments.User,
  updatedOn: { type: Date, default: new Date() },
  client: subdocuments.Client
});

AppStatusSchema.pre('find', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

AppStatusSchema.pre('count', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

AppStatusSchema.plugin(auditTrail.auditTrail, { model: 'appStatus' });

let appStatusModel;

try {
  appStatusModel = mongoose.model('appStatus');
} catch (error) {
  appStatusModel = mongoose.model('appStatus', AppStatusSchema);
}

module.exports = appStatusModel;
