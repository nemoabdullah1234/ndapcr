var mongoose = require('mongoose');
var Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');

var CountrySchema = new Schema({
  ShortCode: String,
  DialCode: String,
  Name: String
});

let countryModel;

try {
  countryModel = mongoose.model('country');
} catch (error) {
  countryModel = mongoose.model('country', CountrySchema);
}

module.exports = countryModel;
