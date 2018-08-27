/*jshint esversion: 6 */
'use strict';
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const subdocuments = require('./subdocuments');
const auditTrail = require('../helpers/auditTrail');
const clientHandler = require('../lib/clientHandler');

const KollectionSchema = new Schema({
  code: { type: String },
  name: { type: String },
  type: { type: String },
  sysDefined: { type: Number },
  status: { type: Number },
  updatedOn: { type: Date, default: Date.now() },
  updatedBy: subdocuments.UpdatedBy,
  parent: String,
  seoName: String,
  client: subdocuments.Client,
  tags: [subdocuments.Tags],
  ancestors: [subdocuments.Ancestors],
  items: [subdocuments.Items]
});

KollectionSchema.pre('find', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

KollectionSchema.pre('count', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

KollectionSchema.plugin(auditTrail.auditTrail, { model: 'collections' });
let collectionModel;

try {
  collectionModel = mongoose.model('kollection');
} catch (error) {
  collectionModel = mongoose.model('kollection', KollectionSchema);
}

module.exports = collectionModel;
