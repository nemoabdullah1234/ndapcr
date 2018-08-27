/* jshint esversion: 6 */
const mongoose = require('mongoose');

const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const subdocuments = require('./subdocuments');
const auditTrail = require('../helpers/auditTrail');

const AvailableGadgetSchema = new Schema({
  client: subdocuments.Client,
  gadgets: [subdocuments.AvailableGadgets]
});

AvailableGadgetSchema.plugin(auditTrail.auditTrail, { model: 'AvailableGadget' });

let availableGadgetsModel;

try {
  availableGadgetsModel = mongoose.model('availablegadgets');
} catch (error) {
  availableGadgetsModel = mongoose.model('availablegadgets', AvailableGadgetSchema);
}

module.exports = availableGadgetsModel;
