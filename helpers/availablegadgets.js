// const commonHelper = require('./common');
const clientHandler = require('../lib/clientHandler');

class Gadget {
  constructor() {
    this.client = null;
    this.availableGadgetModel = require('../models/widgets');
    this.bluebirdPromise = require('bluebird');
  }

  setClient(clientObj) {
    this.client = clientObj;
  }

  get(filterParams, extraParams) {
    return this.availableGadgetModel
      .find(filterParams)
      .sort(extraParams.sort)
      .skip(extraParams.pageParams.offset)
      .limit(extraParams.pageParams.limit)
      .exec()
      .then(result => {
        if (result.length === 0) {
          return this.bluebirdPromise.reject();
        }
        return this.bluebirdPromise.resolve(result);
      });
  }

  count(filterParams) {
    return this.availableGadgetModel.count(filterParams).exec();
  }

  getFilterParams(event = { queryStringParameters: {} }) {
    let filters = {};
    filters = clientHandler.addClientFilterToConditions(filters);
    if (event.queryStringParameters.type) {
      filters.type = event.queryStringParameters.type;
    }
    if (event.queryStringParameters.name) {
      filters.name = new RegExp(event.queryStringParameters.name, 'i');
    }
  }

  getExtraParams(event) {
    const params = {};
    params.sort = { name: 1 };
    params.pageParams = {
      offset: 0,
      limit: 10000
    };

    if (event.queryStringParameters.offset) {
      params.pageParams.offset = event.queryStringParameters.offset;
    }

    if (event.queryStringParameters.limit) {
      params.pageParams.limit = event.queryStringParameters.limit;
    }
    return params;
  }
}

module.exports = new Gadget();
