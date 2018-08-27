const trackingModel = require('../../models/tracking');
const trackingEntranceModel = require('../../models/trackingEntrance');
const mongoose = require('mongoose');
const bluebirdPromise = require('bluebird');
const commonHelper = require('./../common');
const userModel = require('../../models/users');
const clientHandler = require('../../lib/clientHandler');
const akUtils = require('../../lib/utility');

class trackingEntranceService {
  sensorEntrance(event) {
    const key = 'sensorEntrance';
    return bluebirdPromise.all([
      this.sensorEntranceData(
        this.getFilterParams(event, key),
        this.getExtraParams(event, key),
        key
      ),
      this.sensorEntranceCount(this.getFilterParams(event, key))
    ]);
  }

  sensorEntranceData(filterParams, otherParams, key) {
    return trackingEntranceModel
      .find(filterParams)
      .sort(otherParams.sort)
      .skip(otherParams.pageParams.offset)
      .limit(otherParams.pageParams.limit)
      .exec()
      .then(result => result.map(x => this.formatResponse(x, key)))
      .then(result => {
        if (!result.length) {
          return bluebirdPromise.reject();
        }
        return bluebirdPromise.resolve(result);
      });
  }

  sensorEntranceCount(filterParams, key) {
    return trackingEntranceModel.count(filterParams);
  }

  getSensorEntranceFilters(event) {
    const filters = {};
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
    if (event.queryStringParameters.device) {
      filters['device.id'] = mongoose.Types.ObjectId(event.queryStringParameters.device);
    }

    if (event.queryStringParameters.entryTimeFrom || event.queryStringParameters.entryTimeTo) {
      filters.entryTime = {};
    }

    if (event.queryStringParameters.entryTimeFrom) {
      filters.entryTime.$gte = new Date(event.queryStringParameters.entryTimeFrom);
    }

    if (event.queryStringParameters.entryTimeTo) {
      filters.entryTime.$lte = akUtils.formatToDateFilter(
        new Date(event.queryStringParameters.entryTimeTo)
      );
    }

    if (event.queryStringParameters.exitTimeFrom || event.queryStringParameters.exitTimeTo) {
      filters.exitTime = {};
    }

    if (event.queryStringParameters.exitTimeFrom) {
      filters.exitTime.$gte = new Date(event.queryStringParameters.exitTimeFrom);
    }

    if (event.queryStringParameters.exitTimeTo) {
      filters.exitTime.$lte = akUtils.formatToDateFilter(
        new Date(event.queryStringParameters.exitTimeTo)
      );
    }

    return filters;
  }

  formatResponse(data, key) {
    let formattedResponse;
    switch (key) {
      case 'sensorEntrance':
        formattedResponse = {
          id: data._id,
          updatedAt: data.updatedAt,
          pkid: data.pkid,
          exitTime: data.exitTime,
          entryTime: data.entryTime,
          type: data.type,
          device: data.device,
          location: data.location,
          sensor: {
            id: data.sensors.id,
            code: data.sensors.code,
            name: data.sensors.name
          }
        };
        return formattedResponse;
      default:
        return null;
    }
  }

  getFilterParams(event, key) {
    switch (key) {
      case 'sensorEntrance':
        return this.getSensorEntranceFilters(event);
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
      params.sort.updatedOn = -1;
    }

    return params;
  }

  getColumnMap(col, key) {
    let map;
    switch (key) {
      case 'sensorEntrance':
        map = {
          id: '_id',
          entryTime: 'entryTime',
          exitTime: 'exitTime',
          updatedAt: 'updatedAt',
          pkid: 'pkid'
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

module.exports = new trackingEntranceService();
