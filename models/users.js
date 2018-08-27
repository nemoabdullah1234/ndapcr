/* jshint esversion: 6 */

const mongoose = require('mongoose');

const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const subdocuments = require('./subdocuments');
const propogationHelper = require('../helpers/propogationHelper');
const auditTrail = require('../helpers/auditTrail');
const clientHandler = require('../lib/clientHandler');

const UserSchema = new Schema({
  title: { type: String },
  Username: { type: String },
  email: { type: String },
  password: { type: String },
  given_name: { type: String },
  family_name: { type: String },
  zoneinfo: { type: String },
  address: { type: String },
  city: { type: String },
  state: { type: String },
  country: { type: String },
  MobileNumber: { type: String },
  latitude: { type: String },
  longitude: { type: String },
  zipcode: { type: String },
  UserStatus: { type: String },
  email_verified: { type: String },
  phone_number: { type: String },
  phone_number_verified: { type: String },
  sub: { type: String },
  radius: { type: Number },
  UserCreateDate: { type: Date },
  UserLastModifiedDate: { type: Date },
  Enabled: { type: Boolean },
  isAdminApproved: { type: String },
  MobileCode: { type: String },
  CountryCode: { type: String },
  things: [subdocuments.Things],
  Attributes: {
    _id: false,
    name: { type: String },
    value: { type: String }
  },
  picture: { type: String },
  groups: [
    {
      _id: false,
      name: { type: String }
    }
  ],
  updatedBy: subdocuments.UpdatedBy,
  client: subdocuments.Client
});

UserSchema.pre('find', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions || {});
});

UserSchema.pre('count', () => {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions || {});
});

UserSchema.plugin(auditTrail.auditTrail, { model: 'users' });

UserSchema.post('findOneAndUpdate', (result, next) => {
  propogationHelper
    .propagate({ hook: 'findOneAndUpdate', collection: 'users', result })
    .then(() => {
      next();
    })
    .catch(() => {
      // console.log('Error encountered while propagating changes');
      next();
    });
});

let userModel;

try {
  userModel = mongoose.model('user');
} catch (error) {
  userModel = mongoose.model('user', UserSchema);
}

module.exports = userModel;
