'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const subdocuments = require('./subdocuments');
const clientHandler = require('../lib/clientHandler');

const syncjobSchema = new Schema({
  jobtype: String,
  syncstarted: { type: Date, default: Date.now },
  syncstatus: Number,
  cursor: Number,
  itemprocessed: Number,
  iteminserted: Number,
  itemscreated: Number,
  client: subdocuments.Client,
  updatedBy: subdocuments.UpdatedBy,
  updatedOn: { type: Date, default: Date.now() }
});

let syncjobModel;

syncjobSchema.pre('find', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

syncjobSchema.pre('count', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

try {
  syncjobModel = mongoose.model('syncjobs');
} catch (error) {
  syncjobModel = mongoose.model('syncjobs', syncjobSchema);
}

module.exports = syncjobModel;
