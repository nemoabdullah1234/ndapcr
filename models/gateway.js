/*jshint esversion: 6 */
"use strict";
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const subdocuments = require('./subdocuments');
const auditTrail = require('../helpers/auditTrail');
const clientHandler = require('../lib/clientHandler');

var GatewaySchema = new Schema({
  code: { type: String },
  name: { type: String },
  status: { type: Number },
  updatedBy: subdocuments.UpdatedBy,
  updatedOn: { type: Date, default: Date.now() },
  client: subdocuments.Client,
  tags: [subdocuments.Tags],
  attributes: [subdocuments.Attributes],
  categories: [subdocuments.Categories],
  });

GatewaySchema.pre('find', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

GatewaySchema.pre('count', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

GatewaySchema.plugin(auditTrail.auditTrail,{ "model" : "gateway"});

let gatewayModel;
try {
  gatewayModel = mongoose.model('gateway');
} catch (error) {
  gatewayModel = mongoose.model('gateway', GatewaySchema);
}

module.exports = gatewayModel;
