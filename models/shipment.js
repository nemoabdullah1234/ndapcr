/*jshint esversion: 6 */
'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const GeoJSON = require('mongoose-geojson-schema');
mongoose.Promise = require('bluebird');
const subdocuments = require('./subdocuments');
const auditTrail = require('../helpers/auditTrail');
const clientHandler = require('../lib/clientHandler');
const propogationHelper = require('../helpers/propogationHelper');

const ShipmentSchema = new Schema({
  code: { type: String },
  name: { type: String },
  status: { type: Number },
  shipmentStatus: { type: Number },
  isInternal: { type: Boolean, default: false },
  updatedBy: subdocuments.UpdatedBy,
  updatedOn: { type: Date },
  shipmentStatusUpdatedOn: { type: Date },
  scheduledPickupDate: { type: Date },
  etd: { type: Date },
  deliverByDate: { type: Date },
  shipDate: { type: Date },
  deliveryDate: { type: Date },
  canceledDate: { type: Date },
  carrierUser: subdocuments.User,
  products: [
    {
      _id: false,
      id: Schema.Types.ObjectId,
      code: { type: String },
      name: { type: String },
      orderDetails: subdocuments.Order,
      things: [subdocuments.Things],
      deliveryStatus: { type: Number },
      isMissing: { type: Number },
      trackingDetails: {
        _id: false,
        currentLocation: {
          id: Schema.Types.ObjectId,
          code: { type: String },
          name: { type: String },
          pointCoordinates: Schema.Types.Point,
          address: [subdocuments.Attributes],
          zones: {
            id: Schema.Types.ObjectId,
            name: { type: String },
            thing: subdocuments.Things
          }
        },
        lastTracked: { type: Date }
      },
      issue: { type: String }
    }
  ],
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
  deliveryDetails: {
    _id: false,
    recipientFirstName: { type: String },
    recipientLastName: { type: String },
    recipientMobileCode: { type: String },
    recipientMobileNumber: { type: String },
    recipientSignature: subdocuments.Image,
    images: [subdocuments.Image],
    pdfUrl: { type: String }
    // attributes: [subdocuments.Attributes]
  },
  trackingDetails: {
    _id: false,
    currentLocation: {
      id: Schema.Types.ObjectId,
      code: { type: String },
      name: { type: String },
      pointCoordinates: Schema.Types.Point,
      address: [subdocuments.Attributes]
    },
    lastTracked: { type: Date }
  },
  attributes: [subdocuments.Attributes],
  client: subdocuments.Client,
  tags: [subdocuments.Tags],
  createdOn: { type: Date },
  createdBy: subdocuments.User,
  issue: { type: String },
  isAdminDelivered: { type: Number },
  hasMissingItems: { type: Number }
});

ShipmentSchema.pre('find', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

ShipmentSchema.pre('count', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

ShipmentSchema.plugin(auditTrail.auditTrail, { model: 'shipments' });

let shipmentModel;

try {
  shipmentModel = mongoose.model('shipment');
} catch (error) {
  shipmentModel = mongoose.model('shipment', ShipmentSchema);
}
module.exports = shipmentModel;
