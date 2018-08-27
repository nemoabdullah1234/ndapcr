/* jshint esversion: 6 */
const mongoose = require('mongoose');

const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const subdocuments = require('./subdocuments');
const auditTrail = require('../helpers/auditTrail');

const GadgetPositionSchema = new Schema(
  {
    displayScheme: String,
    position: Schema.Types.Mixed,
    client: subdocuments.Client,
    user: subdocuments.User,
    updatedOn: Date
  },
  {
    retainKeyOrder: true,
    minimize: false
  }
);

GadgetPositionSchema.plugin(auditTrail.auditTrail, { model: 'GadgetPositions' });

let gadgetPositionModel;

try {
  gadgetPositionModel = mongoose.model('gadgetpositions');
} catch (error) {
  gadgetPositionModel = mongoose.model('gadgetpositions', GadgetPositionSchema);
}

module.exports = gadgetPositionModel;
