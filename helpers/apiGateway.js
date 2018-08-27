const bluebirdPromise = require('bluebird');
const AWS = require('aws-sdk');
const commonHelper = require('./common');

const apiGatewayHelper = function() {
  AWS.config.update({
    accessKeyId: 'AKIAJ2PO7IHZQOMBDTSQ',
    secretAccessKey: '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',
    region: process.env.region
  });
};

apiGatewayHelper.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

apiGatewayHelper.prototype.getRestApis = function getRestApis() {
  const apiGateway = new AWS.APIGateway({ apiVersion: '2015-07-09' });
  const promisifiedFunction = bluebirdPromise.promisify(apiGateway.getRestApis.bind(apiGateway));
  return promisifiedFunction({});
};

apiGatewayHelper.prototype.getResources = function getResources() {
  const apiGateway = new AWS.APIGateway({ apiVersion: '2015-07-09' });
  const promisifiedFunction = bluebirdPromise.promisify(apiGateway.getResources.bind(apiGateway));
  return promisifiedFunction({
    restApiId: '9tw5x4c4nl',
    embed: ['methods']
  })
    .then(res => bluebirdPromise.resolve(commonHelper.getObject(res, '9tw5x4c4nl')))
    .catch(error => bluebirdPromise.reject(error));
};
module.exports = new apiGatewayHelper();
