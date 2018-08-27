var mongoose = require('mongoose');
var Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');

var TimezoneSchema = new Schema({
  Offset: String,
  Name: String
});

let timezoneModel;

try {
  timezoneModel = mongoose.model('timezone');
} catch (error) {
  timezoneModel = mongoose.model('timezone', TimezoneSchema);
}

module.exports = timezoneModel;
