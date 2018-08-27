/*jshint esversion: 6 */
'use strict';
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const subdocuments = require('./subdocuments');
const clientHandler = require('../lib/clientHandler');
// const auditTrail = require('../helpers/auditTrail');
const LoginHistorySchema = new Schema(
  {
    client: subdocuments.Client,
    user: {
      id: Schema.Types.ObjectId,
      code: { type: String },
      name: { type: String }
    },
    sensor: subdocuments.Things,
    device: subdocuments.DeviceInfo,
    loginTime: { type: Date },
    logoutTime: { type: Date }
  },
  { minimize: false }
);

// LoginHistorySchema.plugin(auditTrail.auditTrail, { model: 'LoginHistory' });

LoginHistorySchema.pre('find', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

LoginHistorySchema.pre('count', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

let loginHistoryModel;

try {
  loginHistoryModel = mongoose.model('loginHistory');
} catch (error) {
  loginHistoryModel = mongoose.model('loginHistory', LoginHistorySchema);
}

module.exports = loginHistoryModel;
