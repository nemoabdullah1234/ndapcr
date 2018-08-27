const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const subdocuments = require('./subdocuments');
mongoose.Promise = require('bluebird');

const productThingAssignmentSchema = new Schema({
  product: subdocuments.Products,
  thing: subdocuments.Things,
  associatedOn: Date,
  disassociatedOn: Date,
  client: subdocuments.Client,
  updatedBy: subdocuments.UpdatedBy
});

let productThingAssignment;

try {
  productThingAssignment = mongoose.model('productThingAssignment');
} catch (error) {
  productThingAssignment = mongoose.model('productThingAssignment', productThingAssignmentSchema);
}

module.exports = productThingAssignment;
