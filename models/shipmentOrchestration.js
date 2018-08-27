const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const auditTrail = require('../helpers/auditTrail');
const subdocuments = require('./subdocuments');
const ShipmentOrchestrationSchema = new Schema({
  client:subdocuments.Client,
  shipmentId: Schema.Types.ObjectId,
  shipmentStatus: {type : Number},
  done: {type : Number},
  actionTime: {type: Date, default: Date.now},
});

ShipmentOrchestrationSchema.plugin(auditTrail.auditTrail,{ "model" : "shipmentOrchestration"});

let shipmentOrchestration;

try {
  shipmentOrchestration = mongoose.model('shipmentOrchestration');
} catch (error) {
  shipmentOrchestration = mongoose.model('shipmentOrchestration', ShipmentOrchestrationSchema);
}

module.exports = shipmentOrchestration;
