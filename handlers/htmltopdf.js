const fs = require('fs');
const pdf = require('html-pdf');
const AWS = require('aws-sdk');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');

const s3 = new AWS.S3();

module.exports.generate = (event, context, cb) => {
  let html = 'AKWA';

  if (event.html) {
    html = event.html;
  }

  // unique file name
  let outputFilename = `${Math.random()
    .toString(36)
    .slice(2)}.pdf`;

  if (event.filename) {
    outputFilename = event.filename;
  }

  // file created directory
  const output = `/tmp/${Math.random()
    .toString(36)
    .slice(2)}.pdf`;

  let options = {};
  if (event.options) {
    options = typeof event.options !== typeof {} ? JSON.parse(event.options) : event.options;
  }
  // const options = {
  //   footer: {
  //     height: '18mm',
  //     contents: {
  //       default:
  //         ' <div style="height:30px;background-color: #434343; width: 100%;"></div><div style="text-align:center">Page <span style="color: #444;">{{page}}</span> of <span>{{pages}}</span></div>' // fallback value
  //     }
  //   },
  //   header: {
  //     height: '4mm',
  //     contents: '<div style=" margin-top:12px"></div>'
  //   }
  // };

  const awsInfo = {
    bucket: process.env.docBucket
  };

  const baseUrl = `https://s3.amazonaws.com/${awsInfo.bucket}`;
  // let folderRoot = 'delivery-reports';

  pdf.create(html, options).toStream((err, stream) => {
    if (err) {
      // console.log('pdf err : ', err);
    } else {
      stream = stream.pipe(fs.createWriteStream(output));

      stream.on('finish', () => {
        // // console.log(output);

        s3.putObject(
          {
            Bucket: awsInfo.bucket,
            Key: outputFilename,
            Body: fs.createReadStream(output),
            ContentType: 'application/pdf',
            ACL: 'public-read'
          },
          (error, data) => {
            if (error !== null) {
              // // console.log(`error: ${error}`);
              return cb(null, {
                err: error
              });
            }
            const url = `${baseUrl}/${outputFilename}`;

            return cb(null, {
              url
            });
          }
        );
      });
    }
  });
};
