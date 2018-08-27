/* jshint esversion: 6 */

const mongoose = require('mongoose');

const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const subdocuments = require('./subdocuments');
const propogationHelper = require('../helpers/propogationHelper');
const auditTrail = require('../helpers/auditTrail');
const clientHandler = require('../lib/clientHandler');

const ThingsSchema = new Schema({
  code: { type: String },
  name: { type: String },
  status: { type: Number },
  type: { type: String },
  updatedBy: subdocuments.UpdatedBy,
  updatedOn: { type: Date, default: Date.now() },
  client: subdocuments.Client,
  tags: [subdocuments.Tags],
  attributes: [subdocuments.Attributes],
  categories: [subdocuments.Categories],
  product: subdocuments.Products,
  location: subdocuments.Zone,
  hasDuplicateUniqueIdentifiers: { type: Boolean, default: false }
});

ThingsSchema.pre('find', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

ThingsSchema.pre('count', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

ThingsSchema.plugin(auditTrail.auditTrail, { model: 'things' });

ThingsSchema.post('findOneAndUpdate', (result, next) => {
  propogationHelper
    .propagate({ hook: 'findOneAndUpdate', collection: 'things', result })
    .then(() => {
      next();
    })
    .catch(() => {
      // console.log('Error encountered while propagating changes');
      next();
    });
});
let thingsModel;

try {
  thingsModel = mongoose.model('things');
} catch (error) {
  thingsModel = mongoose.model('things', ThingsSchema);
}

module.exports = thingsModel;
