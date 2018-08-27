const mongoose = require('mongoose');

const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const subdocuments = require('./subdocuments');
// const auditTrail = require('../helpers/auditTrail');

const TrackingEntranceSchema = new Schema(
  {
    // client: subdocuments.Client,
    type: { type: String },
    sensors: {
      id: Schema.Types.ObjectId,
      name: { type: String },
      code: { type: String },
      product: subdocuments.Products,
      user: {
        id: Schema.Types.ObjectId,
        name: { type: String },
        code: { type: String }
      }
    },
    device: subdocuments.DeviceInfo,
    location: {
      id: Schema.Types.ObjectId,
      code: { type: String },
      name: { type: String },
      address: [subdocuments.Attributes],
      zones: {
        id: Schema.Types.ObjectId,
        code: { type: String },
        name: { type: String },
        thing: subdocuments.Things
      },
      floor: {
        id: Schema.Types.ObjectId,
        code: { type: String },
        name: { type: String }
      }
    },
    entryTime: { type: Date },
    exitTime: { type: Date },
    interval: { type: Number },
    pkid: { type: String },
    updatedAt: { type: Date }
  },
  { collection: 'trackingEntrance' }
);

// TrackingSchema.plugin(auditTrail.auditTrail,{ "model" : "Tracking"});

let trackingEntranceModel;

try {
  trackingEntranceModel = mongoose.model('trackingEntrance');
} catch (e) {
  trackingEntranceModel = mongoose.model('trackingEntrance', TrackingEntranceSchema);
}

module.exports = trackingEntranceModel;
