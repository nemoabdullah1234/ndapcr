/*jshint esversion: 6 */
'use strict';
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const subdocuments = require('./subdocuments');
const GeoJSON = require('mongoose-geojson-schema');
const propogationHelper = require('../helpers/propogationHelper');
const auditTrail = require('../helpers/auditTrail');
const clientHandler = require('../lib/clientHandler');

const ProductSchema = new Schema({
  code: { type: String },
  name: { type: String },
  status: { type: Number },
  images: [subdocuments.Image],
  updatedBy: subdocuments.UpdatedBy,
  updatedOn: { type: Date, default: Date.now() },
  client: subdocuments.Client,
  tags: [subdocuments.Tags],
  attributes: [subdocuments.Attributes],
  categories: [subdocuments.Categories],
  things: [subdocuments.Things],
  parent: { type: String },
  seoName: { type: String },
  ancestors: [subdocuments.Ancestors],
  reusable: Boolean,
  lastThingsChangeOn: { type: Date },
  location: {
    _id: false,
    id: Schema.Types.ObjectId,
    code: { type: String },
    name: { type: String },
    floor: {
      _id: false,
      id: Schema.Types.ObjectId,
      code: { type: String },
      name: { type: String },
      zone: {
        _id: false,
        id: Schema.Types.ObjectId,
        code: { type: String },
        name: { type: String }
      }
    }
  }
});

ProductSchema.pre('find', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

ProductSchema.pre('count', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

ProductSchema.plugin(auditTrail.auditTrail, { model: 'products' });

ProductSchema.post('findOneAndUpdate', function(result, next) {
  propogationHelper
    .propagate({ hook: 'findOneAndUpdate', collection: 'product', result: result })
    .then(() => {
      next();
    })
    .catch(() => {
      // console.log('Error encountered while propagating changes');
      next();
    });
});

ProductSchema.post('save', function(result, next) {
  propogationHelper
    .propagate({ hook: 'save', collection: 'product', result: result })
    .then(() => {
      next();
    })
    .catch(() => {
      // console.log('Error encountered while propagating changes');
      next();
    });
});

let productModel;

try {
  productModel = mongoose.model('product');
} catch (error) {
  productModel = mongoose.model('product', ProductSchema);
}

module.exports = productModel;
