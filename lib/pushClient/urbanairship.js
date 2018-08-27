const axios = require('axios');
const moment = require('moment-timezone');

class UAWrapper {
  constructor({ key, master, secret }) {
    this.config = {};
    this.config.key = key;
    this.config.master = master;
    this.config.secret = secret;

    if (!this.config.key) {
      throw new Error('Urban Airship key not provided');
    }

    if (!this.config.master) {
      throw new Error('Urban Airship master not provided');
    }

    this.masterAxios = axios.create({
      baseURL: 'https://go.urbanairship.com/',
      headers: {
        Accept: 'application/vnd.urbanairship+json; version=3',
        'Content-Type': 'application/json',
        Authorization: `Basic ${new Buffer(
          `${this.config.key}:${this.config.master}`,
          'utf8'
        ).toString('base64')}`
      }
    });

    this.secretAxios = axios.create({
      baseURL: 'https://go.urbanairship.com/',
      headers: {
        Accept: 'application/vnd.urbanairship+json; version=3',
        'Content-Type': 'application/json',
        Authorization: `Basic ${new Buffer(
          `${this.config.key}:${this.config.secret}`,
          'utf8'
        ).toString('base64')}`
      }
    });
  }

  sendPush(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload must be an object');
    }
    return this.masterAxios.post('/api/push', payload);
  }

  getNamedUsers({ params }) {
    if (params && typeof params !== 'object') {
      throw new Error('Payload must be an object');
    }
    params = params || {};
    return this.masterAxios.get('/api/named_users', { params });
  }

  disassociateNamedUsers(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload must be an object');
    }
    return this.masterAxios.post('/api/named_users/disassociate', payload);
  }

  getDeviceTokensFeedback({ since }) {
    const params = {};
    if (since) {
      params.since = moment(since).format('YYYY-MM-DD');
    }
    return this.masterAxios.get('/api/device_tokens/feedback', { params });
  }

  getAPIDFeedback({ since }) {
    const params = {};
    if (since) {
      params.since = moment(since).format('YYYY-MM-DD');
    }
    return this.masterAxios.get('/api/apids/feedback', { params });
  }
}

module.exports = UAWrapper;
