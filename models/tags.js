/*jshint esversion: 6 */
'use strict';
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const subdocuments = require('./subdocuments');
const propogationHelper = require('../helpers/propogationHelper');
const auditTrail = require('../helpers/auditTrail');
const clientHandler = require('../lib/clientHandler');

const tagSchema = new Schema({
  name: String,
  sysDefined: { type: Number, default: 0 },
  status: Number,
  updatedBy: subdocuments.UpdatedBy,
  updatedOn: { type: Date, default: Date.now() },
  client: subdocuments.Client
});

tagSchema.pre('find', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

tagSchema.pre('count', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

tagSchema.post('findOneAndUpdate', function(result, next) {
  propogationHelper
    .propagate({ hook: 'findOneAndUpdate', collection: 'tags', result: result })
    .then(() => {
      next();
    })
    .catch(() => {
      // console.log('Error encountered while propagating changes');
      next();
    });
});

tagSchema.plugin(auditTrail.auditTrail, { model: 'tags' });

let tagModel;

try {
  tagModel = mongoose.model('tags');
} catch (error) {
  tagModel = mongoose.model('tags', tagSchema);
}

module.exports = tagModel;
