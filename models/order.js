/*jshint esversion: 6 */
'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const subdocuments = require('./subdocuments');
const auditTrail = require('../helpers/auditTrail');
const clientHandler = require('../lib/clientHandler');
const propogationHelper = require('../helpers/propogationHelper');

const OrderSchema = new Schema({
  code: { type: String },
  name: { type: String },
  status: { type: Number },
  orderStatus: { type: Number },
  orderedDate: { type: Date },
  etd: { type: Date, default: null },
  actualDeliveryDate: { type: Date },
  expectedCompletionDate: { type: Date },
  actualCompletionDate: { type: Date },
  updatedBy: subdocuments.UpdatedBy,
  updatedOn: { type: Date },
  orderStatusUpdatedOn: { type: Date },
  consumer: subdocuments.User,
  addresses: [
    {
      _id: false,
      addressType: { type: String },
      location: {
        _id: false,
        id: Schema.Types.ObjectId,
        code: { type: String },
        name: { type: String },
        address: [subdocuments.Attributes]
      }
    }
  ],
  products: [
    {
      _id: false,
      id: Schema.Types.ObjectId,
      code: { type: String },
      name: { type: String },
      things: [subdocuments.Things],
      deliveryStatus: { type: Number },
      issue: {
        _id: false,
        id: Schema.Types.ObjectId,
        shipmentId: Schema.Types.ObjectId,
        shipmentCode: { type: String }
      }
    }
  ],
  attributes: [subdocuments.Attributes],
  client: subdocuments.Client,
  tags: [subdocuments.Tags],
  createdOn: { type: Date },
  createdBy: subdocuments.User
});
OrderSchema.pre('find', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

OrderSchema.pre('count', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

OrderSchema.plugin(auditTrail.auditTrail, { model: 'orders' });

OrderSchema.post('findOneAndUpdate', function(result, next) {
  propogationHelper
    .propagate({ hook: 'findOneAndUpdate', collection: 'orders', result: result })
    .then(() => {
      next();
    })
    .catch(() => {
      // console.log('Error encountered while propagating changes');
      next();
    });
});

let orderModel;

try {
  orderModel = mongoose.model('order');
} catch (error) {
  orderModel = mongoose.model('order', OrderSchema);
}
module.exports = orderModel;
