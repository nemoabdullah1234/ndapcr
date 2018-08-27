const bluebirdPromise = require('bluebird');
const json2csv = require('json2csv');
const fs = require('fs');

class Exporter {
  csv(array, fileName) {
    const path = `/tmp/${fileName}.csv`;
    const csv = json2csv({
      data: array,
      fields: Object.getOwnPropertyNames((array || [])[0] || {})
    });
    return new bluebirdPromise((resolve, reject) => {
      fs.writeFile(path, csv, err => {
        if (err) reject(err);
        resolve({
          status: true,
          path,
          fileName
        });
      });
    });
  }
}

module.exports = new Exporter();
