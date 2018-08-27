/* jshint esversion: 6 */

const mongoose = require('mongoose');

const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const subdocuments = require('./subdocuments');
const auditTrail = require('../helpers/auditTrail');
const clientHandler = require('../lib/clientHandler');

const AppSettingsSchema = new Schema({
  user: subdocuments.User,
  appName: { type: String },
  dashboardDefaultView: { type: String },
  dashboardSortBy: { type: String },
  dashboardSortOrder: { type: String },
  silentHrsFrom: { type: Date },
  silentHrsTo: { type: Date },
  notifications: { type: Boolean },
  sound: { type: Boolean },
  vibration: { type: Boolean },
  led: { type: Boolean },
  getEmailNotifications: { type: Boolean },
  beaconServiceStatus: { type: Boolean },
  updatedOn: { type: Date, default: Date.now() },
  trackingHours: Schema.Types.Mixed,
  emergencyContacts: Schema.Types.Mixed,
  updatedBy: subdocuments.UpdatedBy,
  client: subdocuments.Client
});

AppSettingsSchema.pre('find', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

AppSettingsSchema.pre('count', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

AppSettingsSchema.plugin(auditTrail.auditTrail, { model: 'appSettings' });

let appSettingsModel;

try {
  appSettingsModel = mongoose.model('appSettings');
} catch (error) {
  appSettingsModel = mongoose.model('appSettings', AppSettingsSchema);
}

module.exports = appSettingsModel;
