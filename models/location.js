/* jshint esversion: 6 */


const mongoose = require('mongoose');
const GeoJSON = require('mongoose-geojson-schema');

const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const subdocuments = require('./subdocuments');
const propogationHelper = require('../helpers/propogationHelper');
const auditTrail = require('../helpers/auditTrail');
const clientHandler = require('../lib/clientHandler');

const LocationSchema = new Schema({
  code: { type: String },
  name: { type: String },
  status: { type: Number },
  type: String,
  pointCoordinates: Schema.Types.Point,
  perimeter: Schema.Types.Polygon,
  updatedOn: { type: Date, default: Date.now() },
  updatedBy: subdocuments.UpdatedBy,
  parent: String,
  seoName: String,
  client: subdocuments.Client,
  tags: [subdocuments.Tags],
  categories: [subdocuments.Categories],
  attributes: [subdocuments.Attributes],
  ancestors: [subdocuments.Ancestors],
  things: [subdocuments.Things]
});

// LocationSchema.pre('find', function() {
//   this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
// });

LocationSchema.pre('count', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

LocationSchema.plugin(auditTrail.auditTrail, { model: 'locations' });

LocationSchema.post('findOneAndUpdate', (result, next) => {
  propogationHelper
    .propagate({ hook: 'findOneAndUpdate', collection: 'location', result: result })
    .then(() => {
      next();
    })
    .catch(() => {
      // console.log('Error encountered while propagating changes');
      next();
    });
});

LocationSchema.post('save', (result, next) => {
  propogationHelper
    .propagate({ hook: 'save', collection: 'location', result: result })
    .then(() => {
      next();
    })
    .catch(() => {
      // console.log('Error encountered while propagating changes');
      next();
    });
});

let locationModel;

try {
  locationModel = mongoose.model('location');
} catch (error) {
  locationModel = mongoose.model('location', LocationSchema);
}
module.exports = locationModel;
