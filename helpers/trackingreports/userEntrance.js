// const trackingModel = require('../../models/tracking');
const trackingEntranceModel = require('../../models/trackingEntrance');
const mongoose = require('mongoose');
const bluebirdPromise = require('bluebird');
// const commonHelper = require('./../common');
// const userModel = require('../../models/users');
// const clientHandler = require('../../lib/clientHandler');
const akUtils = require('../../lib/utility');

class userEntranceService {
  constructor() {
    this.preFilter = {'sensors.user.id': { $exists: true } };
  }
  
  userEntrance(event) {
    const key = 'sensorEntrance';
    return bluebirdPromise.all([
      this.userEntranceData(
        this.getFilterParams(event, key),
        this.getExtraParams(event, key),
        key
      ),
      this.userEntranceCount(this.getFilterParams(event, key))
    ]);
  }

  userEntranceData(filterParams, otherParams, key) {
    // preFilter = {'sensors.user.id': {$exists: true} };
    return trackingEntranceModel
      .aggregate([
        { $match: filterParams },
        { $sort: { 'updatedAt': 1 } },
        { $group: {
          _id: {
            userId: '$sensors.user.id', 
            locationId: '$location.id' 
          },
          userName: { $first: '$sensors.user.name'}, 
          locationName: { $first: '$location.name'},  
          totalInterval: {$sum : '$interval' },
          firstEntry: {$first : '$entryTime' },
          lastEntry: {$last : '$exitTime' }
        } },
        { $sort: otherParams.sort },
        { $skip: otherParams.pageParams.offset },
        { $limit: otherParams.pageParams.limit },
      ])
      .exec()
      // .then(result => result.map(x => this.formatResponse(x, key)))
      .then(result => {
        if (!result.length) {
          return bluebirdPromise.reject();
        }
        return bluebirdPromise.resolve(result);
      });
  }

  userEntranceCount(filterParams, key) {
    return trackingEntranceModel
      .aggregate([
        { $match: filterParams },
        { $group: {
          _id: { 
            userId: '$sensors.user.id', 
            locationId: '$location.id' 
          }
        } }
      ]).exec().then(result => { return result.length; });
  }

  userSensorEntranceFilters(event) {
    const filters = this.preFilter;
    if (event.queryStringParameters.filter) {
      filters.$or = [
        {
          pkid: new RegExp(event.queryStringParameters.filter, 'i')
        },
        {
          'device.name': new RegExp(event.queryStringParameters.filter, 'i')
        },
        {
          'device.code': new RegExp(event.queryStringParameters.filter, 'i')
        },
        {
          'location.code': new RegExp(event.queryStringParameters.filter, 'i')
        },
        {
          'location.name': new RegExp(event.queryStringParameters.filter, 'i')
        },
        {
          'location.floor.code': new RegExp(event.queryStringParameters.filter, 'i')
        },
        {
          'location.floor.name': new RegExp(event.queryStringParameters.filter, 'i')
        },
        {
          'location.floor.zone.code': new RegExp(event.queryStringParameters.filter, 'i')
        },
        {
          'location.floor.zone.name': new RegExp(event.queryStringParameters.filter, 'i')
        },
        {
          'sensors.name': new RegExp(event.queryStringParameters.filter, 'i')
        },
        {
          'sensors.code': new RegExp(event.queryStringParameters.filter, 'i')
        }
      ];
    }

    if (event.queryStringParameters.location) {
      filters['location.id'] = mongoose.Types.ObjectId(event.queryStringParameters.location);
    }
    if (event.queryStringParameters.floor) {
      filters['location.floor.id'] = mongoose.Types.ObjectId(event.queryStringParameters.floor);
    }
    if (event.queryStringParameters.zone) {
      filters['location.floor.zone.id'] = mongoose.Types.ObjectId(event.queryStringParameters.zone);
    }
    if (event.queryStringParameters.user) {
      filters['sensors.user.id'] = mongoose.Types.ObjectId(event.queryStringParameters.user);
    }
    if (event.queryStringParameters.timeFrom || event.queryStringParameters.timeTo) {
      filters.entryTime = {};
      filters.exitTime = {};
    }

    if (event.queryStringParameters.timeFrom) {
      filters.entryTime.$gt = new Date(event.queryStringParameters.timeFrom);
      filters.exitTime.$gt = new Date(event.queryStringParameters.timeFrom);
    }

    if (event.queryStringParameters.timeTo) {
      filters.entryTime.$lt = new Date(event.queryStringParameters.timeTo);
      filters.exitTime.$lt = new Date(event.queryStringParameters.timeTo);
    }

    return filters;
  }

  getFilterParams(event, key) {
    switch (key) {
      case 'sensorEntrance':
        return this.userSensorEntranceFilters(event);
      default:
        return {};
    }
  }

  getExtraParams(event, key) {
    const params = {};
    params.sort = {};
    const offset = event.queryStringParameters.offset ? event.queryStringParameters.offset : 0;
    const limit = event.queryStringParameters.limit ? event.queryStringParameters.limit : 20;
    params.pageParams = {
      offset: parseInt(offset, 10),
      limit: parseInt(limit, 10)
    };
    if (event.queryStringParameters.sort) {
      const sortQuery = event.queryStringParameters.sort;
      const sortColumns = sortQuery.split(',');
      sortColumns.forEach(function(col) {
        let sortOrder = 1;
        col = col.trim();
        const isValidColumn =
          this.getColumnMap(col, key) || this.getColumnMap(col.replace('-', ''), key);
        if (isValidColumn) {
          if (col.startsWith('-')) {
            sortOrder = -1;
            col = col.replace('-', '');
          }

          col = this.getColumnMap(col, key);
          params.sort[col] = sortOrder;
        }
      }, this);
    } else {
      params.sort.updatedAt = -1;
    }

    return params;
  }

  getColumnMap(col, key) {
    let map;
    switch (key) {
      case 'sensorEntrance':
        map = {
          'userName': 'userName',
          'locationName': 'locationName',
          'totalInterval': 'totalInterval'
        };
        break;

      default:
        map = {};
    }

    if (col) {
      return map[col] || col;
    }
    return map;
  }
}

module.exports = new userEntranceService();
