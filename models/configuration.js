/* jshint esversion: 6 */

const mongoose = require('mongoose');

const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const subdocuments = require('./subdocuments');
const auditTrail = require('../helpers/auditTrail');
const clientHandler = require('../lib/clientHandler');

const ConfigurationSchema = new Schema({
  date: {
    _id: false,
    id: Schema.Types.ObjectId,
    code: { type: String },
    name: { type: String }
  },
  dateTime: {
    _id: false,
    id: Schema.Types.ObjectId,
    code: { type: String },
    name: { type: String }
  },
  timezone: {
    _id: false,
    id: Schema.Types.ObjectId,
    name: { type: String },
    Offset: { type: String }
  },
  pagination: { type: Number },
  isAutoDeliveryMode: {
    type: Boolean,
    default: true
  },
  isAutoShipMode: {
    type: Boolean,
    default: true
  },
  stationaryShipmentTimeSeconds: {
    type: Number,
    default: 600
  },
  autocloseorder: {
    type: Boolean,
    default: false
  },
  autocloseorderafter: {
    type: Number,
    default: 0
  },
  autocloseshipment: {
    type: Boolean,
    default: false
  },
  autocloseshipmentafter: {
    type: Number,
    default: 0
  },
  kontaktSyncTimeSeconds: {
    type: Number,
    default: 120
  },
  measurement: { type: String },
  temperatureUnit: { type: String },
  kontaktApiKey: { type: String, default: '' },
  updatedOn: { type: Date, default: Date.now() },
  updatedBy: subdocuments.UpdatedBy,
  client: subdocuments.Client
});

ConfigurationSchema.pre('find', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

ConfigurationSchema.pre('count', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

ConfigurationSchema.plugin(auditTrail.auditTrail, { model: 'configurations' });

let configurationModel;

try {
  configurationModel = mongoose.model('configuration');
} catch (error) {
  configurationModel = mongoose.model('configuration', ConfigurationSchema);
}

module.exports = configurationModel;
