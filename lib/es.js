// "use strict";

const es = require('elasticsearch');
const esAWS = require('http-aws-es');
// const awsSdk = require('aws-sdk');
// const util = require('util');
const bluebirdPromise = require('bluebird');

const akAwsUtitlity = require('./aws/utility');

class AkElasticSearch {
  constructor() {
    this._region = akAwsUtitlity.getRegion();
    this._apiVersion = '5.1';
    this._esConnection = null;
    this._esHost = process.env.esHost;
    this._accessKeyId = process.env.accessKeyId;
    this._secretAccessKey = process.env.secretAccessKey;
  }

  connect() {
    const awsCredentials = {
      region: this._region
    };

    if (process.env.lambdaDeploy === '1') {
      awsCredentials.credentials = akAwsUtitlity.getEnvironmentCredentials();
    } else {
      awsCredentials.accessKey = this._accessKeyId;
      awsCredentials.secretKey = this._secretAccessKey;
    }

    // console.log(awsCredentials);

    this._esConnection = es.Client({
      hosts: this._esHost,
      connectionClass: esAWS,
      apiVersion: this._apiVersion,
      amazonES: awsCredentials
    });

    // console.log(this._esConnection);
  }

  createIndex(idxName, idxMapping) {
    this._esConnection.indices.create(
      {
        index: idxName,
        body: idxMapping
      },
      (error, response) => {
        // console.log(error);
        // console.log(response);
        // ...
      }
    );
  }

  indexData(idxName, idxType, id, data) {
    // // console.log(id);
    return new bluebirdPromise((resolve, reject) => {
      this._esConnection.index(
        {
          index: idxName,
          type: idxType,
          id,
          body: data
        },
        (error, response) => {
          // // console.log('--Error--');
          // // console.log(error);
          // // console.log('--Response--');
          // // console.log(util.inspect(response, true, null));
          // ...

          if (error) {
            // } || response.hits.hits.length === 0) {
            reject(error);
          } else {
            resolve(data);
          }
        }
      );
    });
  }
}

module.exports = new AkElasticSearch();

/*


// save and index data in elastic search
;

// find data in index by id
akES.prototype.searchById = (client, idxName, idxType, id) => {

    return new bluebirdPromise((resolve, reject) => {
        client.get({
            index: idxName,
            type: idxType,
            id: id
        }, function (error, response) {
            //// console.log('--Error--');
            //// console.log(error);
            //// console.log('--Response--');
            //// console.log(util.inspect(response, true, null));
            // ...
            if (error) { //} || response.hits.hits.length === 0) {
                reject(error);
            } else {
                resolve(response._source);
            }
        });
    });
};

// saerch data
akES.prototype.search = (client, idxName, idxType, searchParams, otherParams) => {

    return new bluebirdPromise((resolve, reject) => {

        let query = {
            from: otherParams.pageParams.offset,
            size: otherParams.pageParams.limit,
            sort: []
        };
        // sorting
        Object.getOwnPropertyNames(otherParams.sort).forEach((fieldName, index) => {
            let sortDir = (otherParams.sort[fieldName] === 1) ? 'asc' : 'desc';
            query.sort[index] = { [fieldName]: { "order": sortDir } };
        });

        // console.log(searchParams);
        if (Object.keys(searchParams).length > 0) {
            let filters = [];

            //// console.log('asda');
            Object.getOwnPropertyNames(searchParams).forEach((fieldName, index) => {

                filters[index] = { match: { [fieldName]: searchParams[fieldName] } };

            });

            query.query = {
                "bool": {
                    "must": filters
                }
            };

        }

        // console.log(util.inspect(query, true, null));

        client.search({
            index: idxName,
            type: idxType,
            body: query
        }, function (error, response) {
            //// console.log('--Error--');
            //// console.log(error);
            //// console.log('--Response--');
            //// console.log(util.inspect(response, true, null));
            // ...
            if (error) { //} || response.hits.hits.length === 0) {
                reject(error);
            } else {
                let searchedData = [];
                //searchedData[0] = [];
                //searchedData[1] = response.hits.total;
                let records = response.hits.hits;
                let result = [];
                for (let i in records) {
                    if(records.hasOwnProperty(i))
                    {
                    var rec = {};
                    if (!otherParams.isDropdown) {
                        rec = records[i]._source;
                    } else {
                        rec.id = records[i]._source.id;
                        rec.name = records[i]._source.name;
                        //return formattedResponse;
                    }
                    result[i] = rec;
                    }
                }

                searchedData = [result, response.hits.total];

                resolve(searchedData);
            }
        });
    });
};

*/
