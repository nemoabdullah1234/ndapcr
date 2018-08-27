/*jshint esversion: 6 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const auditTrail = require('../helpers/auditTrail');

const GadgetSchema = new Schema({
  gadgetId: String,
  name: String,
  description: String,
  type: String,
  image: String
});
GadgetSchema.plugin(auditTrail.auditTrail, { model: 'Widgets' });

let gadgetModel;

try {
  gadgetModel = mongoose.model('gadgets');
} catch (error) {
  gadgetModel = mongoose.model('gadgets', GadgetSchema);
}

module.exports = gadgetModel;
