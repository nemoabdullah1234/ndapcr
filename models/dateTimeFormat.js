var mongoose = require('mongoose');
var Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');

var DateTimeFormatSchema = new Schema({
  name: { type: String },
  code: { type: String },
  example: { type: String }
});

let dateTimeFormatModel;

try {
  dateTimeFormatModel = mongoose.model('dateTimeFormat');
} catch (error) {
  dateTimeFormatModel = mongoose.model('dateTimeFormat', DateTimeFormatSchema);
}

module.exports = dateTimeFormatModel;
