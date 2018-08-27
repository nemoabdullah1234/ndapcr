const fs = require('fs');
const bluebirdPromise = require('bluebird');
const AWS = require('aws-sdk');

const awsS3 = new AWS.S3({
  accessKeyId: process.env.accessKeyId,
  secretAccessKey: process.env.secretAccessKey,
  region: process.env.region
});

class S3 {
  writeFileToS3({ localFilePath, bucketName, access, contentType, outputFileName }) {
    const baseUrl = `https://s3.amazonaws.com/${bucketName}`;
    return new bluebirdPromise((resolve, reject) => {
      awsS3.upload(
        {
          Bucket: bucketName,
          Key: outputFileName,
          Body: fs.createReadStream(localFilePath),
          ContentType: contentType,
          ACL: access || 'public-read'
        },
        (error, data) => {
          if (error) {
            reject(error);
          }
          resolve({
            status: true,
            url: data.Location,
            data
          });
        }
      );
    });
  }
}

module.exports = new S3();
