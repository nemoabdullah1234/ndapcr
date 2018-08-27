/*jshint esversion: 6 */
'use strict';
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const subdocuments = require('./subdocuments');
const auditTrail = require('../helpers/auditTrail');
const clientHandler = require('../lib/clientHandler');

const AppSchema = new Schema({
  app: String,
  device: {
    id: mongoose.Schema.Types.ObjectId,
    code: String,
    name: String
  },
  details: [subdocuments.Attributes],
  client: subdocuments.Client
});

// DeviceSchema.pre('find', function() {
//   this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
// });

// DeviceSchema.pre('count', function() {
//   this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
// });

// DeviceSchema.plugin(auditTrail.auditTrail,{ "model" : "device"});

let appModel;

try {
  appModel = mongoose.model('app');
} catch (error) {
  appModel = mongoose.model('app', AppSchema);
}

module.exports = appModel;
