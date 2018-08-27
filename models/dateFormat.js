var mongoose = require('mongoose');
var Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');

var DateFormatSchema = new Schema({
  name: { type: String },
  code: { type: String },
  example: { type: String }
});

let dateFormatModel;

try {
  dateFormatModel = mongoose.model('dateFormat');
} catch (error) {
  dateFormatModel = mongoose.model('dateFormat', DateFormatSchema);
}

module.exports = dateFormatModel;
