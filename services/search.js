let akES = require('../lib/es');

class SearchService {
  setup() {}
}

/*

// create indexes to the es cluster
search.prototype.setup = () => {

    // console.log('- in search setup');

    // indexes
    const indexes = {};

    

    var client = akES.connect();

    akES.createIndex(client, 'attributes', indexes.attributes);

};

search.prototype.indexData = (index, data) => {
    var client = akES.connect();
    //// console.log(data);
    return akES.indexData(client, index, index, data.id + '', data);
};

search.prototype.searchById = (index, id) => {
    var client = akES.connect();
    return akES.searchById(client, index, index, id);
};

search.prototype.searchData = (index, searchParams, otherParams) => {
    var client = akES.connect();
    return akES.search(client, index, index, searchParams, otherParams);
};

*/

module.exports = new SearchService();
