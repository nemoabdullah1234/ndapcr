const kms = function() {};

const bbPromise = require('bluebird');
const aws = require('aws-sdk');

aws.config.update({ region: process.env.region });
const awsKms = new aws.KMS();

kms.prototype.decrypt = decryptedVar => {
  const options = { CiphertextBlob: new Buffer(decryptedVar, 'base64') };

  return new bbPromise((resolve, reject) => {
    awsKms.decrypt(options, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data.Plaintext.toString('ascii'));
      }
    });
  });
};

module.exports = kms;
