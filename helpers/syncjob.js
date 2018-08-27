/* jshint esversion: 6 */

const syncModel = require('../models/syncjobs');
const mongoose = require('mongoose');
// const commonHelper = require('./common');
const bluebirdPromise = require('bluebird');
const aws = require('aws-sdk');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');
const lambdaLib = new (require('../lib/aws/lambda'))();

aws.config.update({ region: process.env.region });
const syncService = function() {};
/**
 * Validate sync request
 * 
 * @param {Object} event
 * @return {Void} 
 * 
 */
syncService.prototype.validateRequest = function(event) {
  return this.commonValidations(event);
};
syncService.prototype.commonValidations = function(event) {
  return this.validateBasics(event);
};
/**
 * Set client of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void} 
 * 
 */

syncService.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};
/**
 * Save the sync request made from client device to sche3dule sync
 * @param {Object} event
 * @return {Void}
 * 
 */
syncService.prototype.save = function(event) {
  const syncObj = new syncModel(); // create a new instance of the  model
  syncObj.jobtype = event.body.jobtype;
  syncObj.syncstarted = Date.now();
  syncObj.updatedOn = Date.now();
  syncObj.syncstatus = 1;
  syncObj.cursor = 0;
  syncObj.itemprocessed = 0;
  syncObj.iteminserted = 0;
  syncObj.itemscreated = 0;
  syncObj.client = clientHandler.getClient();
  syncObj.updatedBy = currentUserHandler.getCurrentUser();
  return syncObj.save();
};
/**
 * Update the sync job status event parameter contains job data
 * @param {Object} event
 * @return {Void}
 * 
 */
syncService.prototype.update = function(event) {
  let conditions = { _id: event._id };
  conditions = clientHandler.addClientFilterToConditions(conditions);
  const syncUpdateObj = {};
  syncUpdateObj.jobtype = event.jobtype;
  syncUpdateObj.syncstarted = event.syncstarted;
  syncUpdateObj.updatedOn = Date.now();
  syncUpdateObj.syncstatus = event.syncstatus;
  syncUpdateObj.cursor = event.cursor;
  syncUpdateObj.itemprocessed = event.cursor;
  syncUpdateObj.iteminserted = event.cursor;
  syncUpdateObj.itemscreated = 0;
  syncUpdateObj.client = event.client;
  syncUpdateObj.updatedBy = event.updatedBy;
  const updateParams = {
    $set: syncUpdateObj,
    $inc: { __v: 1 }
  };
  return syncModel
    .findOneAndUpdate(conditions, updateParams, {
      upsert: false,
      new: true
    })
    .exec()
    .then(res => this.getById(event._id))
    .then(
      result =>
        // mongoose.set('debug', false);
        result
    );
};
/**
 * Basic validations on request made from client
 * @param {Object} event
 * @return {Void}
 * 
 */
syncService.prototype.validateBasics = function(event) {
  const errors = [];
  if (!event.body.jobtype) {
    errors.push({ code: 2001, message: 'jobtype is mandatory' });
  }
  if (errors.length !== 0) {
    return bluebirdPromise.reject(errors);
  }
  return bluebirdPromise.resolve(event);
};
/**
 * Publish to sns with sync job id
 * @param {String} id
 * @return {Void}
 * 
 */
syncService.prototype.publish = function(id) {
  return lambdaLib.promisifiedExecuteAsync(
    process.env.invokedSyncLambdaName,
    {
      syncjobId: id,
      client: clientHandler.getClient(),
      triggeredBy: currentUserHandler.getCurrentUser()
    },
    process.env.stage
  );
};

/**
 * Get sync job from ID
 * @param {String} thingId
 * @return {Object}
 * 
 */
syncService.prototype.getById = function(thingId = 'Default') {
  let conditions = { _id: mongoose.Types.ObjectId(thingId) };
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return syncModel
    .findOne(conditions)
    .exec()
    .then(result => {
      if (result) {
        return bluebirdPromise.resolve(result);
      }
      // TODO:format response
      return bluebirdPromise.reject();
    });
};
syncService.prototype.getByStatus = function() {
  return syncModel
    .findOne({ syncstatus: 1 })
    .exec()
    .then(() => {});
};
/**
 * Intiates update of sync job after reciving ID from sns
 * @param {Object} messagestring
 * @return {Void}
 * 
 */

syncService.prototype.updateHandler = function(syncjobId) {
  // const messageObj = JSON.parse(messagestring);
  // clientHandler.setClient(messageObj.client);
  // currentUserHandler.setCurrentUser(messageObj.triggeredBy);
  return this.getById(syncjobId).then(result => this.syncThings(result)); // .catch((error) => { commented for fixing

  // });
};
/**
 * Intiates sync of Beacon or Gateway depending upon job type
 * @param {Object} data
 * @return {Void}
 * 
 */
syncService.prototype.syncThings = function(data) {
  let syncJobService;
  if (data.jobtype === 'beacon') {
    syncJobService = require('./beaconsyncjob');
  } else if (data.jobtype === 'gateway') {
    syncJobService = require('./gatewaysyncjob');
  }
  return syncJobService
    .syncThings(data)
    .then(countOfrecord => {
      // console.log(`after insertion the count of records are${countOfrecord}`);
      return this.updateSyncJob(data, countOfrecord);
    })
    .catch(error => {
      // console.log('after insertion the count of failed records ');
      // console.log(error);
    });
};
/**
 * Updates sync job and inititates further fetch or marks completion of sync job 
 * @param {Object} data
 * @param {Number} count
 * @return {Void}
 * 
 */
syncService.prototype.updateSyncJob = function(data, count) {
  if (count > 0) {
    data.cursor += count;
    data.syncstatus = 1;
  } else if (count === 0) {
    // console.log('0 count');
    data.syncstatus = 0;
  }
  // console.log(Object.prototype.toString.call(count));
  return this.update(data)
    .then(data => {
      if (data.syncstatus === 1) {
        return this.publish(data.id);
        // console.log(`publish function to be called${count}`);
      } else if (data.syncstatus === 0) {
        // console.log('email function to be called');
        return this.sendSyncCompleteEmail(data);
      }
      // return bluebirdPromise.resolve();
    })
    .catch(e => {
      // console.log(e);
    });
};

syncService.prototype.sendSyncCompleteEmail = function(synbJobData) {
  const emailshelper = require('../helpers/emails');
  // console.log('email');
  return emailshelper.sendEmail(
    synbJobData.updatedBy.email,
    'Sync Completed Successfully',
    'synccomplete',
    {
      entitySynced: synbJobData.jobtype,
      name: `${synbJobData.updatedBy.firstName} ${synbJobData.updatedBy.lastName}`,
      totalProcessedCount: synbJobData.itemprocessed
    }
  );
};

module.exports = new syncService();
