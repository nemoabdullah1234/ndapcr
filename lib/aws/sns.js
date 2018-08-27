const aws = require('aws-sdk');
const clientHandler = require('../clientHandler');
const currentUserHandler = require('../currentUserHandler');
const bluebirdPromise = require('bluebird');

class SNS {
  constructor() {
    this.sns = new aws.SNS({
      accessKeyId: process.env.accessKeyId,
      secretAccessKey: process.env.secretAccessKey
    });
  }

  publish(snsArn, data) {
    data.client = data.client || clientHandler.getClient();
    data.currentUser = data.currentUser || currentUserHandler.getCurrentUser();
    if (typeof data !== 'object' || data === null) {
      return bluebirdPromise.reject(new Error('SNS Data must be an object'));
    }
    return new bluebirdPromise((resolve, reject) => {
      this.sns.publish(
        {
          Message: JSON.stringify({ default: JSON.stringify(data) }),
          TopicArn: snsArn,
          MessageStructure: 'json'
        },
        (err, result) => {
          if (err) {
            return reject(err);
          }
          return resolve(result);
        }
      );
    });
  }
}

module.exports = new SNS();
