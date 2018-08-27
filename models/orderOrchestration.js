const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const auditTrail = require('../helpers/auditTrail');
const subdocuments = require('./subdocuments');
const OrderOrchestrationSchema = new Schema({
  client:subdocuments.Client,
  orderId: Schema.Types.ObjectId,
  orderStatus: {type : Number},
  done: {type : Number},
  actionTime: {type: Date, default: Date.now},
});

OrderOrchestrationSchema.plugin(auditTrail.auditTrail,{ "model" : "order Orchestration"});

let orderOrchestration;

try {
  orderOrchestration = mongoose.model('orderOrchestration');
} catch (error) {
  orderOrchestration = mongoose.model('orderOrchestration', OrderOrchestrationSchema);
}

module.exports = orderOrchestration;
