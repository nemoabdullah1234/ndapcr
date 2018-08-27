/* jshint esversion: 6 */
/* jshint node: true */

const cache = function() {
  this.cacheClient = {};
  this.cacheDriver = {};
  this.cacheType = 'memcached';
  // this.config = require("../config").config;

  if (this.cacheType === 'redis') {
    const redis = require('redis');
    this.cacheClient = redis.createClient(process.env.cacheHost, process.env.cachePort);
    this.cacheClient.on('error', err => {
      // console.log(`Error ${err}`);
    });
  } else if (this.cacheType === 'memcached') {
    const Memcached = require('memcached');
    this.cacheClient = new Memcached(process.env.cacheHost, process.env.cachePort);
    this.cacheClient.on('failure', err => {
      // console.log(`Error ${err}`);
    });
  } else if (this.cacheType === 'memcache') {
    const Memcache = require('memcache');
    this.cacheClient = new Memcache.Client(process.env.cacheHost, process.env.cachePort);
    this.cacheClient.on('connect', () => {
      // no arguments - we've connected
    });

    this.cacheClient.on('close', () => {
      // no arguments - connection has been closed
    });

    this.cacheClient.on('timeout', () => {
      // no arguments - socket timed out
    });

    this.cacheClient.on('error', e => {
      // there was an error - exception is 1st argument
    });

    // connect to the memcache server after subscribing to some or all of these events
    this.cacheClient.connect();
  }

  this.getClient = function() {
    return this.cacheClient;
  };

  this.set = function(key, value, callback, timeout) {
    if (typeof timeout === 'undefined') {
      timeout = 24 * 3600;
    }
    if (this.cacheType === 'memcache') {
      this.cacheClient.set(key, value, timeout, callback);
    }
    if (this.cacheType === 'memcached') {
      this.cacheClient.set(key, value, timeout, callback);
    }
  };

  this.getData = function(key, callback) {
    let res = {};
    if (this.cacheType === 'memcache') {
      this.cacheClient.get(key, (err, result) => {
        res = result;
        callback(null, result);
      });
      return res;
    } else if (this.cacheType === 'memcached') {
      this.cacheClient.get(key, (err, result) => {
        res = result;
        callback(null, result);
      });
      return res;
    }
    const data = this.cacheClient.get(key, callback);
    return typeof data !== 'undefined' ? data : null;
  };

  this.remove = function() {};

  this.close = function() {
    if (this.cacheType === 'memcache') {
      this.cacheClient.close();
    } else if (this.cacheType === 'memcached') {
      this.cacheClient.end();
    }
  };
};

module.exports = new cache();
