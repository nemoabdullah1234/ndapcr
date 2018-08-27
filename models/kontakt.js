/*jshint esversion: 6 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const auditTrail = require('../helpers/auditTrail');

const KontaktSchema = new Schema({
  placeId: { type: String },
  managerId: { type: String },
  uid: { type: String },
  updatedOn: { type: Date, default: Date.now() }
});

KontaktSchema.plugin(auditTrail.auditTrail, { model: 'kontakt' });

let kontaktModel;

try {
  kontaktModel = mongoose.model('kontakt');
} catch (error) {
  kontaktModel = mongoose.model('kontakt', KontaktSchema);
}

module.exports = kontaktModel;
