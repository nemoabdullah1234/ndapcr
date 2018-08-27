const awsSdk = require('aws-sdk');

class AkAwsUtitlity {
  constructor() {
    this._defaultRegion = process.env.region;
  }

  getEnvironmentCredentials() {
    return new awsSdk.EnvironmentCredentials('AWS');
  }

  getRegion() {
    let region = this._defaultRegion;

    if (process.env.region) {
      region = process.env.region;
    }

    return region;
  }
}

module.exports = new AkAwsUtitlity();
