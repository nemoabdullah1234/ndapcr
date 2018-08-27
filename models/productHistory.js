const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const auditTrail = require('../helpers/auditTrail');

const ProductHistorySchema = new Schema({
  productId: Schema.Types.ObjectId,
  shipmentId: Schema.Types.ObjectId,
  caseId: Schema.Types.ObjectId,
  productStatus: {type : Number},
  ActionTime: {type: Date, default: Date.now},
});


ProductHistorySchema.plugin(auditTrail.auditTrail,{ "model" : "Product History"});

let productHistory;

try {
  productHistory = mongoose.model('productHistory');
} catch (error) {
  productHistory = mongoose.model('productHistory', ProductHistorySchema);
}

module.exports = productHistory;