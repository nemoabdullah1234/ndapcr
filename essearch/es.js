const AWS = require('aws-sdk');
const es = require('elasticsearch');
const esConnection = require('http-aws-es');

module.exports.dynamoToElasticSearch = (event, context, callback) => {
  const myCredentials = new AWS.EnvironmentCredentials('AWS'); // Lambda provided credentials
  const esC = es.Client({
    hosts: 'search-aktest-ljhtrweitgh6sxpruk2eqzubnm.us-east-1.es.amazonaws.com',
    connectionClass: esConnection,
    amazonES: {
      region: process.env.region,
      credentials: myCredentials
    }
  });

  // ping(esC);

  event.Records.forEach(record => {
    processRecord(esC, record);
  });

  callback(null, 'Successfully processed ${event.Records.length} records.');
};

function processRecord(esC, record) {
  // console.log(record);

  // var esC = null;

  switch (record.eventName) {
    case 'INSERT':
      processInsertedRecord(esC, record);
      break;
    case 'MODIFY':
      processUpdatededRecord(esC, record);
      break;
    case 'REMOVE':
      processRemovedRecord(esC, record);
      break;
  }

  // // console.log(record.eventName);
  // // console.log('DynamoDB Record: %j', record.dynamodb);
}

function processInsertedRecord(esClient, record) {
  const table = getTableName(record);

  const data = formatDataForES(record.dynamodb.NewImage);

  const id = formatKeyForES(record);
  // console.log('Insert Row');
  // console.log(data);
  // console.log(id);

  indexEs(esClient, table, table, id, data);
}

function processUpdatededRecord(esClient, record) {
  const table = getTableName(record);

  const data = formatDataForES(record.dynamodb.NewImage);

  const id = formatKeyForES(record);
  // console.log('Update Row');
  // console.log(data);
  // console.log(id);

  indexEs(esClient, table, table, id, data);
}

function processRemovedRecord(esClient, record) {
  const table = getTableName(record);

  // data = formatDataForES(record.dynamodb.NewImage);

  const id = formatKeyForES(record);
  // // console.log(id);
  // console.log('Delete Row');
  // console.log(table);
  // console.log(id);

  deleteEs(esClient, table, table, id);
}

function getTableName(record) {
  const pattern = new RegExp('arn:aws:dynamodb:.*?:.*?:table/([0-9a-zA-Z_-]+)/.+');
  const match = pattern.exec(record.eventSourceARN);

  // todo
  return match[1].toLowerCase();
  // // console.log(match[1]);
}

function formatDataForES(data) {
  const data1 = {};
  data1.M = data;
  return formatDataValuesForES(data1, true);
}

function formatDataValuesForES(data, forceNum = false) {
  // // console.log(data);

  // // console.log(Object.keys(data).length);

  const keys = Object.keys(data);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const value = data[key];

    switch (key) {
      case 'NULL':
        return null;
      case 'S':
        return value;
      case 'BOOL':
        return value;
      case 'N':
        if (forceNum) {
          return parseFloat(value);
        }
        return value;

      case 'M':
      case 'BS':
      case 'L':
        const returnData = {};

        const keys1 = Object.keys(value);

        for (let j = 0; j < keys1.length; j++) {
          returnData[keys1[j]] = formatDataValuesForES(value[keys1[j]], true);
        }

        return returnData;
    }
  }

  /*
        if (key == "SS"):
            data = []
        for item in value:
            data.append(item)
        if (key == "NS"):
            data = []
        for item in value:
            if (forceNum):
                data.append(int_or_float(item))
            else:
            data.append(item)
        return data
    */
}

function formatKeyForES(record) {
  const primaryKeys = formatDataForES(record.dynamodb.Keys);
  const keys = Object.keys(primaryKeys);
  let pk = '';

  for (let j = 0; j < keys.length; j++) {
    pk += primaryKeys[keys[j]];
  }

  // console.log(pk);
  return pk;
}

function indexEs(es, idxName, idxType, docId, doc) {
  es.index(
    {
      index: idxName,
      type: idxType,
      id: docId,
      body: doc
    },
    (error, response) => {
      // console.log(error);
      // console.log(response);
    }
  );
}

function deleteEs(es, idxName, idxType, docId) {
  es.delete(
    {
      index: idxName,
      type: idxType,
      id: docId
    },
    (error, response) => {
      // console.log(error);
      // console.log(response);
    }
  );
}
