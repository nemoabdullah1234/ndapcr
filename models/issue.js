/*jshint esversion: 6 */
'use strict';
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = require('bluebird');
const subdocuments = require('./subdocuments');
const propogationHelper = require('../helpers/propogationHelper');
const auditTrail = require('../helpers/auditTrail');
const clientHandler = require('../lib/clientHandler');

const IssueSchema = new Schema({
  status: { type: Number },
  issueStatus: { type: Number },
  issueType: { type: String, default: '' },
  createdOn: { type: Date, default: Date.now() },
  createdBy: subdocuments.User,
  assignee: subdocuments.User,
  shipment: {
    _id: false,
    id: Schema.Types.ObjectId,
    code: { type: String },
    name: { type: String },
    shipmentStatus: { type: Number },
    etd: { type: Date },
    trackingDetails: {
      _id: false,
      currentLocation: {
        id: Schema.Types.ObjectId,
        code: { type: String },
        name: { type: String }
      },
      lastTracked: { type: Date }
    }
  },
  comments: [
    {
      _id: false,
      data: { type: String },
      items: [
        {
          _id: false,
          id: Schema.Types.ObjectId,
          code: { type: String },
          name: { type: String },
          order: Schema.Types.ObjectId
        }
      ],
      images: [subdocuments.Image],
      reporter: subdocuments.User,
      reportedOn: { type: Date, default: new Date() }
    }
  ],
  updatedOn: { type: Date, default: new Date() },
  updatedBy: subdocuments.UpdatedBy,
  client: subdocuments.Client
});

IssueSchema.pre('find', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

IssueSchema.pre('count', function() {
  this._conditions = clientHandler.addClientFilterToConditions(this._conditions);
});

IssueSchema.plugin(auditTrail.auditTrail, { model: 'issues' });

IssueSchema.post('findOneAndUpdate', function(result, next) {
  propogationHelper
    .propagate({ hook: 'findOneAndUpdate', collection: 'issues', result: result })
    .then(() => {
      next();
    })
    .catch(() => {
      // console.log('Error encountered while propagating changes');
      next();
    });
});

let issueModel;

try {
  issueModel = mongoose.model('issue');
} catch (error) {
  issueModel = mongoose.model('issue', IssueSchema);
}

module.exports = issueModel;
