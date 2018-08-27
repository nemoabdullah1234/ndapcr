/*jshint esversion: 6 */
'use strict';
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const subdocuments = require('./subdocuments');
const propogationHelper = require('../helpers/propogationHelper');
const auditTrail = require('../helpers/auditTrail');
const clientHandler = require('../lib/clientHandler');

const AttributeSchema = new Schema({
  code: { type: String },
  name: { type: String },
  sysDefined: { type: Number },
  status: { type: Number },
  updatedOn: { type: Date, default: Date.now() },
  updatedBy: subdocuments.UpdatedBy,
  client: subdocuments.Client,
  tags: [subdocuments.Tags]
});

AttributeSchema.pre('find', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

AttributeSchema.pre('count', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

AttributeSchema.plugin(auditTrail.auditTrail, { model: 'attributes' });

AttributeSchema.post('findOneAndUpdate', function(result, next) {
  propogationHelper
    .propagate({ hook: 'findOneAndUpdate', collection: 'attribute', result: result })
    .then(() => {
      next();
    })
    .catch(() => {
      // console.log('Error encountered while propagating changes');
      next();
    });
});

let attributeModel;

try {
  attributeModel = mongoose.model('attribute');
} catch (error) {
  attributeModel = mongoose.model('attribute', AttributeSchema);
}

module.exports = attributeModel;
