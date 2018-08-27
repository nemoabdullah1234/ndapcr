const iot = function() {};

const bbPromise = require('bluebird');
const aws = require('aws-sdk');

aws.config.update({ region: process.env.region });
const awsIot = new aws.IotData({
  endpoint: process.env.iotEndpoint,
  accessKeyId: process.env.accessKeyId,
  secretAccessKey: process.env.secretAccessKey
});

iot.prototype.publish = (topic, message) => {
  // // console.log('In iot publish.........');
  const options = { topic, payload: message, qos: 0 };

  const promisifiedIoT = bbPromise.promisify(awsIot.publish.bind(awsIot));
  return promisifiedIoT(options)
    .then(res => {
      // // console.log('IOT publish success');
      return bbPromise.resolve(res);
    })
    .catch(err => {
      // console.log(`IN IOT ERRORR ${err.message}`);
      return bbPromise.reject(err);
    });
  // return new bbPromise((resolve, reject) => {
  //     awsIot.publish(options, function (err, data) {
  //         if (err) {
  //             // console.log("IN IOT ERRORR " + err.message);
  //             reject(err);
  //         } else {
  //             //resolve(data.Plaintext.toString('ascii'));
  //             resolve(data);
  //         }
  //     });
  // })
  // .catch((err) => {
  //     // console.log("iotpublish error"+err.message)
  //   throw new Error("IOT Error" + err.message);
  // });
};

module.exports = iot;
