const lambda = function() {};

const bbPromise = require('bluebird');
const aws = require('aws-sdk');

aws.config.update({ region: process.env.region });
const awsLambda = new aws.Lambda({
  region: process.env.region, // change to your region
  accessKeyId: process.env.accessKeyId,
  secretAccessKey: process.env.secretAccessKey
});

/**
 * Call Lambda function
 * @param {string} functionName - AWS Lambda Name 
 * @param {object} payload - Input Payload
 * @param {function} callback - callback function
 * @returns {void} 
 */
lambda.prototype.execute = function(functionName, payload, callback, alias) {
  if (typeof alias === 'undefined') {
    alias = 'qc';
  }
  return new bbPromise((resolve, reject) => {
    awsLambda.invoke(
      {
        FunctionName: functionName,
        Payload: JSON.stringify(payload, null, 2), // pass params
        Qualifier: alias
      },
      (error, result) => {
        if (error) {
          reject(error);
        }

        if (!result.Payload) {
          reject('Invalid Results ');
        } else {
          const resultobj = JSON.parse(result.Payload);
          resolve(resultobj);
        }
      }
    );
  })
    .then(results => {
      callback(results);
    })
    .catch(err => {
      // console.log(err);
      callback(null);
    });
};

/**
 * Call Lambda function
 * @param {string} functionName - AWS Lambda Name 
 * @param {object} payload - Input Payload
 * @param {function} callback - callback function
 * @returns {void} 
 */
lambda.prototype.executeAsync = function(functionName, payload, callback, alias) {
  if (typeof alias === 'undefined') {
    alias = 'qc';
  }
  // console.log({
  //   FunctionName: functionName,
  //   InvocationType: 'Event',
  //   Payload: JSON.stringify(payload, null, 2),
  //   Qualifier: alias // pass params
  // });
  return new bbPromise((resolve, reject) => {
    awsLambda.invoke(
      {
        FunctionName: functionName,
        InvocationType: 'Event',
        Payload: JSON.stringify(payload, null, 2),
        Qualifier: alias // pass params
      },
      (error, result) => {
        if (error) {
          reject(error);
        }

        resolve('OK');
      }
    );
    callback({});
  })
    .then(results => {
      // console.log('IN SUCC');
      // callback(results);
    })
    .catch(err => {
      // console.log('IN ERR');
      // console.log(err);
      callback(null);
    });
};

/**
 * Call Lambda function
 * @param {string} functionName - AWS Lambda Name 
 * @param {object} payload - Input Payload
 * @param {function} callback - callback function
 * @returns {void} 
 */
lambda.prototype.promisifiedExecute = function({ functionName, payload, alias }) {
  if (typeof alias === 'undefined') {
    alias = 'qc';
  }
  const pf = bbPromise.promisify(awsLambda.invoke.bind(awsLambda));
  return pf({
    FunctionName: functionName,
    Payload: JSON.stringify(payload, null, 2), // pass params
    Qualifier: alias
  });
};

/**
 * Call Lambda function
 * @param {string} functionName - AWS Lambda Name 
 * @param {object} payload - Input Payload
 * @param {function} callback - callback function
 * @returns {void} 
 */
lambda.prototype.promisifiedExecuteAsync = function(functionName, payload, alias) {
  if (typeof alias === 'undefined' || alias === 'local') {
    alias = 'qc';
  }
  // // console.log({
  //   FunctionName: functionName,
  //   InvocationType: 'Event',
  //   Payload: JSON.stringify(payload, null, 2),
  //   Qualifier: alias // pass params
  // });
  const pf = bbPromise.promisify(awsLambda.invoke.bind(awsLambda));
  // console.log(payload);
  return pf({
    FunctionName: functionName,
    InvocationType: 'Event',
    Payload: JSON.stringify(payload, null, 2),
    Qualifier: alias // pass params
  });
};

module.exports = lambda;
