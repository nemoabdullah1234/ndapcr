const uaModel = require('./urbanairship');
const bluebirdPromise = require('bluebird');
const config = require('../../mappings/airshipConfig.json');

class UA {
  constructor() {
    this.prod = process.env.uaProdMode === '1' || process.env.uaProdMode === 1;
    if (!this.prod) {
      this.config = config.dev;
    } else {
      this.config = config.prod;
    }
  }

  // getCarrierInstance() {
  //   return new uaModel(this.config.carrier);
  // }

  // getSalesRepInstance() {
  //   return new uaModel(this.config.salesRep);
  // }

  // getGatewayInstance() {
  //   return new uaModel(this.config.gateway);
  // }

  // getEmpTrakInstance() {
  //   return new uaModel(this.config.emptrak);
  // }

  getInstanceByAppNamePromisified(appName) {
    return bluebirdPromise.resolve(new uaModel(this.config[appName]));
  }
}

module.exports = new UA();
