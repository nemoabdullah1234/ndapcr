const esQueryBuilder = require('elastic-builder');
const util = require('util');

// getData('attributes','attributes','593e24faa32d0f527b1a3ea7');

// indexData('megacorp','employee',1,'{"first_name":"John","last_name":"Smith","age":25,"about":"I love to go rock climbing","interests":["sports","music"]}');
// indexData('megacorp','employee',2,'{"first_name":"Jane","last_name":"Smith","age":32,"about":"I like to collect rock albums","interests":["music"]}');
// indexData('megacorp','employee',3,'{"first_name":"Douglas","last_name":"Fir","age":35,"about":"I like to build cabinets","interests":["forestry"]}');

search('attributes', 'name:Smith');
// updateIndexInfo('bank');
// getIndexInfo('bank');
// deleteIndex('attributes');

function search(idxName, search) {
  const client = connectEs();

  const requestBody = esQueryBuilder
    .requestBodySearch()
    .query(esQueryBuilder.matchQuery('Code', search));

  const body = {
    aggs: {
      all_interests: {
        terms: { field: 'interests' }
      }
    }
  };

  // // console.log(requestBody.toJSON());

  client.search(
    {
      index: idxName
      // q: search
      // "storedFields": ["address"],
      // body: body
    },
    (error, response) => {
      // console.log('--Error--');
      // console.log(error);
      // console.log('--Response--');
      // console.log(util.inspect(response, true, null));
    }
  );
}

function getData(idxName, idxType, id) {
  const client = connectEs();

  client.get(
    {
      index: idxName,
      type: idxType,
      id
    },
    (error, response) => {
      // console.log('--Error--');
      // console.log(error);
      // console.log('--Response--');
      // console.log(util.inspect(response, true, null));
      // ...
    }
  );

  // console.log('abc');
}

function indexData(idxName, idxType, id, data) {
  const client = connectEs();

  client.index(
    {
      index: idxName,
      type: idxType,
      id,
      body: data
    },
    (error, response) => {
      // console.log('--Error--');
      // console.log(error);
      // console.log('--Response--');
      // console.log(util.inspect(response, true, null));
      // ...
    }
  );
}

function deleteIndex(idxName) {
  const client = connectEs();

  client.indices.delete(
    {
      index: idxName
    },
    (error, response) => {
      // ...
    }
  );
}

function getIndexInfo(idxName) {
  const client = connectEs();

  client.indices.get(
    {
      index: idxName
    },
    (error, response) => {
      // console.log('--Error--');
      // console.log(error);
      // console.log('--Response--');
      // console.log(util.inspect(response, true, null));
      // ...
    }
  );
}

function updateIndexInfo(idxName) {
  const client = connectEs();
  const body = {
    properties: {
      address: {
        type: 'text',
        fields: { keyword: { type: 'keyword', ignore_above: 256 } },
        fielddata: true
      }
    }
  };

  client.indices.putMapping(
    {
      index: idxName,
      type: 'account',
      body
    },
    (error, response) => {
      // console.log('--Error--');
      // console.log(error);
      // console.log('--Response--');
      // console.log(util.inspect(response, true, null));
      // ...
    }
  );
}

function connectEs() {
  const es = require('elasticsearch').Client({
    host: 'search-aktest-ljhtrweitgh6sxpruk2eqzubnm.us-east-1.es.amazonaws.com',
    // log: 'trace',
    connectionClass: require('http-aws-es'),
    apiVersion: '5.1',
    amazonES: {
      region: process.env.region,
      accessKey: 'AKIAJANEYJVXADYG7RVA',
      secretKey: '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'
    }
  });

  return es;
}

//

// deleteIndex(es, 'product', 'Code:*');
