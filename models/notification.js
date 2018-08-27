/* jshint esversion: 6 */

const mongoose = require('mongoose');

const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const subdocuments = require('./subdocuments');
const auditTrail = require('../helpers/auditTrail');
const clientHandler = require('../lib/clientHandler');

const NotificationSchema = new Schema(
  {
    insertedOn: { type: Date, default: Date.now() },
    type: String,
    title: String,
    message: String,
    params: Schema.Types.Mixed,
    recieverData: Schema.Types.Mixed,
    recieverUserData: subdocuments.User,
    archived: Boolean,
    isForWeb: Boolean,
    read: Boolean,
    pushNotified: Boolean,
    emailNotified: Boolean,
    client: subdocuments.Client,
    actionBy: subdocuments.UpdatedBy
  },
  { minimize: false }
);

NotificationSchema.pre('find', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

NotificationSchema.pre('count', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

let notificationModel;

try {
  notificationModel = mongoose.model('notifications');
} catch (error) {
  notificationModel = mongoose.model('notifications', NotificationSchema);
}

module.exports = notificationModel;
