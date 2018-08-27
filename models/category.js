/* jshint esversion: 6 */


let mongoose = require('mongoose');

let Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const subdocuments = require('./subdocuments');
const propogationHelper = require('../helpers/propogationHelper');
const auditTrail = require('../helpers/auditTrail');
const clientHandler = require('../lib/clientHandler');

let CategorySchema = new Schema({
  code: { type: String, default: '' },
  name: { type: String, default: '' },
  sysDefined: { type: Number, default: 0 },
  status: { type: Number, default: 1 },
  updatedOn: { type: Date, default: Date.now() },
  updatedBy: subdocuments.UpdatedBy,
  client: subdocuments.Client,
  tags: [subdocuments.Tags],
  parent: { type: String, default: '' },
  seoName: { type: String, default: '' },
  ancestors: [subdocuments.Ancestors]
});

CategorySchema.pre('find', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

CategorySchema.pre('count', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

CategorySchema.plugin(auditTrail.auditTrail, { model: 'categories' });

CategorySchema.post('findOneAndUpdate', (result, next) => {
  propogationHelper
    .propagate({ hook: 'findOneAndUpdate', collection: 'category', result: result })
    .then(() => {
      next();
    })
    .catch(() => {
      // console.log('Error encountered while propagating changes');
      next();
    });
});

let categoryModel;

try {
  categoryModel = mongoose.model('category');
} catch (error) {
  categoryModel = mongoose.model('category', CategorySchema);
}

module.exports = categoryModel;
