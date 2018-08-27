/*jshint esversion: 6 */
'use strict';
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const clientHandler = require('../lib/clientHandler');
const subdocuments = require('./subdocuments');

const AuditTrailSchema = new Schema({
  model: { type: String },
  actionType: { type: String },
  object: Schema.Types.Mixed,
  actionTime: { type: Date, default: Date.now },
  client: subdocuments.Client,
  actionBy: subdocuments.UpdatedBy
});

AuditTrailSchema.pre('find', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

AuditTrailSchema.pre('count', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

let auditTrailModel;

try {
  auditTrailModel = mongoose.model('auditTrail');
} catch (error) {
  auditTrailModel = mongoose.model('auditTrail', AuditTrailSchema);
}

module.exports = auditTrailModel;
