/*jshint esversion: 6 */
'use strict';
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const subdocuments = require('./subdocuments');
const propogationHelper = require('../helpers/propogationHelper');
const auditTrail = require('../helpers/auditTrail');
const clientHandler = require('../lib/clientHandler');

const FavouritedOrderSchema = new Schema({
  orderId: Schema.Types.ObjectId,
  favouritedBy: [String],
  client: subdocuments.Client
});

FavouritedOrderSchema.pre('find', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

FavouritedOrderSchema.pre('count', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

//FavouritedOrderSchema.plugin(auditTrail.auditTrail, { "model": "attributes" });

// FavouritedOrderSchema.post('findOneAndUpdate', function (result, next) {
//   propogationHelper.propagate({ "hook": 'findOneAndUpdate', "collection": 'attribute', "result": result })
//     .then(() => {
//       next();
//     })
//     .catch(() => {
//       // console.log("Error encountered while propagating changes");
//       next();
//     });
// });

let favouriteOrdersModel;

try {
  favouriteOrdersModel = mongoose.model('favouriteorders');
} catch (error) {
  favouriteOrdersModel = mongoose.model('favouriteorders', FavouritedOrderSchema);
}

module.exports = favouriteOrdersModel;
