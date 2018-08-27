const mongoose = require('mongoose');

const Schema = mongoose.Schema;
require('mongoose-double')(mongoose);

const subdocuments = {};

subdocuments.Ancestors = new Schema({
  _id: false,
  id: Schema.Types.ObjectId,
  name: String,
  seoName: String
});

subdocuments.Attributes = new Schema({
  _id: false,
  id: Schema.Types.ObjectId,
  name: String,
  value: String,
  sysDefined: Number,
  status: Number
});

subdocuments.Categories = new Schema({
  _id: false,
  id: Schema.Types.ObjectId,
  name: String
});

subdocuments.Client = new Schema({
  _id: false,
  clientId: String,
  projectId: String
});

subdocuments.Items = new Schema({
  _id: false,
  id: { type: Schema.Types.ObjectId },
  sysDefined: Number,
  name: String
});

subdocuments.floorMapCoords = new Schema({
  _id: false,
  url: String,
  xCoord: Schema.Types.Double,
  yCoord: Schema.Types.Double,
  radius: Schema.Types.Double
});

subdocuments.Tags = new Schema({
  _id: false,
  id: { type: Schema.Types.ObjectId },
  name: String
});

subdocuments.Things = new Schema({
  _id: false,
  id: Schema.Types.ObjectId,
  code: String,
  name: String,
  type: String,
  rng: Number
});

subdocuments.Order = new Schema({
  _id: false,
  id: Schema.Types.ObjectId,
  code: { type: String },
  name: { type: String },
  etd: { type: Date }
});

subdocuments.User = new Schema({
  _id: false,
  uuid: String,
  firstName: String,
  lastName: String,
  email: String,
  mobileNo: String
});

subdocuments.Products = new Schema({
  _id: false,
  id: Schema.Types.ObjectId,
  code: String,
  name: String
});

subdocuments.Zone = new Schema({
  _id: false,
  id: Schema.Types.ObjectId,
  code: String,
  name: String
});

subdocuments.Shipment = new Schema({
  _id: false,
  id: Schema.Types.ObjectId,
  code: String,
  name: String
});

subdocuments.UpdatedBy = new Schema({
  _id: false,
  uuid: String,
  firstName: String,
  lastName: String,
  email: String
});

subdocuments.Image = new Schema({
  _id: false,
  url: String,
  meta: Schema.Types.Mixed
});

subdocuments.AvailableGadgets = new Schema({
  code: String,
  name: String,
  description: String,
  type: String,
  image: String
});

subdocuments.UserGadgets = new Schema({
  _id: false,
  name: String,
  helpText: String,
  type: String,
  gadgetId: Schema.Types.ObjectId,
  gadgetCode: String,
  visible: Boolean,
  position: {
    _id: false,
    section: String,
    orderPosition: Number
  },
  params: Schema.Types.Mixed
});

subdocuments.DeviceInfo = new Schema({
  _id: false,
  id: Schema.Types.ObjectId,
  code: { type: String },
  name: { type: String },
  type: { type: String },
  manufacturer: { type: String },
  appName: { type: String },
  os: { type: String },
  model: { type: String },
  version: { type: String },
  appVersion: { type: String }
});

module.exports = subdocuments;
