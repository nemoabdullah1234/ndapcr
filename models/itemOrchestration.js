const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const auditTrail = require('../helpers/auditTrail');
const subdocuments = require('./subdocuments');
const ItemOrchestrationSchema = new Schema({
  client:subdocuments.Client,
  itemId: Schema.Types.ObjectId,
  itemStatus: {type : Number},
  parentType: {type : String},
  parentId: Schema.Types.ObjectId,
  actionTime: {type: Date, default: Date.now},
});

ItemOrchestrationSchema.plugin(auditTrail.auditTrail,{ "model" : "itemOrchestration"});

let itemOrchestration;

try {
  itemOrchestration = mongoose.model('itemOrchestration');
} catch (error) {
  itemOrchestration = mongoose.model('itemOrchestration', ItemOrchestrationSchema);
}

module.exports = itemOrchestration;
