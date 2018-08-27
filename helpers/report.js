/* jshint esversion: 6 */

// var mongoose = require('mongoose');
const bluebirdPromise = require('bluebird');
const mongoose = require('mongoose');
const commonHelper = require('./common');
const configurationHelper = require('./configuration');
// const tagHelper = require('../helpers/tags');
// var shipmentTrackingmodel = require('../models/shipmentTracking');
const shipmentmodel = require('../models/shipment');
const issueModel = require('../models/issue');
const productModel = require('../models/product');
const ordermodel = require('../models/order');
const thingsModel = require('../models/things');
// const validator = require('../lib/validatorAsync');
const akUtils = require('../lib/utility');
// const jsTypeChecker = require('javascript-type-checker');
const reportService = function reportService() {};
const shipmentStatusMap = require('../mappings/shipmentStatus.json');
const orderStatusMap = require('../mappings/orderStatus');
const shipmentStatusLabel = require('../mappings/shipmentStatusLabel.json');
const orderStatusLabelMap = require('../mappings/orderStatusLabel.json');
const timediff = require('timediff');
const clientHandler = require('../lib/clientHandler');
const thingsmodel = require('../models/things');
const trackingModel = require('../models/tracking');
const userModel = require('../models/users');
const loginHistoryModel = require('../models/loginHistory');

const yesNoValues = ['No', 'Yes'];
// let onOffValues = ["Off", "On"];
/**
 * Set client of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
reportService.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

/**
 * Query the database to fetch reports on the basis of search parameters and other parameters
 * 
 * @param {Object} searchParams search filters
 * @param {Object} otherParams pagination, sorting etc other params.
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
reportService.prototype.get = function(event) {
  // mongoose.set('debug', true);
  switch (event.queryStringParameters.type) {
    case 'case_status':
      return this.case_status(event);

    case 'shipment_status':
      return this.shipment_status(event);

    case 'cases_by_surgery_type':
      return this.ordersBySurgery(event, 'cases_by_surgery_type');

    case 'cases_by_surgeon':
      return this.orderspersurgeon(event, 'cases_by_surgeon');

    case 'case_per_sales_rep':
      return this.case_per_sales_rep(event);

    case 'shipments_per_carrier':
      return this.shipments_per_carrier(event);

    case 'cases_per_hospital':
      return this.ordersPerHospital(event, 'cases_per_hospital');

    case 'case_status_between_date':
      return this.case_status_between_date(event);

    case 'shipment_status_between_date':
      return this.shipment_status_between_date(event);

    case 'app_status':
      return this.appStatus(event, 'app_status');

    case 'shipments_due':
      return this.shipmentDue(event, 'shipments_due');

    case 'open_issues':
      return this.openIssuesWidgetData(event.queryStringParameters);

    case 'orders_due':
      return this.ordersDueWidgetData(event);

    case 'orders_per_city':
      return this.ordersPerCity(event, 'orders_per_city');
    case 'beacons_per_firmware':
      return this.beaconsPerFirmwareWidget(event);
    case 'beacons_per_beacontype':
      return this.beaconsPerBeaconTypeWidget(event);
    case 'beacons_per_lastconnection':
      return this.beaconsPerLastConnectionWidget(event);
    case 'beacons_per_batterylevel':
      return this.beaconsPerBatteryLevelWidget(event);
    default:
      return [];
  }
};

// reportService.prototype.ordersPerCityWidget = function() {
//   return ordermodel
//     .aggregate([
//       {
//         $match: clientHandler.addClientFilterToConditions({})
//       },
//       {
//         $addFields: {
//           toAddress: {
//             $filter: {
//               input: `$addresses`,
//               as: 'address',
//               cond: {
//                 $eq: ['$$address.addressType', 'toAddress']
//               }
//             }
//           }
//         }
//       },
//       {
//         $unwind: '$toAddress'
//       },
//       ...akUtils.getMongoSysAttrsToObjQuery('toAddress.address'),
//       {
//         $group: {
//           _id: '$sysAttributes.city',
//           count: {
//             $sum: 1
//           }
//         }
//       },
//       {
//         $sort: {
//           _id: 1
//         }
//       }
//       // {
//       //   $group: {
//       //     _id: '$sysAttributes.city',
//       //     count: {
//       //       $sum: 1
//       //     }
//       //   }
//       // }
//     ])
//     .exec()
//     .then(data =>
//       data.map(x => ({
//         label: x._id,
//         value: x.count
//       }))
//     );
// };

reportService.prototype.openIssuesWidgetData = function(queryStringParameters) {
  const isForFuture = false;
  const unit = queryStringParameters.unit;
  const ranges = this.convertWidgetQueryTimeRanges(queryStringParameters.ranges, unit);

  return bluebirdPromise.map(ranges, range =>
    issueModel
      .aggregate([
        {
          $match: clientHandler.addClientFilterToConditions({
            issueStatus: {
              $in: [1]
            }
          })
        },
        {
          $addFields: {
            difference: {
              $subtract: ['$createdOn', new Date()]
            }
          }
        },
        {
          $match: this.createWidgetPeriodConditions(range, 'difference', isForFuture)
        },
        {
          $count: 'count'
        }
      ])
      .exec()
      .then(data => ({
        label: this.getLabelFromTimeRange(range, unit, isForFuture),
        value: (data[0] || {}).count || 0
      }))
  );
};

reportService.prototype.ordersDueWidgetData = function(event) {
  const orderHelper = require('./order');
  const unit = event.queryStringParameters.unit;
  const isForFuture = true;
  const ranges = this.convertWidgetQueryTimeRanges(event.queryStringParameters.ranges, unit);

  return bluebirdPromise.map(ranges, range =>
    ordermodel
      .aggregate([
        {
          $addFields: {
            consumerForSearch: {
              $concat: ['$consumer.firstName', ' ', '$consumer.lastName']
            }
          }
        },
        {
          $match: orderHelper.getFilterParams(event)
        },
        {
          $match: clientHandler.addClientFilterToConditions({
            etd: {
              $gte: new Date()
            },
            orderStatus: {
              $nin: [
                orderStatusMap.Delivered,
                orderStatusMap.Submitted,
                orderStatusMap.Canceled,
                orderStatusMap.Closed
              ]
            }
          })
        },
        {
          $addFields: {
            difference: {
              $subtract: ['$etd', new Date()]
            }
          }
        },
        {
          $match: this.createWidgetPeriodConditions(range, 'difference', isForFuture)
        },
        {
          $count: 'count'
        }
      ])
      .exec()
      .then(data => {
        const label = this.getLabelFromTimeRange(range, unit, isForFuture);
        return {
          label,
          value: (data[0] || {}).count || 0
        };
      })
  );
};

reportService.prototype.beaconsPerLastConnectionWidget = function(event) {
  const thingsHelper = require('./things');
  const unit = event.queryStringParameters.unit;
  const isForFuture = false;
  const ranges = this.convertWidgetQueryTimeRanges(event.queryStringParameters.ranges, unit);
  const filterEvent = commonHelper.deepCloneObject(event)
  filterEvent.queryStringParameters.type = undefined
  return thingsmodel
    .aggregate([
      {
        $match: clientHandler.addClientFilterToConditions(
          thingsHelper.getFilterParams(filterEvent)
        )
      },
      {
        $unwind: '$attributes'
      },
      {
        $match: {
          'attributes.name': 'last_connection'
        }
      }
    ])
    .exec()
    .then(data => {
      const currentTimeInMs = Date.now();
      const result = {};
      result.NA = data.filter(x => !x.attributes.value).length;
      data = data.filter(x => !!x.attributes.value);
      const rangeObj = ranges.reduce((rangeObj, item) => {
        rangeObj.push({
          range: item,
          label: this.getLabelFromTimeRange(item, unit, isForFuture),
          value: data.filter(x => {
            if (item[0] !== null && item[1] !== null) {
              return (
                currentTimeInMs - new Date(x.attributes.value) > item[0] &&
                currentTimeInMs - new Date(x.attributes.value) <= item[1]
              );
            } else if (item[0] !== null) {
              return currentTimeInMs - new Date(x.attributes.value) > item[0];
            } else if (item[1] !== null) {
              return currentTimeInMs - new Date(x.attributes.value) <= item[1];
            }
          }).length
        });
        return rangeObj;
      }, []);

      for (let i = 0; i < rangeObj.length; i++) {
        result[rangeObj[i].label] = rangeObj[i].value;
      }
      return Object.getOwnPropertyNames(result).reduce((resultArr, label) => {
        resultArr.push({
          label,
          value: result[label]
        });
        return resultArr;
      }, []);
    });
};

// reportService.prototype.shipmentsDueWidgetData = function(queryStringParameters) {
//   const unit = queryStringParameters.unit;
//   const isForFuture = true;
//   const ranges = this.convertWidgetQueryTimeRanges(queryStringParameters.ranges, unit);

//   return bluebirdPromise.map(ranges, range =>
//     shipmentmodel
//       .aggregate([
//         {
//           $match: clientHandler.addClientFilterToConditions({
//             shipmentStatus: {
//               $in: [10, 20, 25, 30, 40]
//             }
//           })
//         },
//         {
//           $addFields: {
//             difference: {
//               $subtract: ['$etd', new Date()]
//             }
//           }
//         },
//         {
//           $match: this.createWidgetPeriodConditions(range, 'difference', isForFuture)
//         },
//         {
//           $count: 'count'
//         }
//       ])
//       .exec()
//       .then(data => {
//         let label = this.getLabelFromTimeRange(range, unit, isForFuture);
//         if (label === 'Less than 0 hours') {
//           label = 'Overdue';
//         }
//         return {
//           label,
//           value: (data[0] || {}).count || 0
//         };
//       })
//   );
// };

reportService.prototype.getLabelFromTimeRange = function(range, unit, isForFuture) {
  let label = '';
  if (range[0] !== null && range[1] !== null) {
    label = `${akUtils.convertFromMilliseconds(
      range[0],
      unit
    )} to ${akUtils.convertFromMilliseconds(range[1], unit)} ${unit}`;
  } else if (range[0] !== null) {
    label = `More than ${akUtils.convertFromMilliseconds(range[0], unit)} ${unit}`;
  } else if (range[1] !== null) {
    label = `Less than ${akUtils.convertFromMilliseconds(range[1], unit)} ${unit}`;
  }
  return label;
};

reportService.prototype.getLabelFromRange = function(range, unit) {
  let label = '';
  if (range[0] !== null && range[1] !== null) {
    label = `${range[0]} to ${range[1]} ${unit}`;
  } else if (range[0] !== null) {
    label = `More than ${range[0]} ${unit}`;
  } else if (range[1] !== null) {
    label = `Less than ${range[1]} ${unit}`;
  }
  return label;
};

reportService.prototype.createWidgetPeriodConditions = function(range, field, isForFuture) {
  let operators;
  if (isForFuture) {
    operators = ['$gt', '$lte'];
  } else {
    operators = ['$lt', '$gte'];
  }
  const conditions = {};
  conditions[field] = {};
  if (range[0] !== null) {
    conditions[field][operators[0]] = range[0];
  }
  if (range[1] !== null) {
    conditions[field][operators[1]] = range[1];
  }
  // console.log(conditions);
  return clientHandler.addClientFilterToConditions(conditions);
};

reportService.prototype.convertWidgetQueryTimeRanges = function(ranges, unit) {
  const periodRanges = (ranges || '').split(',');
  for (let i = 0; i < periodRanges.length; i++) {
    periodRanges[i] = periodRanges[i].split('-');
    if (isNaN(periodRanges[i][0]) || !periodRanges[i][0]) {
      periodRanges[i][0] = null;
    } else {
      periodRanges[i][0] = akUtils.convertToMilliseconds(periodRanges[i][0], unit);
    }
    if (isNaN(periodRanges[i][1]) || !periodRanges[i][1]) {
      periodRanges[i][1] = null;
      if (periodRanges[i][0] === null) {
      }
    } else {
      periodRanges[i][1] = akUtils.convertToMilliseconds(periodRanges[i][1], unit);
    }
  }
  return periodRanges.filter(x => x[0] !== null || x[1] !== null).map(x => [x[0], x[1]]);
};

// reportService.prototype.appStatusWidgetData = function() {
//   const thingsModel = require('../models/things');
//   return thingsmodel
//     .aggregate([
//       {
//         $match: clientHandler.addClientFilterToConditions({
//           type: 'software'
//         })
//       },
//       {
//         $lookup: {
//           from: 'devicetrackings',
//           localField: '_id',
//           foreignField: 'device.id',
//           as: 'trackingData'
//         }
//       },
//       {
//         $unwind: {
//           path: '$trackingData',
//           preserveNullAndEmptyArrays: true
//         }
//       },
//       {
//         $project: {
//           status: 1,
//           isReporting: {
//             $ifNull: ['$trackingData.isReporting', 0]
//           }
//         }
//       }
//     ])
//     .then(data => {
//       // console.log(data);
//       const result = {
//         Inactive: 0,
//         Reporting: 0,
//         'Not Reporting': 0
//       };

//       for (let i = 0; i < data.length; i += 1) {
//         const elem = data[i];
//         if (elem.status === 0) {
//           result.Inactive += 1;
//         } else if (elem.isReporting === 1) {
//           result.Reporting += 1;
//         } else if (elem.isReporting === 0) {
//           result['Not Reporting'] += 1;
//         }
//       }

//       // console.log(result);
//       const resultArr = [
//         {
//           label: 'Inactive',
//           value: result.Inactive
//         },
//         {
//           label: 'Reporting',
//           value: result.Reporting
//         },
//         {
//           label: 'Not Reporting',
//           value: result['Not Reporting']
//         }
//       ];

//       return resultArr;
//     });
// };

reportService.prototype.formatSampleReportData = function(data) {
  const formattedResponse = {};
  formattedResponse.orderedDate = data.orderedDate;
  formattedResponse.orderStatus = data.orderStatus;
  formattedResponse.name = data.name;
  formattedResponse.code = data.code;
  return formattedResponse;
};

reportService.prototype.beaconsPerBatteryLevelWidget = function(event) {
  const thingsHelper = require('./things');
  const unit = event.queryStringParameters.unit;
  const filterEvent = commonHelper.deepCloneObject(event)
  filterEvent.queryStringParameters.type = undefined
  const periodRanges = (event.queryStringParameters.ranges || '').split(',');
  for (let i = 0; i < periodRanges.length; i++) {
    periodRanges[i] = periodRanges[i].split('-');
    if (isNaN(periodRanges[i][0]) || !periodRanges[i][0]) {
      periodRanges[i][0] = null;
    } else {
      periodRanges[i][0] = Number(periodRanges[i][0]);
    }
    if (isNaN(periodRanges[i][1]) || !periodRanges[i][1]) {
      periodRanges[i][1] = null;
      if (periodRanges[i][0] === null) {
      }
    } else {
      periodRanges[i][1] = Number(periodRanges[i][1]);
    }
  }
  const ranges = periodRanges.filter(x => x[0] !== null || x[1] !== null).map(x => [x[0], x[1]]);
  // const ranges = this.convertWidgetQueryTimeRanges(queryStringParameters.ranges, unit);

  return thingsmodel
    .aggregate([
      {
        $match: clientHandler.addClientFilterToConditions(thingsHelper.getFilterParams(filterEvent))
      },
      {
        $unwind: '$attributes'
      },
      {
        $match: {
          'attributes.name': 'battery_level'
        }
      }
    ])
    .exec()
    .then(data => {
      const currentTimeInMs = Date.now();
      const result = {};
      result.NA = data.filter(x => !x.attributes.value).length;
      data = data.filter(x => !!x.attributes.value);
      // console.log(ranges);
      const rangeObj = ranges.reduce((rangeObj, item) => {
        rangeObj.push({
          range: item,
          label: this.getLabelFromRange(item, unit),
          value: data.filter(x => {
            if (item[0] !== null && item[1] !== null) {
              return Number(x.attributes.value) > item[0] && Number(x.attributes.value) <= item[1];
            } else if (item[0] !== null) {
              return Number(x.attributes.value) > item[0];
            } else if (item[1] !== null) {
              return Number(x.attributes.value) <= item[1];
            }
          }).length
        });
        return rangeObj;
      }, []);

      for (let i = 0; i < rangeObj.length; i++) {
        result[rangeObj[i].label] = rangeObj[i].value;
      }
      return Object.getOwnPropertyNames(result).reduce((resultArr, label) => {
        resultArr.push({
          label,
          value: result[label]
        });
        return resultArr;
      }, []);
    });
};

reportService.prototype.beaconsPerBeaconTypeWidget = function(event) {
  const thingsHelper = require('./things');
  const filterEvent = commonHelper.deepCloneObject(event)
  filterEvent.queryStringParameters.type = undefined
  return thingsModel
    .aggregate([
      {
        $match: clientHandler.addClientFilterToConditions(thingsHelper.getFilterParams(filterEvent))
      },
      {
        $unwind: '$attributes'
      },
      {
        $match: {
          'attributes.name': 'beaconType'
        }
      },
      {
        $group: {
          _id: '$attributes.value',
          count: {
            $sum: 1
          }
        }
      }
    ])
    .exec()
    .then(result =>
      result.map(x => ({
        label: x._id || 'NA',
        value: x.count
      }))
    )
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

reportService.prototype.beaconsPerFirmwareWidget = function(event) {
  const thingsHelper = require('./things');
  const filterEvent = commonHelper.deepCloneObject(event)
  filterEvent.queryStringParameters.type = undefined
  return thingsModel
    .aggregate([
      {
        $match: clientHandler.addClientFilterToConditions(thingsHelper.getFilterParams(filterEvent))
      },
      {
        $unwind: '$attributes'
      },
      {
        $match: {
          'attributes.name': 'firmware'
        }
      },
      {
        $group: {
          _id: '$attributes.value',
          count: {
            $sum: 1
          }
        }
      }
    ])
    .exec()
    .then(result =>
      result.map(x => ({
        label: x._id || 'NA',
        value: x.count
      }))
    )
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

reportService.prototype.case_status = function(event) {
  const orderHelper = require('./order');
  return ordermodel
    .aggregate([
      {
        $addFields: {
          consumerForSearch: {
            $concat: ['$consumer.firstName', ' ', '$consumer.lastName']
          }
        }
      },
      {
        $match: clientHandler.addClientFilterToConditions(
          orderHelper.getFilterParams(event)
          //   {
          //   createdOn: {
          //     $gte: akUtils.subtractDaysFromDate(new Date(), 15, 'iso', 'utc')
          //   }
          // }
        )
      },
      {
        $group: {
          _id: '$orderStatus',
          count: {
            $sum: 1
          }
        }
      }
    ])
    .exec()
    .then(result => {
      const list = [];
      if (result) {
        for (const i in result) {
          if (result.hasOwnProperty(i)) {
            const resultData = this.formatStatusResponse(result[i], 'orderStatusLabel');
            if (resultData) {
              list.push(resultData);
            }
          }
        }
      }
      return list;
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

reportService.prototype.case_status_between_date = function(event) {
  const orderHelper = require('./order');
  const fromDate = event.queryStringParameters.fromDate || new Date().toISOString();
  const toDate =
    event.queryStringParameters.toDate ||
    akUtils.addDaysToDate(new Date(fromDate), 1, 'iso', 'UTC').toISOString();

  return ordermodel
    .aggregate([
      {
        $addFields: {
          consumerForSearch: {
            $concat: ['$consumer.firstName', ' ', '$consumer.lastName']
          }
        }
      },
      {
        $match: clientHandler.addClientFilterToConditions(
          orderHelper.getFilterParams(event)
          //   {
          //   etd: {
          //     $gte: new Date(fromDate),
          //     $lt: new Date(toDate)
          //   }
          // }
        )
      },
      {
        $group: {
          _id: '$orderStatus',
          count: {
            $sum: 1
          }
        }
      }
    ])
    .exec()
    .then(result => {
      // console.log(result);
      const list = [];
      if (result) {
        for (const i in result) {
          if (result.hasOwnProperty(i)) {
            const resultData = this.formatStatusResponse(result[i], 'orderStatusLabel');
            if (resultData) {
              list.push(resultData);
            }
          }
        }
      }
      return list;
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

reportService.prototype.shipment_status_between_date = function(event) {
  const shipmentHelper = require('./shipment');
  const fromDate = event.queryStringParameters.fromDate || new Date().toISOString();
  const toDate =
    event.queryStringParameters.toDate ||
    akUtils.addDaysToDate(new Date(fromDate), 1, 'iso', 'UTC').toISOString();

  return shipmentmodel
    .aggregate([
      {
        $addFields: {
          consumerForSearch: {
            $concat: ['$carrierUser.firstName', ' ', '$carrierUser.lastName']
          }
        }
      },
      {
        $match: clientHandler.addClientFilterToConditions(
          shipmentHelper.getFilterParams(event)
          //   {
          //   etd: {
          //     $gte: new Date(fromDate),
          //     $lt: new Date(toDate)
          //   }
          // }
        )
      },
      {
        $group: {
          _id: '$shipmentStatus',
          count: {
            $sum: 1
          }
        }
      }
    ])
    .exec()
    .then(result => {
      // console.log(result);
      const list = [];
      if (result) {
        for (const i in result) {
          if (result.hasOwnProperty(i)) {
            const resultData = this.formatStatusResponse(result[i], 'orderStatusLabel');
            if (resultData) {
              list.push(resultData);
            }
          }
        }
      }
      return list;
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

reportService.prototype.case_per_sales_rep = function(event) {
  const orderHelper = require('./order');
  return ordermodel
    .aggregate([
      {
        $addFields: {
          consumerForSearch: {
            $concat: ['$consumer.firstName', ' ', '$consumer.lastName']
          }
        }
      },
      {
        $match: clientHandler.addClientFilterToConditions(orderHelper.getFilterParams(event))
      },

      {
        $addFields: {
          salesRepName: {
            $cond: [
              {
                $or: [
                  { $in: ['$consumerForSearch', ['', ' ']] },
                  { $eq: ['$consumerForSearch', undefined] }
                ]
              },
              'Unassigned',
              '$consumerForSearch'
            ]
          }
        }
      },
      {
        $group: {
          _id: '$consumerForSearch',
          count: {
            $sum: 1
          }
        }
      }
    ])
    .exec()
    .then(result => {
      const list = [];
      if (result) {
        for (const i in result) {
          if (result.hasOwnProperty(i)) {
            const resultData = this.formatSalesRep(result[i]);
            if (resultData) {
              list.push(resultData);
            }
          }
        }
      }
      return list;
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

reportService.prototype.shipments_per_carrier = function(event) {
  const shipmentHelper = require('./shipment');
  return shipmentmodel
    .aggregate([
      {
        $addFields: {
          consumerForSearch: {
            $concat: ['$carrierUser.firstName', ' ', '$carrierUser.lastName']
          }
        }
      },
      {
        $match: clientHandler.addClientFilterToConditions(shipmentHelper.getFilterParams(event))
      },

      {
        $addFields: {
          carrierName: {
            $cond: [
              {
                $or: [
                  { $in: ['$consumerForSearch', ['', ' ']] },
                  { $eq: ['$consumerForSearch', undefined] }
                ]
              },
              'Unassigned',
              '$consumerForSearch'
            ]
          }
        }
      },
      {
        $group: {
          _id: '$consumerForSearch',
          count: {
            $sum: 1
          }
        }
      }
    ])
    .exec()
    .then(result => {
      // console.log(result);
      const list = [];
      if (result) {
        for (const i in result) {
          if (result.hasOwnProperty(i)) {
            const resultData = this.formatSalesRep(result[i]);
            if (resultData) {
              list.push(resultData);
            }
          }
        }
      }
      return list;
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

reportService.prototype.shipment_status = function(event) {
  const shipmentHelper = require('./shipment');
  return shipmentmodel
    .aggregate([
      {
        $addFields: {
          consumerForSearch: {
            $concat: ['$carrierUser.firstName', ' ', '$carrierUser.lastName']
          }
        }
      },
      {
        $match: clientHandler.addClientFilterToConditions(
          shipmentHelper.getFilterParams(event)
          //   {
          //   createdOn: {
          //     $gte: akUtils.subtractDaysFromDate(new Date(), 15, 'iso', 'utc')
          //   }
          // }
        )
      },
      {
        $group: {
          _id: '$shipmentStatus',
          count: {
            $sum: 1
          }
        }
      }
    ])
    .exec()
    .then(result => {
      const list = [];
      if (result) {
        for (const i in result) {
          if (result.hasOwnProperty(i)) {
            const resultData = this.formatStatusResponse(result[i], 'shipmentStatusLabel');
            if (resultData) {
              list.push(resultData);
            }
          }
        }
      }
      // console.log(list);
      return list;
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

reportService.prototype.cases_by_surgery_type = function() {
  return ordermodel
    .aggregate([
      {
        $match: clientHandler.addClientFilterToConditions({})
      },
      {
        $project: {
          attributes: {
            $filter: {
              input: '$attributes',
              as: 'attributes',
              cond: {
                $eq: ['$$attributes.name', 'surgery']
              }
            }
          },
          _id: 0
        }
      },
      {
        $group: {
          _id: '$attributes.value',
          count: {
            $sum: 1
          }
        }
      }
    ])
    .exec()
    .then(result => {
      const list = [];
      if (result) {
        for (const i in result) {
          if (result.hasOwnProperty(i)) {
            const resultData = this.formatGetTypeResponse(result[i]);
            if (resultData) {
              list.push(resultData);
            }
          }
        }
      }
      // console.log(list);
      return list;
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

reportService.prototype.cases_per_hospital = function() {
  return ordermodel
    .aggregate([
      {
        $match: clientHandler.addClientFilterToConditions({})
      },
      {
        $project: {
          addresses: {
            $filter: {
              input: '$addresses',
              as: 'addresses',
              cond: {
                $eq: ['$$addresses.addressType', 'toAddress']
              }
            }
          },
          _id: 0
        }
      },
      {
        $group: {
          _id: '$addresses.location.name',
          count: {
            $sum: 1
          }
        }
      }
    ])
    .exec()
    .then(result => {
      // // console.log(result);
      const list = [];
      if (result) {
        for (const i in result) {
          if (result.hasOwnProperty(i)) {
            const resultData = this.formatGetTypeResponse(result[i]);
            if (resultData) {
              list.push(resultData);
            }
          }
        }
      }
      // console.log(list);
      return list;
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

reportService.prototype.cases_by_surgeon = function() {
  return ordermodel
    .aggregate([
      {
        $match: clientHandler.addClientFilterToConditions({})
      },
      {
        $project: {
          attributes: {
            $filter: {
              input: '$attributes',
              as: 'attributes',
              cond: {
                $eq: ['$$attributes.name', 'surgeon']
              }
            }
          },
          _id: 0
        }
      },
      {
        $group: {
          _id: '$attributes.value',
          count: {
            $sum: 1
          }
        }
      }
    ])
    .exec()
    .then(result => {
      const list = [];
      if (result) {
        for (const i in result) {
          if (result.hasOwnProperty(i)) {
            const resultData = this.formatGetTypeResponse(result[i]);
            if (resultData) {
              list.push(resultData);
            }
          }
        }
      }
      // console.log(list);
      return list;
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

reportService.prototype.getKeyByValue = function(object, value) {
  for (const prop in object) {
    if (object.hasOwnProperty(prop)) {
      if (object[prop] === value) {
        return prop;
      }
    }
  }
};

reportService.prototype.formatStatusResponse = function(data, mappings) {
  const orderStatusArr = require(`../mappings/${mappings}.json`);
  const formattedResponse = {};
  if (this.getKeyByValue(orderStatusArr, data._id)) {
    formattedResponse.label = this.getKeyByValue(orderStatusArr, data._id);
    formattedResponse.value = data.count;
    return formattedResponse;
  }
};

reportService.prototype.formatSalesRep = function(data) {
  const formattedResponse = {};
  formattedResponse.label = data._id;
  formattedResponse.value = data.count;
  return formattedResponse;
};

reportService.prototype.formatGetTypeResponse = function(data) {
  const formattedResponse = {};
  // // console.log(data);
  if (data._id !== null && data._id[0]) {
    formattedResponse.label = data._id[0];
    formattedResponse.value = data.count;
    return formattedResponse;
  }
};

/**
 * 
 */
reportService.prototype.ordersPerHospital = function(event, widgetName) {
  const params = {};

  params.project = {
    addresses: 1,
    code: 1,
    salesrep: {
      $concat: ['$consumer.firstName', ' ', '$consumer.lastName']
    },
    orderStatus: 1,
    orderedDate: 1,
    etd: 1,
    consumer: 1,
    attributes: 1,
    client: 1,
    patient: {
      $cond: {
        if: {
          $eq: ['$attributes.name', 'patient']
        },
        then: '$attributes.value',
        else: '$attributes.name'
      }
    }
  };

  params.match = {};

  if (event.queryStringParameters && event.queryStringParameters.filter) {
    // filters._all = event.queryStringParameters.filter;
    params.match.$or = [
      {
        'addresses.location.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        code: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'attributes.value': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        salesrep: new RegExp(event.queryStringParameters.filter, 'i')
      }
    ];
    params.match.$or.push({
      orderStatus: akUtils.getOrderStatus(event.queryStringParameters.filter)
    });
  }

  if (event.queryStringParameters.code) {
    params.match.code = new RegExp(event.queryStringParameters.code, 'i');
  }

  if (event.queryStringParameters.orderStatus) {
    params.match.orderStatus = {
      $eq: akUtils.getOrderStatus(event.queryStringParameters.orderStatus)
    };
  }

  if (event.queryStringParameters.surgeryDateFrom || event.queryStringParameters.surgeryDateTo) {
    params.match.etd = {};
  }

  if (event.queryStringParameters.surgeryDateFrom) {
    params.match.etd.$gte = new Date(event.queryStringParameters.surgeryDateFrom);
  }

  if (event.queryStringParameters.surgeryDateTo) {
    params.match.etd.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.surgeryDateTo)
    );
  }

  if (event.queryStringParameters.hospital) {
    params.match.addresses = {
      $elemMatch: {
        addressType: 'toAddress',
        'location.id': mongoose.Types.ObjectId(event.queryStringParameters.hospital)
      }
    };
  }

  if (event.queryStringParameters.salesrep) {
    params.match['consumer.uuid'] = event.queryStringParameters.salesrep;
  }

  params.match = clientHandler.addClientFilterToConditions(params.match);

  params.limit = event.queryStringParameters.limit
    ? parseInt(event.queryStringParameters.limit, 10)
    : 20;
  params.skip = event.queryStringParameters.offset
    ? parseInt(event.queryStringParameters.offset, 10)
    : 0;

  const sorting = this.extractSortOptions(event, 'ordersPerHospital');

  // // console.log(sorting.length);

  params.sort = {};

  if (!Object.keys(sorting).length) {
    // params.sort.addresses = {};
    // params.sort.addresses.location = {};
    params.sort = {
      'addresses.location.name': 1
    };
  } else {
    params.sort = sorting;
  }

  // const util = require('util');
  // // console.log(util.inspect(params, false, null));

  if (widgetName) {
    return this.ordersPerHospitalWidget(params, widgetName, event);
  }
  return bluebirdPromise
    .all([
      // this.ordersPerHospitalData(params),
      this.extractData(params, ordermodel, 'ordersPerHospital'),
      this.extractCount(params, ordermodel)
      // this.ordersPerHospitalCount(params)
    ])
    .then(
      result =>
        // // console.log(result);
        result
    );
};

reportService.prototype.ordersPerHospitalWidget = function(params, widgetName) {
  return ordermodel
    .aggregate([
      {
        $match: clientHandler.addClientFilterToConditions({})
      },
      {
        $project: params.project
      },
      {
        $match: params.match
      },
      {
        $project: {
          toAddress: {
            $filter: {
              input: '$addresses',
              as: 'addresses',
              cond: {
                $eq: ['$$addresses.addressType', 'toAddress']
              }
            }
          },
          _id: 0
        }
      },
      {
        $unwind: '$toAddress'
      },
      {
        $group: {
          _id: '$toAddress.location.name',
          count: {
            $sum: 1
          }
        }
      }
    ])
    .exec()
    .then(data =>
      data.map(x => ({
        label: x._id,
        value: x.count
      }))
    );
};
/**
 * 
 */
reportService.prototype.ordersBySurgery = function(event, widgetName) {
  const params = {};

  params.project = {
    addresses: 1,
    code: 1,
    salesrep: {
      $concat: ['$consumer.firstName', ' ', '$consumer.lastName']
    },
    orderStatus: 1,
    orderedDate: 1,
    etd: 1,
    consumer: 1,
    attributes: 1,
    client: 1,
    patient: {
      $cond: {
        if: {
          $eq: ['$attributes.name', 'patient']
        },
        then: '$attributes.value',
        else: '$attributes.name'
      }
    }
  };

  params.match = {
    attributes: {
      $elemMatch: {
        name: 'surgery',
        value: {
          $ne: ''
        }
      }
    }
  };

  // // console.log(event.queryStringParameters);

  if (event.queryStringParameters && event.queryStringParameters.filter) {
    // filters._all = event.queryStringParameters.filter;
    params.match.$or = [
      {
        code: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'attributes.value': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        salesrep: new RegExp(event.queryStringParameters.filter, 'i')
      }
    ];
    params.match.$or.push({
      orderStatus: akUtils.getOrderStatus(event.queryStringParameters.filter)
    });
  }

  if (event.queryStringParameters.code) {
    params.match.code = new RegExp(event.queryStringParameters.code, 'i');
  }

  if (event.queryStringParameters.orderStatus) {
    params.match.orderStatus = {
      $eq: akUtils.getOrderStatus(event.queryStringParameters.orderStatus)
    };
  }

  if (event.queryStringParameters.surgeryDateFrom || event.queryStringParameters.surgeryDateTo) {
    params.match.etd = {};
  }

  if (event.queryStringParameters.surgeryDateFrom) {
    params.match.etd.$gte = new Date(event.queryStringParameters.surgeryDateFrom);
  }

  if (event.queryStringParameters.surgeryDateTo) {
    params.match.etd.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.surgeryDateTo)
    );
  }

  if (event.queryStringParameters.surgery) {
    params.match.attributes = {
      $elemMatch: {
        name: 'surgery',
        value: new RegExp(event.queryStringParameters.surgery, 'i')
      }
    };
  }

  if (event.queryStringParameters.salesrep) {
    params.match['consumer.uuid'] = event.queryStringParameters.salesrep;
  }

  params.match = clientHandler.addClientFilterToConditions(params.match);

  params.limit = event.queryStringParameters.limit
    ? parseInt(event.queryStringParameters.limit, 10)
    : 20;
  params.skip = event.queryStringParameters.offset
    ? parseInt(event.queryStringParameters.offset, 10)
    : 0;

  const sorting = this.extractSortOptions(event, 'ordersBySurgery');

  // // console.log(sorting.length);

  params.sort = {};

  if (!Object.keys(sorting).length) {
    params.sort.etd = 1;
  } else {
    params.sort = sorting;
  }

  const util = require('util');
  // console.log(util.inspect(params, false, null));

  if (widgetName) {
    return this.ordersBySurgeryWidget(params, widgetName);
  }

  return bluebirdPromise
    .all([
      // this.ordersBySurgeryData(params),
      // this.ordersBySurgeryCount(params)

      this.extractData(params, ordermodel, 'ordersBySurgery'),
      this.extractCount(params, ordermodel)
    ])
    .then(
      result =>
        // // console.log(result);
        result
    );
};

reportService.prototype.ordersBySurgeryWidget = function(params, widgetName) {
  return ordermodel
    .aggregate([
      {
        $match: clientHandler.addClientFilterToConditions({})
      },
      {
        $project: params.project
      },
      {
        $match: params.match
      },
      ...akUtils.getMongoSysAttrsToObjQuery('attributes'),
      {
        $addFields: {
          surgery: '$sysAttributes.surgery'
        }
      },
      {
        $addFields: {
          city: { $ifNull: ['$surgery', ''] }
        }
      },
      {
        $group: {
          _id: '$surgery',
          count: {
            $sum: 1
          }
        }
      },
      {
        $sort: {
          _id: 1
        }
      }
    ])
    .exec()
    .then(data =>
      data.map((x, i) => {
        // console.log(`${x.count}+`);
        return {
          label: x._id,
          value: x.count
        };
      })
    );
};

/**
 * 
 */
reportService.prototype.ordersNotClosed = function(event) {
  const params = {};

  params.project = {
    addresses: 1,
    code: 1,
    salesrep: {
      $concat: ['$consumer.firstName', ' ', '$consumer.lastName']
    },
    orderStatus: 1,
    orderedDate: 1,
    etd: 1,
    consumer: 1,
    attributes: 1,
    client: 1,
    dateDiff: {
      $subtract: [new Date(), '$etd']
    }
  };

  params.match = {};

  if (event.queryStringParameters && event.queryStringParameters.filter) {
    // filters._all = event.queryStringParameters.filter;
    params.match.$or = [
      {
        code: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'attributes.value': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        salesrep: new RegExp(event.queryStringParameters.filter, 'i')
      }
    ];

    params.match.$or.push({
      orderStatus: akUtils.getOrderStatus(event.queryStringParameters.filter)
    });
  }

  if (event.queryStringParameters.code) {
    params.match.code = new RegExp(event.queryStringParameters.code, 'i');
  }
  if (event.queryStringParameters.orderStatus) {
    params.match.orderStatus = {
      $eq: akUtils.getOrderStatus(event.queryStringParameters.orderStatus)
    };
  }
  // if (event.queryStringParameters.surgeryDateFrom || event.queryStringParameters.surgeryDateTo) {
  const filterArray = [];

  // }
  if (event.queryStringParameters.surgeryDateFrom || event.queryStringParameters.surgeryDateTo) {
    params.match.etd = {};
  }

  if (event.queryStringParameters.surgeryDateFrom) {
    params.match.etd.$gte = new Date(event.queryStringParameters.surgeryDateFrom);
  }

  if (event.queryStringParameters.surgeryDateTo) {
    params.match.etd.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.surgeryDateTo)
    );
  }
  if (event.queryStringParameters.orderedDateFrom || event.queryStringParameters.orderedDateTo) {
    params.match.orderedDate = {};
  }

  if (event.queryStringParameters.orderedDateFrom) {
    params.match.orderedDate.$gte = new Date(event.queryStringParameters.orderedDateFrom);
  }

  if (event.queryStringParameters.orderedDateTo) {
    params.match.orderedDate.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.orderedDateTo)
    );
  }
  if (event.queryStringParameters.salesrep) {
    params.match['consumer.uuid'] = event.queryStringParameters.salesrep;
  }
  if (event.queryStringParameters.surgeon) {
    params.match.attributes = {
      $elemMatch: {
        name: 'surgeon',
        value: new RegExp(event.queryStringParameters.surgeon, 'i')
      }
    };
  }
  if (event.queryStringParameters.timeElapsed) {
    const diff = (event.queryStringParameters.timeElapsed || '').split('-');
    params.match.dateDiff = {};
    if (diff[0]) {
      const gt = diff[0] * 60 * 60 * 1000;
      params.match.dateDiff.$gte = gt;
    }
    if (diff[1]) {
      const lt = diff[1] * 60 * 60 * 1000;
      params.match.dateDiff.$lte = lt;
    }
  }

  for (const prop in params.match) {
    if (params.match.hasOwnProperty(prop)) {
      const o = {};
      o[prop] = params.match[prop];
      filterArray.push(o);
    }
  }

  if (filterArray.length > 0) {
    params.match = {
      $and: filterArray
    };
  } else {
    params.match = {};
  }

  params.match.etd = {
    $lte: new Date()
  };
  params.match.orderStatus = {
    $nin: [5, 70, 90]
  };

  params.match = clientHandler.addClientFilterToConditions(params.match);

  params.limit = event.queryStringParameters.limit
    ? parseInt(event.queryStringParameters.limit, 10)
    : 20;
  params.skip = event.queryStringParameters.offset
    ? parseInt(event.queryStringParameters.offset, 10)
    : 0;

  const sorting = this.extractSortOptions(event, 'ordersNotClosed');

  // // console.log(sorting.length);

  params.sort = {};

  if (!Object.keys(sorting).length) {
    params.sort.code = 1;
  } else {
    params.sort = sorting;
  }

  const util = require('util');
  // console.log(util.inspect(params, false, null));

  return bluebirdPromise
    .all([
      // this.ordersNotClosedData(params),
      // this.ordersNotClosedCount(params)

      this.extractData(params, ordermodel, 'ordersNotClosed'),
      this.extractCount(params, ordermodel)
    ])
    .then(
      result =>
        // // console.log(result);
        result
    );
};

/**
 * 
 */
reportService.prototype.shipmentDue = function(event, widgetName) {
  const params = {};

  params.project = {
    code: 1,
    addresses: 1,
    etd: 1,
    shipmentStatus: 1,
    carrier: {
      $concat: ['$carrierUser.firstName', ' ', '$carrierUser.lastName']
    },
    scheduledPickupDate: 1,
    carrierUser: 1,
    attributes: 1,
    client: 1,
    dateDiff: {
      $subtract: ['$etd', new Date()]
    }
  };

  params.match = {};
  params.match.shipmentStatus = {};

  if (event.queryStringParameters && event.queryStringParameters.filter) {
    // filters._all = event.queryStringParameters.filter;
    params.match.$or = [
      {
        code: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'attributes.value': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        carrier: new RegExp(event.queryStringParameters.filter, 'i')
      }
    ];
    params.match.$or.push({
      shipmentStatus: akUtils.getShipmentStatus(event.queryStringParameters.filter)
    });
  }

  if (event.queryStringParameters.code) {
    params.match.code = new RegExp(event.queryStringParameters.code, 'i');
  }

  if (event.queryStringParameters.carrier) {
    params.match['carrierUser.uuid'] = event.queryStringParameters.carrier;
  }
  if (event.queryStringParameters.shipmentStatus) {
    params.match.shipmentStatus.$eq = akUtils.getShipmentStatus(
      event.queryStringParameters.shipmentStatus
    );
  }

  if (
    event.queryStringParameters.scheduledDeliveryDateTo ||
    event.queryStringParameters.scheduledDeliveryDateTo
  ) {
    params.match.etd = {};
  }

  if (event.queryStringParameters.scheduledDeliveryDateFrom) {
    params.match.etd.$gte = new Date(event.queryStringParameters.scheduledDeliveryDateFrom);
  }

  if (event.queryStringParameters.scheduledDeliveryDateTo) {
    params.match.etd.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.scheduledDeliveryDateTo)
    );
  }

  // params.match.etd.$lte = new Date();
  params.match.shipmentStatus.$in = [10, 20, 25, 30, 40];

  if (event.queryStringParameters.timeElapsed) {
    const diff = (event.queryStringParameters.timeElapsed || '').split('-');
    params.match.dateDiff = {};
    if (parseInt(diff[0], 10) || parseInt(diff[0], 10) === 0) {
      const gt = parseInt(diff[0], 10) * 60 * 60 * 1000;
      params.match.dateDiff.$gte = gt;
    }
    if (parseInt(diff[1], 10) || parseInt(diff[1], 10) === 0) {
      const lt = parseInt(diff[1], 10) * 60 * 60 * 1000;
      params.match.dateDiff.$lte = lt;
    }
  }

  const util = require('util');
  // console.log(util.inspect(params.match.dateDiff, false, null));
  params.match = clientHandler.addClientFilterToConditions(params.match);

  params.limit = event.queryStringParameters.limit
    ? parseInt(event.queryStringParameters.limit, 10)
    : 20;
  params.skip = event.queryStringParameters.offset
    ? parseInt(event.queryStringParameters.offset, 10)
    : 0;

  const sorting = this.extractSortOptions(event, 'shipmentDue');

  // // console.log(sorting.length);

  params.sort = {};

  if (!Object.keys(sorting).length) {
    params.sort.etd = 1;
  } else {
    params.sort = sorting;
  }

  // const util = require('util');
  // // console.log(util.inspect(params.match, false, null));

  if (widgetName) {
    return this.shipmentsDueWidget(params, widgetName, event);
  }
  return bluebirdPromise
    .all([
      // this.ordersNotClosedData(params),
      // this.ordersNotClosedCount(params)

      this.extractData(params, shipmentmodel, 'shipmentDue'),
      this.extractCount(params, shipmentmodel)
    ])
    .then(
      result =>
        // // console.log(result);
        result
    );
};
reportService.prototype.shipmentsDueWidget = function(params, widgetName, event) {
  const unit = event.queryStringParameters.unit;
  const isForFuture = true;
  const ranges = this.convertWidgetQueryTimeRanges(event.queryStringParameters.ranges, unit);
  return bluebirdPromise.map(ranges, range =>
    shipmentmodel
      .aggregate([
        {
          $match: clientHandler.addClientFilterToConditions({})
        },
        {
          $project: params.project
        },
        {
          $match: params.match
        }
      ])
      .exec()
      .then(data => {
        let label = this.getLabelFromTimeRange(range, unit, isForFuture);
        if (label === 'Less than 0 hours') {
          label = 'Overdue';
        }
        return {
          label,
          value: (data[0] || {}).count || 0
        };
      })
  );
};

reportService.prototype.extractData = function(params, dataModel, reportType) {
  return dataModel
    .aggregate([
      {
        $match: clientHandler.addClientFilterToConditions({})
      },
      {
        $project: params.project
      },
      {
        $match: params.match
      },
      {
        $sort: params.sort
      },
      {
        $skip: params.skip
      },
      {
        $limit: params.limit
      }
    ])
    .collation({
      locale: 'en_US',
      caseLevel: false
    })
    .exec()
    .then(result => {
      // // console.log(result);
      const list = [];
      if (result) {
        for (const i in result) {
          if (result.hasOwnProperty(i)) {
            list.push(this.formatReportData(result[i], reportType));
          }
        }
      }

      return list;
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

reportService.prototype.formatTimeDff = function(start, end) {
  let minusSignAdded = false;
  const elapsedTime = timediff(start, end, 'DHmS');
  // console.log(elapsedTime);
  let dateDiff = '';
  if ((elapsedTime || {}).days) {
    minusSignAdded = true;
    dateDiff = `${(elapsedTime || {}).days} day(s) `;
  } else {
    dateDiff = '0 day(s) ';
  }

  if ((elapsedTime || {}).hours) {
    if (minusSignAdded) {
      elapsedTime.hours = Math.abs(elapsedTime.hours);
    }
    minusSignAdded = true;
    dateDiff = `${dateDiff + (elapsedTime || {}).hours}h `;
  } else {
    dateDiff += '0h ';
  }

  if ((elapsedTime || {}).minutes) {
    if (minusSignAdded) {
      elapsedTime.minutes = Math.abs(elapsedTime.minutes);
    }
    minusSignAdded = true;
    dateDiff = `${dateDiff + (elapsedTime || {}).minutes}m `;
  } else {
    dateDiff += '0m ';
  }

  if ((elapsedTime || {}).seconds) {
    if (minusSignAdded) {
      elapsedTime.seconds = Math.abs(elapsedTime.seconds);
    }
    minusSignAdded = true;
    dateDiff = `${dateDiff + (elapsedTime || {}).seconds}s `;
  } else {
    dateDiff += '0s ';
  }

  return dateDiff.trim();
};

reportService.prototype.formatReportData = function(recordData, reportType) {
  // // console.log(recordData);

  const record = commonHelper.moveSystemAttributesToGlobal(recordData);
  const tmp = {};

  const currentDate = new Date();
  let dateDiff = '';

  switch (reportType) {
    case 'ordersPerHospital':
      tmp.id = record._id;
      tmp.hospital = record.addresses[0].location.name;
      tmp.code = record.code;
      tmp.orderStatus = akUtils.objectKeyByValue(orderStatusLabelMap, record.orderStatus);
      tmp.orderdate = record.orderedDate;
      tmp.surgerydate = record.etd || '';
      tmp.salesrep = record.salesrep;

      tmp.surgeon = record.surgeon || '';
      tmp.patient = record.patient || '';
      break;

    case 'ordersBySurgery':
      tmp.id = record._id;
      tmp.surgery = record.surgery;
      tmp.code = record.code;
      tmp.orderStatus = akUtils.objectKeyByValue(orderStatusLabelMap, record.orderStatus);
      tmp.orderdate = record.orderedDate;
      tmp.surgerydate = record.etd || '';
      tmp.salesrep = record.salesrep;
      tmp.surgeon = record.surgeon || '';
      tmp.patient = record.patient || '';
      break;
    case 'ordersNotClosed':
      dateDiff = this.formatTimeDff(record.etd, currentDate);

      tmp.id = record._id;
      tmp.code = record.code;
      tmp.orderStatus = akUtils.objectKeyByValue(orderStatusLabelMap, record.orderStatus);
      tmp.orderdate = record.orderedDate;
      tmp.surgerydate = record.etd || '';
      tmp.salesrep = record.salesrep;
      tmp.surgeon = record.surgeon || '';
      tmp.patient = record.patient || '';
      tmp.dateDiff = dateDiff || '';
      break;
    case 'ordersPerSurgeon':
      tmp.id = record._id;
      tmp.surgery = record.surgery;
      tmp.code = record.code;
      tmp.orderStatus = akUtils.objectKeyByValue(orderStatusLabelMap, record.orderStatus);
      tmp.orderdate = record.orderedDate;
      tmp.surgerydate = record.etd || '';
      tmp.salesrep = record.salesrep;
      tmp.surgeon = record.surgeon || '';
      tmp.patient = record.patient || '';
      break;

    case 'caseWithUnshippedProducts':
      tmp.id = record._id;
      tmp.code = record.code;
      tmp.orderStatus = akUtils.objectKeyByValue(orderStatusLabelMap, record.orderStatus);
      tmp.orderdate = record.orderedDate;
      tmp.surgerydate = record.etd || '';
      tmp.product = record.products.name;
      tmp.sku = record.products.code;
      tmp.salesrep = record.salesrep;
      tmp.surgeon = record.surgeon || '';
      tmp.patient = record.patient || '';
      tmp.dateDiff = record.dateDiff || '';
      break;
    case 'shipmentDue':
      tmp.id = record._id;
      tmp.code = record.code;
      tmp.toAddress =
        (record.addresses.filter(address => address.addressType === 'shipToAddress')[0].location ||
          {}
        ).name || '';
      tmp.scheduledDeliveryDate = record.etd || '';
      tmp.shipmentStatus = akUtils.objectKeyByValue(shipmentStatusLabel, record.shipmentStatus);
      tmp.carrier = record.carrier;
      tmp.pickupDate = record.scheduledPickupDate || '';

      dateDiff = this.formatTimeDff(currentDate, record.etd);

      tmp.dateDiff = dateDiff || '';
      break;
    case 'ordersPerCity':
      const locRecord = commonHelper.moveSystemAttributesToGlobal(record.location[0] || {});
      tmp.id = record._id;
      tmp.city = locRecord.city;
      tmp.state = locRecord.state;
      tmp.surgeon = record.surgeon || '';
      tmp.code = record.code;
      tmp.orderStatus = akUtils.objectKeyByValue(orderStatusLabelMap, record.orderStatus);
      tmp.orderdate = record.orderedDate;
      tmp.surgerydate = record.etd || '';
      tmp.salesrep = (record.salesrep || '').trim();
      break;
    case 'locationToZoneMapping':
      tmp.zoneId = record._id;
      tmp.floorId = record.floor.id;
      tmp.locationId = record.location.id;
      tmp.name = record.name;
      tmp.location = record.location.name;
      tmp.floor = record.floor.name;
      tmp.beacons = record.things.map(x => x.name).join(', ');
      break;

    case 'shipmentDeliveryTime':
      tmp.id = record._id;
      tmp.code = record.code;
      tmp.fromAddress =
        (record.addresses.filter(address => address.addressType === 'shipFromAddress')[0]
          .location || {}
        ).name || '';
      tmp.toAddress =
        (record.addresses.filter(address => address.addressType === 'shipToAddress')[0].location ||
          {}
        ).name || '';
      tmp.shipDate = record.shipDate || '';
      tmp.deliveryDate = record.deliveryDate || '';

      dateDiff = this.formatTimeDff(record.shipDate, record.deliveryDate);

      tmp.dateDiff = dateDiff || '';

      break;
    case 'carrierWiseDelayedShipments':
      tmp.id = record._id;
      tmp.code = record.code;
      tmp.etd = record.etd || '';
      tmp.deliveryDate = record.deliveryDate || '';
      tmp.carrier = record.carrier;

      dateDiff = this.formatTimeDff(record.etd, record.deliveryDate);

      tmp.delay = dateDiff || '';
      break;
    case 'shipmentHardDelivered':
      tmp.id = record._id;
      tmp.code = record.code;
      tmp.previousState = akUtils.objectKeyByValue(shipmentStatusLabel, record.previousState);
      tmp.currentStatus = akUtils.objectKeyByValue(shipmentStatusLabel, record.shipmentStatus);
      tmp.scheduledDeliveryDate = record.etd || '';
      tmp.deliveryDate = record.deliveryDate || '';
      tmp.carrier = record.carrier;
      break;

    case 'shipmentInJeopardy':
      tmp.orderId = record.orderId;
      tmp.shipmentId = record.shipmentId;
      tmp.ordercode = record.ordercode;
      tmp.shipmentcode = record.shipmentcode;
      tmp.surgeryDate = record.etd;
      tmp.shipmentStatus = akUtils.objectKeyByValue(shipmentStatusLabel, record.shipmentStatus);
      tmp.scheduledDeliveryDate = record.scheduledDeliveryDate;
      tmp.pickupDate = record.pickupDate;
      tmp.carrier = record.carrier;
      tmp.toAddress = record.toAddress[0] || '';
      dateDiff = this.formatTimeDff(new Date(), record.etd);

      tmp.timeTillSurgery = dateDiff || '';
      break;
    case 'partialShipments':
      tmp.orderId = record.orderId;
      tmp.shipmentId = record.shipmentId;
      tmp.ordercode = record.ordercode;
      tmp.shipmentcode = record.shipmentcode;
      tmp.shipmentStatus = akUtils.objectKeyByValue(shipmentStatusLabel, record.shipmentStatus);
      tmp.scheduledDeliveryDate = record.scheduledDeliveryDate || '';
      tmp.carrier = record.carrier || '';
      tmp.toAddress = record.toAddress[0] || '';
      break;
    case 'stationaryShipments':
      tmp.id = record._id;
      tmp.code = record.code;
      tmp.toAddress = record.toAddress[0] || '';
      tmp.shipmentStatus = akUtils.objectKeyByValue(shipmentStatusLabel, record.shipmentStatus);
      tmp.stationarySince = this.formatTimeDff(record.lastMoved, new Date());
      tmp.currentLocation = commonHelper.getCurrentLocationString(record.currentLocation);
      break;
    case 'internalExternalShipment':
      tmp.location = (record.location || {}).name || '';
      tmp.externalCount = record.externalCount;
      tmp.internalCount = record.internalCount;
      break;
    case 'sensorConnectionStatus':
      tmp.sensor = record.name;
      tmp.sku = (record.product || {}).code || '';
      tmp.product = (record.product || {}).name || '';
      tmp.productId = (record.product || {}).id || '';
      tmp.isAssigned = record.isAssigned;
      tmp.battery_level = record.battery_level || '';
      tmp.last_connection = record.last_connection || '';
      tmp.firmware = record.firmware || '';
      tmp.manufacturer = record.manufacturer || '';
      tmp.last_tracked = ((record.trackingData || [])[0] || {}).lastTracked || '';
      tmp.location = commonHelper.getCurrentLocationString(
        ((record.trackingData || [])[0] || {}).currentLocation || {}
      );
      break;
    case 'productsReadyToDispatch':
      tmp.shipmentId = record.shipmentId;
      tmp.orderId = record.orderId;
      tmp.productId = record.productId;
      tmp.shipmentcode = record.shipmentcode;
      tmp.ordercode = record.ordercode;
      tmp.product = record.product;
      tmp.carrier = record.carrier;
      tmp.surgeryDate = record.surgeryDate;
      tmp.scheduledPickupDate = record.scheduledPickupDate;
      tmp.scheduledDeliveryDate = record.scheduledDeliveryDate;
      tmp.toAddress = (record.toAddress || {}).name || '';
      tmp.categories = record.categories.map(x => x.name).join(', ');
      tmp.shipmentStatus = akUtils.objectKeyByValue(shipmentStatusLabel, record.shipmentStatus);
      tmp.orderStatus = akUtils.objectKeyByValue(orderStatusLabelMap, record.orderStatus);
      break;
    case 'appStatus':
      tmp.deviceid = record._id;
      tmp.devicecode = record.code || '';
      tmp.devicename = record.name || '';
      tmp.appName = record.appName || '';
      tmp.os = record.os || '';
      tmp.manufacturer = record.manufacturer || '';
      tmp.bluetoothStatus = record.btStatus || '';
      tmp.gpsStatus = record.gpsStatus || '';
      tmp.beaconServiceStatus = record.beaconServiceStatus || '';
      tmp.isLoggedIn = record.isLoggedIn || '';
      tmp.isActive = record.isActive || '';
      tmp.hasLinkedChannel = record.hasLinkedChannel || '';
      tmp.channelId = record.channelId || '';
      tmp.isReporting = record.isReporting || '';
      tmp.lastTracked = record.lastTracked || '';
      tmp.user = record.associatedUser || '';
      break;
    case 'productThingMapping':
      tmp.id = record._id;
      tmp.code = record.code;
      tmp.name = record.name;
      tmp.things = record.things.map(x => x.name).join(', ');
      tmp.lastThingsChangeOn = record.lastThingsChangeOn || '';
      break;
    case 'productThingMappingHistory':
      tmp.id = record._id;
      tmp.thing = record.thing;
      tmp.associatedOn = record.associatedOn || '';
      tmp.disassociatedOn = record.disassociatedOn || '';
      tmp.currentlyAssociated = record.currentlyAssociated || '';
      break;
    case 'loginHistory':
      tmp.id = record._id;
      tmp.user = record.user;
      tmp.sensor = record.sensor;
      tmp.device = record.device;
      tmp.loginTime = record.loginTime;
      tmp.logoutTime = record.logoutTime;
      break;
    default:
      break;
  }
  return tmp;
};

reportService.prototype.extractCount = function(params, dataModel) {
  return dataModel
    .aggregate([
      {
        $match: clientHandler.addClientFilterToConditions({})
      },
      {
        $project: params.project
      },
      {
        $match: params.match
      },
      {
        $count: 'count'
      }
    ])
    .exec()
    .then(result => {
      // // console.log(result);
      // return 100;
      if (result[0].count) {
        return result[0].count;
      }
      return 0;
    })
    .then(result => {
      if (result === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

/**
 * 
 */
reportService.prototype.extractSortOptions = function(event, reportType) {
  const sort = {};

  if (event.queryStringParameters.sort) {
    const sortColumns = event.queryStringParameters.sort.split(',');
    sortColumns.forEach(function(col) {
      let sortOrder = 1;
      col = col.trim();
      const isValidColumn =
        this.getColumnMap(col, reportType) || this.getColumnMap(col.replace('-', ''), reportType);

      if (isValidColumn) {
        if (col.startsWith('-')) {
          sortOrder = -1;
          col = col.replace('-', '');
        }

        col = this.getColumnMap(col, reportType);
        sort[col] = sortOrder;
      }
    }, this);
  }

  return sort;
};

reportService.prototype.getColumnMap = function getColumnMap(key, reportType) {
  let map = {};

  switch (reportType) {
    case 'ordersPerHospital':
      map = {
        id: '_id',
        code: 'code',
        hospital: 'addresses.location.name',
        orderdate: 'orderedDate',
        surgerydate: 'etd',
        salesrep: 'salesrep'
      };
      break;
    case 'ordersNotClosed':
      map = {
        orderdate: 'orderedDate',
        salesrep: 'salesrep',
        dateDiff: 'dateDiff',
        code: 'code',
        surgerydate: 'etd',
        orderStatus: 'orderStatus'
      };
      break;
    case 'ordersBySurgery':
      map = {
        id: '_id',
        code: 'code',
        hospital: 'addresses.location.name',
        orderdate: 'orderedDate',
        surgerydate: 'etd',
        salesrep: 'salesrep'
      };
      break;

    case 'ordersPerCity':
      map = {
        id: '_id',
        code: 'code',
        orderdate: 'orderedDate',
        surgerydate: 'etd',
        salesrep: 'salesrep'
      };
      break;
    case 'caseWithUnshippedProducts':
      map = {
        id: '_id',
        code: 'code',
        surgerydate: 'etd',
        salesrep: 'salesrep',
        sku: 'products.code',
        product: 'products.name'
      };
      break;
    case 'ordersPerSurgeon':
      map = {
        id: '_id',
        code: 'code',
        orderdate: 'orderedDate',
        orderStatus: 'orderStatus',
        surgerydate: 'etd',
        salesrep: 'salesrep'
      };
      break;
    case 'undeliveredProducts':
      map = {
        id: '_id',
        code: 'code',
        product: 'products.name',
        sku: 'products.code',
        things: 'products.things.code',
        shipDate: 'shipDate',
        shipmentStatus: 'shipmentStatus',
        toAddress: 'addresses.1.name',
        lastTracked: 'trackingData.lastTracked',
        etd: 'etd',
        carrier: 'carrier'
      };
      break;
    case 'shipmentDue':
      map = {
        id: '_id',
        code: 'code',
        carrier: 'carrier',
        toAddress: 'addresses.1.name',
        shipmentStatus: 'shipmentStatus',
        scheduledDeliveryDate: 'etd',
        pickupDate: 'scheduledPickupDate',
        dateDiff: 'dateDiff'
      };
      break;
    case 'locationToZoneMapping':
      map = {
        id: '_id',
        name: 'name',
        location: 'location.name',
        floor: 'floor.name',
        beacons: 'things.name'
      };
      break;
    case 'shipmentDeliveryTime':
      map = {
        id: '_id',
        code: 'code',
        shipDate: 'shipDate',
        deliveryDate: 'deliveryDate',
        dateDiff: 'dateDiff'
      };
      break;
    case 'carrierWiseDelayedShipments':
      map = {
        id: '_id',
        code: 'code',
        etd: 'etd',
        deliveryDate: 'deliveryDate',
        delay: 'delay',
        carrier: 'carrier'
      };
      break;
    case 'shipmentHardDelivered':
      map = {
        id: '_id',
        code: 'code',
        scheduledDeliveryDate: 'etd',
        deliveryDate: 'deliveryDate',
        carrier: 'carrier',
        shipmentStatus: 'shipmentStatus'
      };
      break;
    case 'shipmentInJeopardy':
      map = {
        ordercode: 'ordercode',
        shipmentcode: 'shipmentcode',
        surgeryDate: 'surgeryDate',
        shipmentStatus: 'shipmentStatus',
        scheduledDeliveryDate: 'scheduledDeliveryDate',
        pickupDate: 'pickupDate',
        carrier: 'carrier',
        toAddress: 'toAddress',
        timeTillSurgery: 'timeTillSurgery'
      };
      break;

    case 'mostUsedProductsPerSurgeon':
      map = {
        id: '_id',
        surgeon: '_id.surgeon',
        surgery: 'surgery.value',
        product: '_id.productName',
        sku: '_id.productCode',
        count: 'count',
        hospital: 'hospital.location.name',
        category: 'productDetails.categories.name'
      };
      break;
    case 'partialShipments':
      map = {
        ordercode: 'ordercode',
        shipmentcode: 'shipmentcode',
        shipmentStatus: 'shipmentStatus',
        scheduledDeliveryDate: 'scheduledDeliveryDate',
        pickupDate: 'pickupDate',
        carrier: 'carrier',
        toAddress: 'toAddress'
      };
      break;
    case 'salesrepWiseProductOrder':
      map = {
        id: '_id',
        salesrep: '_id.salesRepName',
        product: '_id.productName',
        sku: '_id.productCode',
        categories: 'productDetails.categories.name',
        count: 'count',
        order: 'order',
        lastOrdered: 'lastOrdered'
      };
      break;
    case 'stationaryShipments':
      map = {
        id: '_id',
        stationarySince: 'stationarySince',
        shipmentStatus: 'shipmentStatus',
        toAddress: 'toAddress',
        code: 'code'
      };
      break;
    case 'internalExternalShipment':
      map = {
        location: 'location.name',
        externalCount: 'externalCount',
        internalCount: 'internalCount'
      };
      break;
    case 'sensorConnectionStatus':
      map = {
        sensor: 'name',
        sku: 'product.code',
        isAssigned: 'isAssigned',
        product: 'product.name',
        last_tracked: 'trackingData.lastTracked'
      };
      break;
    case 'productsReadyToDispatch':
      map = {
        shipmentcode: 'shipmentcode',
        ordercode: 'ordercode',
        product: 'product',
        surgeryDate: 'surgeryDate',
        scheduledDeliveryDate: 'scheduledDeliveryDate',
        scheduledPickupDate: 'scheduledPickupDate',
        toAddress: 'toAddress.name',
        carrier: 'carrier',
        category: 'categories.name',
        orderStatus: 'orderStatus',
        shipmentStatus: 'shipmentStatus'
      };
      break;
    case 'appStatus':
      map = {
        deviceid: '_id',
        devicecode: 'code',
        devicename: 'name',
        bluetoothStatus: 'btStatus',
        gpsStatus: 'gpsStatus',
        beaconServiceStatus: 'beaconServiceStatus',
        isLoggedIn: 'isLoggedIn',
        isReporting: 'isReporting',
        lastTracked: 'lastTracked',
        user: 'user'
      };
      break;
    case 'productThingMapping':
      map = {
        code: 'code',
        name: 'name',
        lastThingsChangeOn: 'lastThingsChangeOn',
        things: 'things.name'
      };
      break;
    case 'productThingMappingHistory':
      map = {
        thing: 'thing',
        associatedOn: 'associatedOn',
        disassociatedOn: 'disassociatedOn',
        currentlyAssociated: 'currentlyAssociated'
      };
      break;
    case 'loginHistory':
      map = {
        userName: 'user.name',
        deviceCode: 'device.code',
        deviceName: 'device.name',
        sensor: 'sensor.name',
        loginTime: 'loginTime',
        logoutTime: 'logoutTime'
      };
      break;
    default:
      map = {};
  }

  if (key) {
    return map[key] || key;
  }
  return map;
};

/**
 * 
 */
reportService.prototype.casesWithUnshippedProducts = function(event) {
  const params = {};

  params.project = {
    addresses: 1,
    code: 1,
    salesrep: {
      $concat: ['$consumer.firstName', ' ', '$consumer.lastName']
    },
    products: 1,
    orderStatus: 1,
    orderedDate: 1,
    etd: 1,
    consumer: 1,
    attributes: 1,
    client: 1,
    dateDiff: {
      $subtract: [new Date(), '$etd']
    }
  };

  params.match = {
    'products.deliveryStatus': {
      $in: [10, 20]
    }
  };

  params.unwind = {
    path: '$products'
  };

  if (event.queryStringParameters && event.queryStringParameters.filter) {
    // filters._all = event.queryStringParameters.filter;
    params.match.$or = [
      {
        code: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'attributes.value': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'products.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'products.code': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        salesrep: new RegExp(event.queryStringParameters.filter, 'i')
      }
    ];
    params.match.$or.push({
      orderStatus: akUtils.getOrderStatus(event.queryStringParameters.filter)
    });
  }

  if (event.queryStringParameters.code) {
    params.match.code = new RegExp(event.queryStringParameters.code, 'i');
  }

  params.match.orderStatus = {};

  if (event.queryStringParameters.orderStatus) {
    params.match.orderStatus = {
      $eq: akUtils.getOrderStatus(event.queryStringParameters.orderStatus)
    };
  }

  if (event.queryStringParameters.surgeryDateFrom || event.queryStringParameters.surgeryDateTo) {
    params.match.etd = {};
  }

  if (event.queryStringParameters.surgeryDateFrom) {
    params.match.etd.$gte = new Date(event.queryStringParameters.surgeryDateFrom);
  }

  if (event.queryStringParameters.surgeryDateTo) {
    params.match.etd.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.surgeryDateTo)
    );
  }

  if (event.queryStringParameters.salesrep) {
    params.match['consumer.uuid'] = event.queryStringParameters.salesrep;
  }
  if (event.queryStringParameters.productName) {
    params.match['products.name'] = new RegExp(event.queryStringParameters.productName, 'i');
  }
  if (event.queryStringParameters.productCode) {
    params.match['products.code'] = new RegExp(event.queryStringParameters.productCode, 'i');
  }
  // params.match.etd.$lte = new Date();
  params.match.orderStatus.$nin = [5, 70, 90];
  params.match = clientHandler.addClientFilterToConditions(params.match);

  params.limit = event.queryStringParameters.limit
    ? parseInt(event.queryStringParameters.limit, 10)
    : 20;
  params.skip = event.queryStringParameters.offset
    ? parseInt(event.queryStringParameters.offset, 10)
    : 0;

  const sorting = this.extractSortOptions(event, 'caseWithUnshippedProducts');

  // // console.log(sorting.length);

  params.sort = {};

  if (!Object.keys(sorting).length) {
    params.sort.etd = 1;
  } else {
    params.sort = sorting;
  }

  // const util = require('util');
  // // console.log(util.inspect(params, false, null));

  return bluebirdPromise
    .all([
      this.unshippedProductsData(params, ordermodel, 'caseWithUnshippedProducts'),
      this.unshippedProductsCount(params, ordermodel)
    ])
    .then(
      result =>
        // // console.log(result);
        result
    );
};

reportService.prototype.unshippedProductsCount = function(params, dataModel) {
  return dataModel
    .aggregate([
      {
        $match: clientHandler.addClientFilterToConditions({})
      },
      {
        $project: params.project
      },
      {
        $unwind: params.unwind
      },
      {
        $match: params.match
      },
      {
        $count: 'count'
      }
    ])
    .exec()
    .then(result => {
      // // console.log(result);
      // return 100;
      if (result[0].count) {
        return result[0].count;
      }
      return 0;
    })
    .then(result => {
      if (result === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

/**
 * 
 */

reportService.prototype.unshippedProductsData = function(params, dataModel, reportType) {
  return dataModel
    .aggregate([
      {
        $match: clientHandler.addClientFilterToConditions({})
      },
      {
        $project: params.project
      },
      {
        $unwind: params.unwind
      },
      {
        $match: params.match
      },
      {
        $sort: params.sort
      },
      {
        $skip: params.skip
      },
      {
        $limit: params.limit
      }
    ])
    .collation({
      locale: 'en_US',
      caseLevel: false
    })
    .exec()
    .then(result => {
      // // console.log(result);
      const list = [];
      if (result) {
        for (const i in result) {
          if (result.hasOwnProperty(i)) {
            list.push(this.formatReportData(result[i], reportType));
          }
        }
      }

      return list;
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

reportService.prototype.undeliveredProducts = function(event) {
  const params = {};
  params.unwind = {
    path: '$products'
  };

  params.lookup = {
    from: 'shipmenttrackings',
    localField: '_id',
    foreignField: 'shipment.id',
    as: 'trackingData'
  };

  params.gUnwind = {
    path: '$trackingData',
    preserveNullAndEmptyArrays: true
  };

  params.project = {
    addresses: 1,
    code: 1,
    carrierUser: 1,
    carrier: {
      $concat: ['$carrierUser.firstName', ' ', '$carrierUser.lastName']
    },
    products: 1,
    shipDate: 1,
    shipmentStatus: 1,
    orderedDate: 1,
    etd: 1,
    consumer: 1,
    attributes: 1,
    client: 1,
    trackingData: 1,
    dateDiff: {
      $subtract: [new Date(), '$etd']
    }
  };

  params.match = {
    'products.deliveryStatus': {
      $in: [20, 30, 40]
    }
  };

  if (event.queryStringParameters && event.queryStringParameters.filter) {
    // filters._all = event.queryStringParameters.filter;
    params.match.$or = [
      {
        code: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'attributes.value': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'products.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'products.code': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'products.things.code': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        carrier: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        addresses: {
          $elemMatch: {
            addressType: 'shipToAddress',
            'location.name': new RegExp(event.queryStringParameters.filter, 'i')
          }
        }
      }
    ];
    params.match.$or.push({
      shipmentStatus: akUtils.getShipmentStatus(event.queryStringParameters.filter)
    });
  }

  if (event.queryStringParameters.code) {
    params.match.code = new RegExp(event.queryStringParameters.code, 'i');
  }

  params.match.shipmentStatus = {};

  if (event.queryStringParameters.shipmentStatus) {
    params.match.shipmentStatus = {
      $eq: akUtils.getShipmentStatus(event.queryStringParameters.shipmentStatus)
    };
  }

  if (event.queryStringParameters.shipDateFrom || event.queryStringParameters.shipDateTo) {
    params.match.etd = {};
  }

  if (event.queryStringParameters.shipDateFrom) {
    params.match.etd.$gte = new Date(event.queryStringParameters.shipDateFrom);
  }

  if (event.queryStringParameters.shipDateTo) {
    params.match.etd.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.shipDateTo)
    );
  }

  if (event.queryStringParameters.carrier) {
    params.match['carrierUser.uuid'] = event.queryStringParameters.carrier;
  }
  if (event.queryStringParameters.toAddress) {
    params.match.addresses = {
      $elemMatch: {
        addressType: 'shipToAddress',
        'location.id': mongoose.Types.ObjectId(event.queryStringParameters.toAddress)
      }
    };
  }
  if (event.queryStringParameters.productName) {
    params.match['products.name'] = new RegExp(event.queryStringParameters.productName, 'i');
  }
  if (event.queryStringParameters.productCode) {
    params.match['products.code'] = new RegExp(event.queryStringParameters.productCode, 'i');
  }
  params.match.shipmentStatus.$in = [25, 30, 40, 45];

  params.match = clientHandler.addClientFilterToConditions(params.match);

  params.limit = event.queryStringParameters.limit
    ? parseInt(event.queryStringParameters.limit, 10)
    : 20;
  params.skip = event.queryStringParameters.offset
    ? parseInt(event.queryStringParameters.offset, 10)
    : 0;

  const sorting = this.extractSortOptions(event, 'undeliveredProducts');
  // console.log(sorting);
  // // console.log(sorting.length);

  params.sort = {};

  if (!Object.keys(sorting).length) {
    params.sort.etd = 1;
  } else {
    params.sort = sorting;
  }
  // console.log(params.sort);
  // const util = require('util');
  // // console.log(util.inspect(params, false, null));

  return bluebirdPromise
    .all([this.undeliveredProductsData(params), this.undeliveredProductsCount(params)])
    .then(
      result =>
        // // console.log(result);
        result
    );
};

/**
 * 
 */
reportService.prototype.undeliveredProductsData = function(params) {
  return shipmentmodel
    .aggregate([
      {
        $lookup: params.lookup
      },
      {
        $unwind: params.gUnwind
      },
      {
        $unwind: params.unwind
      },
      {
        $project: params.project
      },
      {
        $match: params.match
      },
      {
        $sort: params.sort
      },
      {
        $skip: params.skip
      },
      {
        $limit: params.limit
      }
    ])
    .collation({
      locale: 'en_US',
      caseLevel: false
    })
    .exec()
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      result = result.map(record => {
        const tmp = {};
        tmp.id = record._id;
        tmp.code = record.code;
        tmp.shipmentStatus = akUtils.objectKeyByValue(shipmentStatusLabel, record.shipmentStatus);
        tmp.shipDate = record.shipDate || '';
        tmp.etd = record.etd || '';
        tmp.product = record.products.name;
        tmp.sku = record.products.code;
        tmp.carrier = record.carrier;
        tmp.things = record.products.things.map(item => item.code).join(',');
        tmp.toAddress =
          (record.addresses.filter(address => address.addressType === 'shipToAddress')[0]
            .location || {}
          ).name || '';
        tmp.currentLocation = commonHelper.getCurrentLocationString(
          (record.trackingData || {}).currentLocation
        );
        tmp.lastTracked = (record.trackingData || {}).lastTracked || '';
        return tmp;
      });
      return bluebirdPromise.resolve(result);
    });
};

/**
 * 
 */
reportService.prototype.undeliveredProductsCount = function(params) {
  return shipmentmodel
    .aggregate([
      {
        $lookup: params.lookup
      },
      {
        $unwind: params.gUnwind
      },
      {
        $unwind: params.unwind
      },
      {
        $project: params.project
      },
      {
        $match: params.match
      },
      {
        $count: 'count'
      }
    ])
    .exec()
    .then(result => {
      // // console.log(result);
      // return 100;
      if (result[0].count) {
        return result[0].count;
      }
      return 0;
    })
    .then(result => {
      if (result === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

/**
 * 
 */
reportService.prototype.orderspersurgeon = function(event, widgetName) {
  const params = {};

  params.project = {
    addresses: 1,
    code: 1,
    salesrep: {
      $concat: ['$consumer.firstName', ' ', '$consumer.lastName']
    },
    orderStatus: 1,
    orderedDate: 1,
    etd: 1,
    consumer: 1,
    attributes: 1,
    client: 1,
    patient: {
      $cond: {
        if: {
          $eq: ['$attributes.name', 'patient']
        },
        then: '$attributes.value',
        else: '$attributes.name'
      }
    }
  };

  params.match = {};
  params.match.attributes = {
    $elemMatch: {
      name: 'surgeon',
      value: {
        $ne: ''
      }
    }
  };

  if (event.queryStringParameters && event.queryStringParameters.filter) {
    // filters._all = event.queryStringParameters.filter;
    params.match.$or = [
      {
        code: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'attributes.value': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        salesrep: new RegExp(event.queryStringParameters.filter, 'i')
      }
    ];
    params.match.$or.push({
      orderStatus: akUtils.getOrderStatus(event.queryStringParameters.filter)
    });
  }

  if (event.queryStringParameters.code) {
    params.match.code = new RegExp(event.queryStringParameters.code, 'i');
  }
  if (event.queryStringParameters.orderStatus) {
    params.match.orderStatus = {
      $eq: akUtils.getOrderStatus(event.queryStringParameters.orderStatus)
    };
  }

  if (event.queryStringParameters.surgeryDateFrom || event.queryStringParameters.surgeryDateTo) {
    params.match.etd = {};
  }

  if (event.queryStringParameters.surgeryDateFrom) {
    params.match.etd.$gte = new Date(event.queryStringParameters.surgeryDateFrom);
  }

  if (event.queryStringParameters.surgeryDateTo) {
    params.match.etd.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.surgeryDateTo)
    );
  }

  if (event.queryStringParameters.orderedDateFrom || event.queryStringParameters.orderedDateTo) {
    params.match.orderedDate = {};
  }

  if (event.queryStringParameters.orderedDateFrom) {
    params.match.orderedDate.$gte = new Date(event.queryStringParameters.orderedDateFrom);
  }

  if (event.queryStringParameters.orderedDateTo) {
    params.match.orderedDate.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.orderedDateTo)
    );
  }
  params.match.$and = [];
  if (event.queryStringParameters.surgeon) {
    params.match.$and.push({
      attributes: {
        $elemMatch: {
          name: 'surgeon',
          value: new RegExp(event.queryStringParameters.surgeon, 'i')
        }
      }
    });
  }

  if (event.queryStringParameters.surgery) {
    params.match.$and.push({
      attributes: {
        $elemMatch: {
          name: 'surgery',
          value: new RegExp(event.queryStringParameters.surgery, 'i')
        }
      }
    });
  }

  params.match.$and.length > 0 ? '' : delete params.match.$and;
  if (event.queryStringParameters.salesrep) {
    params.match['consumer.uuid'] = event.queryStringParameters.salesrep;
  }

  params.match = clientHandler.addClientFilterToConditions(params.match);

  params.limit = event.queryStringParameters.limit
    ? parseInt(event.queryStringParameters.limit, 10)
    : 20;
  params.skip = event.queryStringParameters.offset
    ? parseInt(event.queryStringParameters.offset, 10)
    : 0;

  const sorting = this.extractSortOptions(event, 'ordersPerSurgeon');

  // // console.log(sorting.length);

  params.sort = {};

  if (!Object.keys(sorting).length) {
    params.sort.orderStatus = 1;
  } else {
    params.sort = sorting;
  }

  // const util = require('util');
  // // console.log(util.inspect(params, false, null));

  if (widgetName) {
    return this.ordersPerSurgeonWidget(params, widgetName);
  }
  return bluebirdPromise
    .all([
      this.extractData(params, ordermodel, 'ordersPerSurgeon'),
      this.extractCount(params, ordermodel)
    ])
    .then(
      result =>
        // // console.log(result);
        result
    );
};

reportService.prototype.ordersPerSurgeonWidget = function(params, widgetName) {
  return ordermodel
    .aggregate([
      {
        $match: clientHandler.addClientFilterToConditions({})
      },
      {
        $project: params.project
      },
      {
        $match: params.match
      },
      ...akUtils.getMongoSysAttrsToObjQuery('attributes'),
      {
        $addFields: {
          surgeon: '$sysAttributes.surgeon'
        }
      },
      {
        $addFields: {
          city: { $ifNull: ['$surgeon', ''] }
        }
      },
      {
        $group: {
          _id: '$surgeon',
          count: {
            $sum: 1
          }
        }
      },
      {
        $sort: {
          _id: 1
        }
      }
    ])
    .exec()
    .then(data =>
      data.map((x, i) => {
        // console.log(`${x.count}+`);
        return {
          label: x._id,
          value: x.count
        };
      })
    );
};
/**
 *
 */
reportService.prototype.orderspersurgeonData = function(params) {
  return ordermodel
    .aggregate([
      {
        $project: params.project
      },
      {
        $match: params.match
      },
      {
        $sort: params.sort
      },
      {
        $skip: params.skip
      },
      {
        $limit: params.limit
      }
    ])
    .collation({
      locale: 'en_US',
      caseLevel: false
    })
    .exec()
    .then(result => {
      // // console.log(result);
      const list = [];
      if (result) {
        for (const i in result) {
          if (result.hasOwnProperty(i)) {
            const record = commonHelper.moveSystemAttributesToGlobal(result[i]);
            // // console.log(record);
            const tmp = {};
            tmp.id = record._id;
            tmp.surgery = record.surgery;
            tmp.code = record.code;
            tmp.orderStatus = akUtils.objectKeyByValue(orderStatusLabelMap, record.orderStatus);
            tmp.orderdate = record.orderedDate;
            tmp.surgerydate = record.etd || '';
            tmp.salesrep = record.salesrep;
            tmp.surgeon = record.surgeon || '';
            tmp.patient = record.patient || '';
            list.push(tmp);
          }
        }
      }
      // // console.log(list);
      return list;
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

/**
 *
 */
reportService.prototype.orderspersurgeonCount = function(params) {
  return ordermodel
    .aggregate([
      {
        $project: params.project
      },
      {
        $match: params.match
      },
      {
        $count: 'count'
      }
    ])
    .exec()
    .then(result => {
      // // console.log(result);
      // return 100;
      if (result[0].count) {
        return result[0].count;
      }
      return 0;
    })
    .then(result => {
      if (result === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

/**
 *
 */
reportService.prototype.ordersPerCity = function(event, widgetName) {
  const params = {};

  params.lookup = {
    from: 'locations',
    localField: 'addresses.location.id',
    foreignField: '_id',
    as: 'location'
  };

  params.project = {
    addresses: 1,
    code: 1,
    salesrep: {
      $concat: ['$consumer.firstName', ' ', '$consumer.lastName']
    },
    orderStatus: 1,
    orderedDate: 1,
    location: 1,
    etd: 1,
    consumer: 1,
    attributes: 1,
    client: 1
  };

  params.project = this.addAttributesToProject({
    $project: params.project,
    attributesToProject: 'surgeon'
  });

  params.match = {};

  // console.log(params.project);
  // console.log('params.project');

  if (event.queryStringParameters && event.queryStringParameters.filter) {
    // filters._all = event.queryStringParameters.filter;
    params.match.$or = [
      {
        code: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        salesrep: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'location.attributes': {
          $elemMatch: {
            name: 'city',
            value: new RegExp(event.queryStringParameters.filter, 'i')
          }
        }
      },
      {
        'location.attributes': {
          $elemMatch: {
            name: 'state',
            value: new RegExp(event.queryStringParameters.filter, 'i')
          }
        }
      }
    ];
    params.match.$or.push({
      orderStatus: akUtils.getOrderStatus(event.queryStringParameters.filter)
    });
  }

  if (event.queryStringParameters.code) {
    params.match.code = new RegExp(event.queryStringParameters.code, 'i');
  }

  if (event.queryStringParameters.orderStatus) {
    params.match.orderStatus = {
      $eq: akUtils.getOrderStatus(event.queryStringParameters.orderStatus)
    };
  }

  if (event.queryStringParameters.surgeryDateFrom || event.queryStringParameters.surgeryDateTo) {
    params.match.etd = {};
  }

  if (event.queryStringParameters.surgeryDateFrom) {
    params.match.etd.$gte = new Date(event.queryStringParameters.surgeryDateFrom);
  }

  if (event.queryStringParameters.surgeryDateTo) {
    params.match.etd.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.surgeryDateTo)
    );
  }

  if (event.queryStringParameters.orderedDateFrom || event.queryStringParameters.orderedDateTo) {
    params.match.orderedDate = {};
  }

  if (event.queryStringParameters.orderedDateFrom) {
    params.match.orderedDate.$gte = new Date(event.queryStringParameters.orderedDateFrom);
  }

  if (event.queryStringParameters.orderedDateTo) {
    params.match.orderedDate.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.orderedDateTo)
    );
  }
  if (event.queryStringParameters.city) {
    params.match['location.attributes'] = {
      $elemMatch: {
        name: 'city',
        value: new RegExp(event.queryStringParameters.city, 'i')
      }
    };
  }
  if (event.queryStringParameters.state) {
    let cond = {};
    if (params.match['location.attributes']) {
      cond = {
        $and: [
          params.match['location.attributes'],
          {
            $elemMatch: {
              name: 'state',
              value: new RegExp(event.queryStringParameters.state, 'i')
            }
          }
        ]
      };
    } else {
      cond = {
        $elemMatch: {
          name: 'state',
          value: new RegExp(event.queryStringParameters.state, 'i')
        }
      };
    }
    params.match['location.attributes'] = cond;
  }

  if (event.queryStringParameters.surgeon) {
    params.match.surgeon = {
      $elemMatch: {
        name: 'surgeon',
        value: new RegExp(event.queryStringParameters.surgeon, 'i')
      }
    };
  }

  if (event.queryStringParameters.salesrep) {
    params.match['consumer.uuid'] = event.queryStringParameters.salesrep;
  }

  params.match = clientHandler.addClientFilterToConditions(params.match);

  params.limit = event.queryStringParameters.limit
    ? parseInt(event.queryStringParameters.limit, 10)
    : 20;
  params.skip = event.queryStringParameters.offset
    ? parseInt(event.queryStringParameters.offset, 10)
    : 0;

  const sorting = this.extractSortOptions(event, 'ordersPerCity');

  // // console.log(sorting.length);

  params.sort = {};

  if (!Object.keys(sorting).length) {
    params.sort.code = 1;
  } else {
    params.sort = sorting;
  }

  // const util = require('util');
  // // console.log(util.inspect(params, false, null));

  if (widgetName) {
    return this.ordersPerCityWidget(params, widgetName);
  }

  return bluebirdPromise
    .all([this.ordersPerCityData(params), this.ordersPerCityCount(params)])
    .then(
      result =>
        // // console.log(result);
        result
    );
};

reportService.prototype.ordersPerCityWidget = function(params, widgetName) {
  return ordermodel
    .aggregate([
      {
        $lookup: params.lookup
      },
      {
        $project: params.project
      },
      {
        $match: params.match
      },
      {
        $unwind: {
          path: '$location',
          preserveNullAndEmptyArrays: true
        }
      },
      ...akUtils.getMongoSysAttrsToObjQuery('location.attributes'),
      {
        $addFields: {
          city: '$sysAttributes.city'
        }
      },
      {
        $addFields: {
          city: { $ifNull: ['$city', ''] }
        }
      },
      {
        $group: {
          _id: '$city',
          count: {
            $sum: 1
          }
        }
      },
      {
        $sort: {
          _id: 1
        }
      }
    ])
    .collation({
      locale: 'en_US',
      caseLevel: false
    })
    .exec()
    .then(data =>
      data.map(x => {
        // console.log(data);
        return {
          label: x._id || 'NA',
          value: x.count
        };
      })
    );
};
/**
 *
 */
reportService.prototype.ordersPerCityData = function(params) {
  return ordermodel
    .aggregate([
      {
        $lookup: params.lookup
      },
      {
        $project: params.project
      },
      {
        $match: params.match
      },
      {
        $sort: params.sort
      },
      {
        $skip: params.skip
      },
      {
        $limit: params.limit
      }
    ])
    .collation({
      locale: 'en_US',
      caseLevel: false
    })
    .exec()
    .then(result => {
      // // console.log(result);
      const list = [];
      if (result) {
        for (const i in result) {
          if (result.hasOwnProperty(i)) {
            list.push(this.formatReportData(result[i], 'ordersPerCity'));
          }
        }
      }
      // // console.log(list);
      return list;
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

/**
 *
 */
reportService.prototype.ordersPerCityCount = function(params) {
  return ordermodel
    .aggregate([
      {
        $lookup: params.lookup
      },
      {
        $project: params.project
      },
      {
        $match: params.match
      },
      {
        $count: 'count'
      }
    ])
    .exec()
    .then(result => {
      // // console.log(result);
      // return 100;
      if (result[0].count) {
        return result[0].count;
      }
      return 0;
    })
    .then(result => {
      if (result === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

/**
 *
 */
reportService.prototype.locationToZoneMapping = function(event) {
  const params = {};

  params.project = {
    location: {
      $arrayElemAt: ['$ancestors', 1]
    },
    floor: {
      $arrayElemAt: ['$ancestors', 0]
    },
    name: 1,
    code: 1,
    things: 1,
    type: 1,
    client: 1
  };

  params.match = {
    type: 'zone'
  };

  if (event.queryStringParameters && event.queryStringParameters.filter) {
    // filters._all = event.queryStringParameters.filter;
    params.match.$or = [
      {
        code: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'attributes.value': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'location.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'floor.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'things.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        name: new RegExp(event.queryStringParameters.filter, 'i')
      }
    ];
  }

  if (mongoose.Types.ObjectId.isValid(event.queryStringParameters.location)) {
    params.match['location.id'] = mongoose.Types.ObjectId(event.queryStringParameters.location);
  }

  if (mongoose.Types.ObjectId.isValid(event.queryStringParameters.floor)) {
    params.match['floor.id'] = mongoose.Types.ObjectId(event.queryStringParameters.floor);
  }

  if (mongoose.Types.ObjectId.isValid(event.queryStringParameters.zone)) {
    params.match._id = mongoose.Types.ObjectId(event.queryStringParameters.zone);
  }

  if (event.queryStringParameters.things && event.queryStringParameters.things.split(',').length) {
    const thingFilterIdArray = [];
    for (const id of event.queryStringParameters.things.split(',')) {
      if (mongoose.Types.ObjectId.isValid(id.trim())) {
        thingFilterIdArray.push(mongoose.Types.ObjectId(id.trim()));
      }
    }
    params.match['things.id'] = {
      $in: thingFilterIdArray
    };
  }

  params.match = clientHandler.addClientFilterToConditions(params.match);

  params.limit = event.queryStringParameters.limit
    ? parseInt(event.queryStringParameters.limit, 10)
    : 20;
  params.skip = event.queryStringParameters.offset
    ? parseInt(event.queryStringParameters.offset, 10)
    : 0;

  const sorting = this.extractSortOptions(event, 'locationToZoneMapping');

  // console.log(sorting);

  params.sort = {};

  if (!Object.keys(sorting).length) {
    params.sort.name = 1;
  } else {
    params.sort = sorting;
  }

  // const util = require('util');
  // // console.log(util.inspect(params, false, null));
  return bluebirdPromise
    .all([
      this.extractData(params, require('../models/location'), 'locationToZoneMapping'),
      this.extractCount(params, require('../models/location'))
    ])
    .then(
      result =>
        // // console.log(result);
        result
    );
};

/**
 * 
 */
reportService.prototype.shipmentDeliveryTime = function(event) {
  const params = {};
  // mongoose.set('debug', true);
  params.project = {
    code: 1,
    isInternal: 1,
    addresses: 1,
    shipDate: 1,
    shipmentStatus: 1,
    deliveryDate: 1,
    carrierUser: 1,
    attributes: 1,
    client: 1,
    dateDiff: {
      $subtract: ['$deliveryDate', '$shipDate']
    }
  };

  params.match = {};

  if (event.queryStringParameters && event.queryStringParameters.filter) {
    // filters._all = event.queryStringParameters.filter;
    params.match.$or = [
      {
        code: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'addresses.location.name': new RegExp(event.queryStringParameters.filter, 'i')
      }
    ];
    if (shipmentStatusLabel[event.queryStringParameters.filter]) {
      params.match.$or.push({
        shipmentStatus: parseInt(shipmentStatusLabel[event.queryStringParameters.filter])
      });
    }
  }

  if (event.queryStringParameters.code) {
    params.match.code = new RegExp(event.queryStringParameters.code, 'i');
  }

  if (event.queryStringParameters.shipDateTo || event.queryStringParameters.shipDateFrom) {
    params.match.shipDate = {};
  }

  if (event.queryStringParameters.shipDateFrom) {
    params.match.shipDate.$gte = new Date(event.queryStringParameters.shipDateFrom);
  }

  if (event.queryStringParameters.shipDateTo) {
    params.match.shipDate.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.shipDateTo)
    );
  }

  if (event.queryStringParameters.deliveryDateTo || event.queryStringParameters.deliveryDateFrom) {
    params.match.deliveryDate = {};
  }

  if (event.queryStringParameters.deliveryDateFrom) {
    params.match.deliveryDate.$gte = new Date(event.queryStringParameters.deliveryDateFrom);
  }

  if (event.queryStringParameters.deliveryDateTo) {
    params.match.deliveryDate.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.deliveryDateTo)
    );
  }

  if (event.queryStringParameters.toAddress) {
    params.match.addresses = {
      $elemMatch: {
        addressType: 'shipToAddress',
        'location.name': new RegExp(event.queryStringParameters.toAddress, 'i')
      }
    };
  }

  if (event.queryStringParameters.fromAddress) {
    params.match.addresses = {
      $elemMatch: {
        addressType: 'shipFromAddress',
        'location.name': new RegExp(event.queryStringParameters.fromAddress, 'i')
      }
    };
  }

  // params.match.etd.$lte = new Date();
  params.match.shipmentStatus = {};
  params.match.isInternal = false;
  params.match.shipmentStatus.$eq = 60;

  params.match = clientHandler.addClientFilterToConditions(params.match);

  params.limit = event.queryStringParameters.limit
    ? parseInt(event.queryStringParameters.limit, 10)
    : 20;
  params.skip = event.queryStringParameters.offset
    ? parseInt(event.queryStringParameters.offset, 10)
    : 0;

  const sorting = this.extractSortOptions(event, 'shipmentDeliveryTime');

  // // console.log(sorting.length);

  params.sort = {};

  if (!Object.keys(sorting).length) {
    params.sort.code = 1;
  } else {
    params.sort = sorting;
  }

  // const util = require('util');
  // // console.log(util.inspect(params, false, null));

  return bluebirdPromise.all([
    this.extractData(params, shipmentmodel, 'shipmentDeliveryTime'),
    this.extractCount(params, shipmentmodel)
  ]);
};

/**
 * 
 */
reportService.prototype.carrierWiseDelayedShipments = function(event) {
  const params = {};

  params.project = {
    code: 1,
    client: 1,
    shipmentStatus: 1,
    carrierUser: 1,
    carrier: {
      $concat: ['$carrierUser.firstName', ' ', '$carrierUser.lastName']
    },
    etd: 1,
    deliveryDate: 1,
    delay: {
      $subtract: ['$deliveryDate', '$etd']
    }
  };

  params.match = {
    shipmentStatus: shipmentStatusMap.Delivered,
    delay: {
      $gt: 0
    },
    'carrierUser.firstName': {
      $ne: ''
    }
  };

  if (event.queryStringParameters && event.queryStringParameters.filter) {
    // filters._all = event.queryStringParameters.filter;
    params.match.$or = [
      {
        code: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        carrier: new RegExp(event.queryStringParameters.filter, 'i')
      }
    ];
  }

  if (event.queryStringParameters.code) {
    params.match.code = new RegExp(event.queryStringParameters.code, 'i');
  }

  if (event.queryStringParameters.etdTo || event.queryStringParameters.etdFrom) {
    params.match.etd = {};
  }

  if (event.queryStringParameters.etdFrom) {
    params.match.etd.$gte = new Date(event.queryStringParameters.etdFrom);
  }

  if (event.queryStringParameters.etdTo) {
    params.match.etd.$lte = akUtils.formatToDateFilter(new Date(event.queryStringParameters.etdTo));
  }

  if (event.queryStringParameters.deliveryDateTo || event.queryStringParameters.deliveryDateFrom) {
    params.match.deliveryDate = {};
  }

  if (event.queryStringParameters.deliveryDateFrom) {
    params.match.deliveryDate.$gte = new Date(event.queryStringParameters.deliveryDateFrom);
  }

  if (event.queryStringParameters.deliveryDateTo) {
    params.match.deliveryDate.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.deliveryDateTo)
    );
  }

  if (event.queryStringParameters.carrier) {
    params.match['carrierUser.uuid'] = event.queryStringParameters.carrier;
  }

  if (event.queryStringParameters.delay) {
    const diff = (event.queryStringParameters.delay || '').split('-');
    params.match.delay = {};
    if (diff[0]) {
      const gt = diff[0] * 60 * 60 * 1000;
      params.match.delay.$gte = gt;
    }
    if (diff[1]) {
      const lt = diff[1] * 60 * 60 * 1000;
      params.match.delay.$lte = lt;
    }
  }
  params.match = clientHandler.addClientFilterToConditions(params.match);

  params.limit = event.queryStringParameters.limit
    ? parseInt(event.queryStringParameters.limit, 10)
    : 20;
  params.skip = event.queryStringParameters.offset
    ? parseInt(event.queryStringParameters.offset, 10)
    : 0;

  const sorting = this.extractSortOptions(event, 'carrierWiseDelayedShipments');

  // // console.log(sorting.length);

  params.sort = {};

  if (!Object.keys(sorting).length) {
    params.sort.carrier = 1;
  } else {
    params.sort = sorting;
  }

  // const util = require('util');
  // // console.log(util.inspect(params, false, null));

  return bluebirdPromise.all([
    this.extractData(params, shipmentmodel, 'carrierWiseDelayedShipments'),
    this.extractCount(params, shipmentmodel)
  ]);
};

/**
 * 
 */
reportService.prototype.shipmentHardDelivered = function(event) {
  const params = {};

  params.lookup = {
    from: 'shipmentorchestrations',
    localField: '_id',
    foreignField: 'shipmentId',
    as: 'shipmentorchestrations'
  };

  params.project = {
    code: 1,
    etd: 1,
    shipmentStatus: 1,
    deliveryDate: 1,
    carrierUser: 1,
    carrier: {
      $concat: ['$carrierUser.firstName', ' ', '$carrierUser.lastName']
    },
    attributes: 1,
    client: 1,
    isAdminDelivered: 1,
    shipmentorchestrations: 1
  };

  params.match = {};

  if (event.queryStringParameters && event.queryStringParameters.filter) {
    params.match.$or = [
      {
        code: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        carrier: new RegExp(event.queryStringParameters.filter, 'i')
      }
    ];
  }

  if (event.queryStringParameters.code) {
    params.match.code = new RegExp(event.queryStringParameters.code, 'i');
  }

  if (event.queryStringParameters.deliveryDateTo || event.queryStringParameters.deliveryDateFrom) {
    params.match.etd = {};
  }

  if (event.queryStringParameters.deliveryDateFrom) {
    params.match.etd.$gte = new Date(event.queryStringParameters.deliveryDateFrom);
  }

  if (event.queryStringParameters.deliveryDateTo) {
    params.match.etd.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.deliveryDateTo)
    );
  }

  if (event.queryStringParameters.carrier) {
    params.match['carrierUser.uuid'] = event.queryStringParameters.carrier;
  }

  params.match.shipmentStatus = 60;

  params.match.isAdminDelivered = 1;

  params.match = clientHandler.addClientFilterToConditions(params.match);

  params.limit = event.queryStringParameters.limit
    ? parseInt(event.queryStringParameters.limit, 10)
    : 20;
  params.skip = event.queryStringParameters.offset
    ? parseInt(event.queryStringParameters.offset, 10)
    : 0;

  const sorting = this.extractSortOptions(event, 'shipmentHardDelivered');

  // // console.log(sorting.length);

  params.sort = {};

  if (!Object.keys(sorting).length) {
    params.sort.code = 1;
  } else {
    params.sort = sorting;
  }

  // const util = require('util');
  // // console.log(util.inspect(params, false, null));

  return bluebirdPromise.all([
    this.shipmentHardDeliveredData(params),
    this.extractCount(params, shipmentmodel)
  ]);
};

/**
 *
 */
reportService.prototype.shipmentHardDeliveredData = function(params) {
  return shipmentmodel
    .aggregate([
      {
        $lookup: params.lookup
      },
      {
        $project: params.project
      },
      {
        $match: params.match
      },
      {
        $sort: params.sort
      },
      {
        $skip: params.skip
      },
      {
        $limit: params.limit
      }
    ])
    .collation({
      locale: 'en_US',
      caseLevel: false
    })
    .exec()
    .then(result => {
      // // console.log(result);
      const list = [];

      if (result) {
        for (const i in result) {
          if (result.hasOwnProperty(i)) {
            const deliveryTime = (result[i].shipmentorchestrations.filter(
              x => x.done === 1 && x.shipmentStatus === shipmentStatusMap.Delivered
            )[0] || {}
            ).actionTime;

            result[i].previousState = (result[i].shipmentorchestrations
              .filter(x => x.done === 1)
              .filter(x => x.actionTime < deliveryTime)
              .sort((a, b) => (a.actionTime < b.actionTime ? 1 : -1))[0] || {}
            ).shipmentStatus;
            list.push(this.formatReportData(result[i], 'shipmentHardDelivered'));
          }
        }
      }
      // // console.log(list);
      return list;
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

/**
 * 
 */
reportService.prototype.shipmentInJeopardy = function(event) {
  // // console.log(event);

  const params = {};

  params.project = {
    ordercode: '$code',
    shipmentcode: '$shipments.code',
    shipmentId: '$shipments._id',
    orderId: '$_id',
    _id: 0,
    // "addresses": 1,
    etd: 1,
    shipmentStatus: '$shipments.shipmentStatus',
    pickupDate: '$shipments.scheduledPickupDate',
    carrierUser: '$shipments.carrierUser',
    scheduledDeliveryDate: '$shipments.etd',
    carrier: {
      $concat: ['$shipments.carrierUser.firstName', ' ', '$shipments.carrierUser.lastName']
    },
    attributes: 1,
    client: 1,
    timeTillSurgery: 1,
    shipmentorchestrations: 1,
    toAddress: '$toAddress.location.name'
  };

  params.match = {};

  if (event.queryStringParameters && event.queryStringParameters.filter) {
    // filters._all = event.queryStringParameters.filter;
    params.match.$or = [
      {
        ordercode: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        shipmentcode: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        carrier: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        toAddress: new RegExp(event.queryStringParameters.filter, 'i')
      }
    ];
    params.match.$or.push({
      shipmentStatus: akUtils.getShipmentStatus(event.queryStringParameters.filter)
    });
  }

  if (event.queryStringParameters.shipmentcode) {
    params.match.shipmentcode = new RegExp(event.queryStringParameters.shipmentcode, 'i');
  }

  if (event.queryStringParameters.ordercode) {
    params.match.ordercode = new RegExp(event.queryStringParameters.ordercode, 'i');
  }

  if (event.queryStringParameters.carrier) {
    params.match['carrierUser.uuid'] = event.queryStringParameters.carrier;
  }

  if (
    event.queryStringParameters.scheduledDeliveryDateTo ||
    event.queryStringParameters.scheduledDeliveryDateFrom
  ) {
    params.match.scheduledDeliveryDate = {};
  }

  if (event.queryStringParameters.scheduledDeliveryDateFrom) {
    params.match.scheduledDeliveryDate.$gte = new Date(
      event.queryStringParameters.scheduledDeliveryDateFrom
    );
  }

  if (event.queryStringParameters.scheduledDeliveryDateTo) {
    params.match.scheduledDeliveryDate.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.scheduledDeliveryDateTo)
    );
  }

  if (event.queryStringParameters.shipmentStatus) {
    params.match.shipmentStatus = {
      $eq: akUtils.getShipmentStatus(event.queryStringParameters.shipmentStatus)
    };
  }

  if (event.queryStringParameters.timeTillSurgery) {
    const diff = (event.queryStringParameters.timeTillSurgery || '').split('-');
    params.match.timeTillSurgery = {};
    if (diff[0]) {
      const gt = diff[0] * 60 * 60 * 1000;
      params.match.timeTillSurgery.$gte = gt;
    }
    if (diff[1]) {
      const lt = diff[1] * 60 * 60 * 1000;
      params.match.timeTillSurgery.$lte = lt;
    }
  }
  // params.match.etd.$lte = new Date();
  // params.match.shipmentStatus = {};

  // params.match.isAdminDelivered = 1;

  params.match = clientHandler.addClientFilterToConditions(params.match);

  params.limit = event.queryStringParameters.limit
    ? parseInt(event.queryStringParameters.limit, 10)
    : 20;
  params.skip = event.queryStringParameters.offset
    ? parseInt(event.queryStringParameters.offset, 10)
    : 0;

  const sorting = this.extractSortOptions(event, 'shipmentInJeopardy');

  // // console.log(sorting.length);

  params.sort = {};

  if (!Object.keys(sorting).length) {
    params.sort.timeTillSurgery = 1;
  } else {
    params.sort = sorting;
  }

  const util = require('util');
  // console.log(util.inspect(params, false, null));

  return bluebirdPromise.all([
    this.shipmentInJeopardyData(params),
    this.shipmentInJeopardyCount(params)
  ]);
};

/**
 *
 */
reportService.prototype.shipmentInJeopardyData = function(params) {
  return ordermodel
    .aggregate([
      {
        $match: clientHandler.addClientFilterToConditions({})
      },
      {
        $addFields: {
          timeTillSurgery: {
            $subtract: ['$etd', new Date()]
          },
          toAddress: {
            $filter: {
              input: '$addresses',
              as: 'address',
              cond: {
                $eq: ['$$address.addressType', 'toAddress']
              }
            }
          }
        }
      },
      {
        $lookup: {
          from: 'shipments',
          localField: '_id',
          foreignField: 'products.orderDetails.id',
          as: 'shipments'
        }
      },
      {
        $unwind: '$shipments'
      },
      {
        $match: {
          'shipments.shipmentStatus': {
            $nin: [60, 70]
          },
          timeTillSurgery: {
            $gt: 0
          }
        }
      },
      {
        $project: params.project
      },
      {
        $match: params.match
      },
      {
        $sort: params.sort
      },
      {
        $skip: params.skip
      },
      {
        $limit: params.limit
      }
    ])
    .collation({
      locale: 'en_US',
      caseLevel: false
    })
    .exec()
    .then(result => {
      // // console.log(result);
      const list = [];
      if (result) {
        for (const i in result) {
          if (result.hasOwnProperty(i)) {
            list.push(this.formatReportData(result[i], 'shipmentInJeopardy'));
          }
        }
      }
      // // console.log(list);
      return list;
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

/**
 *
 */
reportService.prototype.shipmentInJeopardyCount = function(params) {
  return ordermodel
    .aggregate([
      {
        $match: clientHandler.addClientFilterToConditions({})
      },
      {
        $addFields: {
          timeTillSurgery: {
            $subtract: ['$etd', new Date()]
          },
          toAddress: {
            $filter: {
              input: '$addresses',
              as: 'address',
              cond: {
                $eq: ['$$address.addressType', 'toAddress']
              }
            }
          }
        }
      },
      {
        $lookup: {
          from: 'shipments',
          localField: '_id',
          foreignField: 'products.orderDetails.id',
          as: 'shipments'
        }
      },
      {
        $unwind: '$shipments'
      },
      {
        $match: {
          'shipments.shipmentStatus': {
            $nin: [60, 70]
          },
          timeTillSurgery: {
            $gt: 0
          }
        }
      },
      {
        $project: params.project
      },
      {
        $match: params.match
      },
      {
        $count: 'count'
      }
    ])
    .collation({
      locale: 'en',
      caseLevel: false
    })
    .exec()
    .then(result => {
      // // console.log(result);
      // return 100;
      if (result[0].count) {
        return result[0].count;
      }
      return 0;
    })
    .then(result => {
      if (result === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

/**
 * 
 */
reportService.prototype.mostUsedProductsPerSurgeon = function(event) {
  const params = {};
  params.addFields = {
    surgery: {
      $filter: {
        input: '$attributes',
        as: 'attribute',
        cond: {
          $eq: ['$$attribute.name', 'surgery']
        }
      }
    }
  };

  params.gMatch = {
    $and: [
      {
        'attributes.name': 'surgeon'
      },
      {
        'attributes.value': {
          $ne: ''
        }
      }
    ]
  };
  params.gSort = {
    orderedDate: 1
  };
  params.group = {
    _id: {
      surgeon: '$attributes.value',
      product: '$products.id',
      productCode: '$products.code',
      productName: '$products.name'
    },
    count: {
      $sum: 1
    },
    hospital: {
      $last: '$addresses'
    },
    surgery: {
      $last: '$surgery'
    }
  };

  params.lookup = {
    from: 'products',
    localField: '_id.product',
    foreignField: '_id',
    as: 'productDetails'
  };

  params.match = {};

  if (event.queryStringParameters && event.queryStringParameters.filter) {
    // filters._all = event.queryStringParameters.filter;
    params.match.$or = [
      {
        '_id.surgeon': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        '_id.productCode': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        '_id.productName': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        count: parseInt(event.queryStringParameters.filter, 'i')
      },
      {
        'productDetails.categories.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'surgery.value': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'hospital.location.name': new RegExp(event.queryStringParameters.filter, 'i')
      }
    ];
  }
  params.match.$and = [];

  if (event.queryStringParameters.surgeon) {
    params.match.$and.push({
      '_id.surgeon': new RegExp(event.queryStringParameters.surgeon, 'i')
    });
  }
  if (event.queryStringParameters.sku) {
    params.match.$and.push({
      '_id.productCode': new RegExp(event.queryStringParameters.sku, 'i')
    });
  }
  if (event.queryStringParameters.product) {
    params.match.$and.push({
      '_id.productName': new RegExp(event.queryStringParameters.product, 'i')
    });
  }
  if (event.queryStringParameters.count) {
    params.match.$and.push({
      count: parseInt(event.queryStringParameters.count, 'i')
    });
  }
  if (event.queryStringParameters.category) {
    params.match.$and.push({
      'productDetails.categories.name': new RegExp(event.queryStringParameters.category, 'i')
    });
  }

  if (event.queryStringParameters.surgery) {
    params.match.$and.push({
      'surgery.value': new RegExp(event.queryStringParameters.surgery, 'i')
    });
  }
  if (event.queryStringParameters.hospital) {
    params.match.$and.push({
      'hospital.location.name': new RegExp(event.queryStringParameters.hospital, 'i')
    });
  }

  params.gMatch = clientHandler.addClientFilterToConditions(params.gMatch);

  params.match.$and.length > 0 ? '' : delete params.match.$and;
  // console.log(params.match);

  params.limit = event.queryStringParameters.limit
    ? parseInt(event.queryStringParameters.limit, 10)
    : 20;
  params.skip = event.queryStringParameters.offset
    ? parseInt(event.queryStringParameters.offset, 10)
    : 0;

  const sorting = this.extractSortOptions(event, 'mostUsedProductsPerSurgeon');
  // // console.log(sorting.length);

  params.sort = {};

  if (!Object.keys(sorting).length) {
    params.sort.count = -1;
  } else {
    params.sort = sorting;
  }
  // const util = require('util');
  // // console.log(util.inspect(params, false, null));

  return bluebirdPromise
    .all([
      this.mostUsedProductsPerSurgeonData(params),
      this.mostUsedProductsPerSurgeonCount(params)
    ])
    .then(
      result =>
        // // console.log(result);
        result
    );
};

/**
 * 
 */
reportService.prototype.mostUsedProductsPerSurgeonData = function(params) {
  // console.log(params);
  // mongoose.set('debug', true);
  return ordermodel
    .aggregate([
      {
        $addFields: params.addFields
      },
      {
        $unwind: '$attributes'
      },
      {
        $unwind: '$products'
      },
      {
        $match: params.gMatch
      },
      {
        $sort: params.gSort
      },
      {
        $group: params.group
      },
      {
        $lookup: params.lookup
      },
      {
        $match: params.match
      },
      {
        $sort: params.sort
      },
      {
        $skip: params.skip
      },
      {
        $limit: params.limit
      }
    ])
    .collation({
      locale: 'en_US',
      caseLevel: false
    })
    .exec()
    .then(result => {
      // console.log(result);
      const list = [];
      if (result) {
        result = (result || []).map(res => {
          const addresses = (res.hospital || []).reduce((a, b) => {
            a[b.addressType] = b.location;
            return a;
          }, {});
          res = Object.assign({}, res, addresses);
          res.categories = ((res.productDetails || [])[0] || {}).categories || [];
          return res;
        });
        for (const i in result) {
          if (result.hasOwnProperty(i)) {
            const record = result[i];
            const tmp = {};
            tmp.surgeon = record._id.surgeon;
            tmp.product = record._id.productName;
            tmp.productId = record._id.product;
            tmp.sku = record._id.productCode;
            tmp.categories = (record.categories || []).map(cat => cat.name).join(',');
            tmp.count = record.count;
            tmp.surgery = (record.surgery || [])[0].value || '';
            tmp.hospital = (record.toAddress || {}).name || '';
            list.push(tmp);
          }
        }
      }
      return list;
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    })
    .catch(err => {
      // console.log(err);
    });
};

/**
 * 
 */
reportService.prototype.mostUsedProductsPerSurgeonCount = function(params) {
  return ordermodel
    .aggregate([
      {
        $addFields: params.addFields
      },
      {
        $unwind: '$attributes'
      },
      {
        $unwind: '$products'
      },
      {
        $match: params.gMatch
      },
      {
        $group: params.group
      },
      {
        $match: params.match
      },
      {
        $count: 'count'
      }
    ])
    .exec()
    .then(result => {
      // return 100;
      if (((result || [])[0] || {}).count) {
        return ((result || [])[0] || {}).count;
      }
      return 0;
    })
    .then(result => {
      if (result === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    })
    .catch(err => {
      // console.log(err);
    });
};

/**
 * 
 */
reportService.prototype.partialShipments = function(event) {
  // // console.log(event);

  const params = {};

  params.project = {
    shipmentcode: '$code',
    ordercode: '$orders.code',
    orderId: '$orders._id',
    shipmentId: '$_id',
    _id: 0,
    shipmentStatus: 1,
    carrierUser: 1,
    scheduledDeliveryDate: '$etd',
    carrier: {
      $concat: ['$carrierUser.firstName', ' ', '$carrierUser.lastName']
    },
    attributes: 1,
    client: 1,
    toAddress: '$toAddress.location.name'
  };

  params.match = {};

  if (event.queryStringParameters && event.queryStringParameters.filter) {
    // filters._all = event.queryStringParameters.filter;
    params.match.$or = [
      {
        ordercode: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        shipmentcode: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        carrier: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        toAddress: new RegExp(event.queryStringParameters.filter, 'i')
      }
    ];
    params.match.$or.push({
      shipmentStatus: akUtils.getShipmentStatus(event.queryStringParameters.filter)
    });
  }

  if (event.queryStringParameters.shipmentcode) {
    params.match.shipmentcode = new RegExp(event.queryStringParameters.shipmentcode, 'i');
  }

  if (event.queryStringParameters.ordercode) {
    params.match.ordercode = new RegExp(event.queryStringParameters.ordercode, 'i');
  }

  if (event.queryStringParameters.carrier) {
    params.match['carrierUser.uuid'] = event.queryStringParameters.carrier;
  }

  if (
    event.queryStringParameters.scheduledDeliveryDateTo ||
    event.queryStringParameters.scheduledDeliveryDateFrom
  ) {
    params.match.scheduledDeliveryDate = {};
  }

  if (event.queryStringParameters.scheduledDeliveryDateFrom) {
    params.match.scheduledDeliveryDate.$gte = new Date(
      event.queryStringParameters.scheduledDeliveryDateFrom
    );
  }

  if (event.queryStringParameters.scheduledDeliveryDateTo) {
    params.match.scheduledDeliveryDate.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.scheduledDeliveryDateTo)
    );
  }

  if (event.queryStringParameters.shipmentStatus) {
    params.match.shipmentStatus = {
      $eq: akUtils.getShipmentStatus(event.queryStringParameters.shipmentStatus)
    };
  }
  // params.match.etd.$lte = new Date();

  // params.match.isAdminDelivered = 1;

  params.match = clientHandler.addClientFilterToConditions(params.match);

  params.limit = event.queryStringParameters.limit
    ? parseInt(event.queryStringParameters.limit, 10)
    : 20;
  params.skip = event.queryStringParameters.offset
    ? parseInt(event.queryStringParameters.offset, 10)
    : 0;

  const sorting = this.extractSortOptions(event, 'partialShipments');

  // // console.log(sorting.length);

  params.sort = {};

  if (!Object.keys(sorting).length) {
    params.sort.shipmentcode = 1;
  } else {
    params.sort = sorting;
  }

  const util = require('util');
  // console.log(util.inspect(params, false, null));

  return bluebirdPromise.all([
    this.partialShipmentsData(params),
    this.partialShipmentsCount(params)
  ]);
};

/**
 *
 */
reportService.prototype.partialShipmentsData = function(params) {
  return shipmentmodel
    .aggregate([
      {
        $match: clientHandler.addClientFilterToConditions({})
      },
      {
        $addFields: {
          toAddress: {
            $filter: {
              input: '$addresses',
              as: 'address',
              cond: {
                $eq: ['$$address.addressType', 'shipToAddress']
              }
            }
          }
        }
      },
      {
        $lookup: {
          from: 'orders',
          foreignField: '_id',
          localField: 'products.orderDetails.id',
          as: 'orders'
        }
      },
      {
        $unwind: '$orders'
      },
      {
        $match: {
          shipmentStatus: {
            $in: [shipmentStatusMap.PartialShipped, shipmentStatusMap.PartialDelivered]
          }
        }
      },
      {
        $project: params.project
      },
      {
        $match: params.match
      },
      {
        $sort: params.sort
      },
      {
        $skip: params.skip
      },
      {
        $limit: params.limit
      }
    ])
    .collation({
      locale: 'en_US',
      caseLevel: false
    })
    .exec()
    .then(result => {
      // // console.log(result);
      const list = [];
      if (result) {
        for (const i in result) {
          if (result.hasOwnProperty(i)) {
            list.push(this.formatReportData(result[i], 'partialShipments'));
          }
        }
      }
      // // console.log(list);
      return list;
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

/**
 *
 */
reportService.prototype.partialShipmentsCount = function(params) {
  return shipmentmodel
    .aggregate([
      {
        $match: clientHandler.addClientFilterToConditions({})
      },
      {
        $addFields: {
          toAddress: {
            $filter: {
              input: '$addresses',
              as: 'address',
              cond: {
                $eq: ['$$address.addressType', 'shipToAddress']
              }
            }
          }
        }
      },
      {
        $lookup: {
          from: 'orders',
          foreignField: '_id',
          localField: 'products.orderDetails.id',
          as: 'orders'
        }
      },
      {
        $unwind: '$orders'
      },
      {
        $match: {
          shipmentStatus: {
            $in: [shipmentStatusMap.PartialShipped, shipmentStatusMap.PartialDelivered]
          }
        }
      },
      {
        $project: params.project
      },
      {
        $match: params.match
      },
      {
        $count: 'count'
      }
    ])
    .collation({
      locale: 'en',
      caseLevel: false
    })
    .exec()
    .then(result => {
      // // console.log(result);
      // return 100;
      if (result[0].count) {
        return result[0].count;
      }
      return 0;
    })
    .then(result => {
      if (result === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

/**
 * 
 */
reportService.prototype.salesrepWiseProductOrder = function(event) {
  const params = {};

  params.gMatch = {
    'consumer.uuid': {
      $exists: true,
      $ne: ''
    }
  };
  params.gSort = {
    orderedDate: -1
  };
  params.group = {
    _id: {
      salesRep: '$consumer.uuid',
      salesRepName: {
        $concat: ['$consumer.firstName', ' ', '$consumer.lastName']
      },
      product: '$products.id',
      productCode: '$products.code',
      productName: '$products.name'
    },
    count: {
      $sum: 1
    },
    order: {
      $first: '$code'
    },
    lastOrdered: {
      $first: '$createdOn'
    },
    orderId: {
      $first: '$_id'
    }
  };

  params.lookup = {
    from: 'products',
    localField: '_id.product',
    foreignField: '_id',
    as: 'productDetails'
  };

  params.match = {};

  if (event.queryStringParameters && event.queryStringParameters.filter) {
    // filters._all = event.queryStringParameters.filter;
    params.match.$or = [
      {
        '_id.salesRep': event.queryStringParameters.filter
      },
      {
        '_id.productCode': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        '_id.productName': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        count: parseInt(event.queryStringParameters.filter, 'i')
      },
      {
        'productDetails.categories.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        order: new RegExp(event.queryStringParameters.filter, 'i')
      }
    ];
  }
  params.match.$and = [];

  if (event.queryStringParameters.salesrep) {
    params.match.$and.push({
      '_id.salesRep': new RegExp(event.queryStringParameters.salesrep, 'i')
    });
  }
  if (event.queryStringParameters.sku) {
    params.match.$and.push({
      '_id.productCode': new RegExp(event.queryStringParameters.sku, 'i')
    });
  }
  if (mongoose.Types.ObjectId.isValid(event.queryStringParameters.product)) {
    params.match.$and.push({
      '_id.product': mongoose.Types.ObjectId(event.queryStringParameters.product)
    });
  }
  if (event.queryStringParameters.count) {
    params.match.$and.push({
      count: parseInt(event.queryStringParameters.count, 10)
    });
  }
  if (event.queryStringParameters.category) {
    const categoriesToSearch = event.queryStringParameters.category.split(',').map(x => {
      x = x.trim();
      if (mongoose.Types.ObjectId.isValid(x)) {
        return mongoose.Types.ObjectId(x);
      }
      return x;
    });

    params.match.$and.push({
      'productDetails.categories.id': {
        $in: categoriesToSearch
      }
    });
  }

  if (event.queryStringParameters.code) {
    params.match.$and.push({
      order: new RegExp(event.queryStringParameters.code, 'i')
    });
  }
  if (event.queryStringParameters.hospital) {
    params.match.$and.push({
      'hospital.location.name': new RegExp(event.queryStringParameters.hospital, 'i')
    });
  }
  const lastOrdered = {};

  if (event.queryStringParameters.orderedDateFrom) {
    lastOrdered.$gte = new Date(event.queryStringParameters.orderedDateFrom);
  }

  if (event.queryStringParameters.orderedDateTo) {
    lastOrdered.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.orderedDateTo)
    );
  }

  if (event.queryStringParameters.orderedDateFrom || event.queryStringParameters.orderedDateTo) {
    params.match.$and.push({
      lastOrdered
    });
  }

  params.gMatch = clientHandler.addClientFilterToConditions(params.gMatch);

  params.match.$and.length > 0 ? '' : delete params.match.$and;
  // console.log(params.match);

  params.limit = event.queryStringParameters.limit
    ? parseInt(event.queryStringParameters.limit, 10)
    : 20;
  params.skip = event.queryStringParameters.offset
    ? parseInt(event.queryStringParameters.offset, 10)
    : 0;

  const sorting = this.extractSortOptions(event, 'salesrepWiseProductOrder');
  // // console.log(sorting.length);

  params.sort = {};

  if (!Object.keys(sorting).length) {
    params.sort.count = -1;
  } else {
    params.sort = sorting;
  }
  // const util = require('util');
  // // console.log(util.inspect(params, false, null));

  return bluebirdPromise
    .all([this.salesrepWiseProductOrderData(params), this.salesrepWiseProductOrderCount(params)])
    .then(
      result =>
        // // console.log(result);
        result
    );
};

/**
 * 
 */
reportService.prototype.salesrepWiseProductOrderData = function(params) {
  return ordermodel
    .aggregate([
      {
        $unwind: '$products'
      },
      {
        $match: params.gMatch
      },
      {
        $sort: params.gSort
      },
      {
        $group: params.group
      },
      {
        $lookup: params.lookup
      },
      {
        $match: params.match
      },
      {
        $sort: params.sort
      },
      {
        $skip: params.skip
      },
      {
        $limit: params.limit
      }
    ])
    .collation({
      locale: 'en_US',
      caseLevel: false
    })
    .exec()
    .then(result => {
      // console.log(result);
      const list = [];
      if (result) {
        result = (result || []).map(res => {
          res.categories = ((res.productDetails || [])[0] || {}).categories || [];
          return res;
        });
        for (const i in result) {
          if (result.hasOwnProperty(i)) {
            const record = result[i];
            const tmp = {};
            tmp.orderId = record.orderId;
            tmp.salesrep = record._id.salesRepName;
            tmp.salesrepUuid = record._id.salesRep;
            tmp.product = record._id.productName;
            tmp.productId = record._id.product;
            tmp.sku = record._id.productCode;
            tmp.categories = (record.categories || []).map(cat => cat.name).join(',');
            tmp.count = record.count;
            tmp.order = record.order || '';
            tmp.lastOrdered = record.lastOrdered || '';
            list.push(tmp);
          }
        }
      }
      return list;
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    })
    .catch(err => {
      // console.log(err);
    });
};

/**
 * 
 */
reportService.prototype.salesrepWiseProductOrderCount = function(params) {
  return ordermodel
    .aggregate([
      {
        $unwind: '$products'
      },
      {
        $match: params.gMatch
      },
      {
        $sort: params.gSort
      },
      {
        $group: params.group
      },
      {
        $lookup: params.lookup
      },
      {
        $match: params.match
      },
      {
        $count: 'count'
      }
    ])
    .exec()
    .then(result => {
      // return 100;
      if (((result || [])[0] || {}).count) {
        return ((result || [])[0] || {}).count;
      }
      return 0;
    })
    .then(result => {
      if (result === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    })
    .catch(err => {
      // console.log(err);
    });
};

reportService.prototype.addAttributesToProject = function({
  $project: $project = {},
  path: path = 'attributes',
  attributesToProject
}) {
  path = path || 'attributes';
  if (!Array.isArray(attributesToProject)) {
    attributesToProject = [attributesToProject];
  }

  for (const attr of attributesToProject) {
    $project[attr] = {
      $filter: {
        input: `$${path}`,
        as: 'attributes',
        cond: {
          $eq: ['$$attributes.name', attr]
        }
      }
    };
  }
  return $project;
};

/**
 * 
 */
reportService.prototype.stationaryShipments = function(event) {
  return configurationHelper.getConfigurations().then(config => {
    // console.log('++++++');
    const params = {};
    const stationaryTimeSeconds = config.stationaryShipmentTimeSeconds || 600;
    // console.log(event);
    params.project = {
      code: 1,
      shipmentStatus: 1,
      toAddress: '$toAddress.location.name',
      currentLocation: '$trackingData.currentLocation',
      stationarySince: 1,
      lastMoved: '$trackingData.lastMoved'
    };

    params.match = {};

    if (event.queryStringParameters && event.queryStringParameters.filter) {
      // filters._all = event.queryStringParameters.filter;
      params.match.$or = [
        {
          code: event.queryStringParameters.filter
        },
        {
          toAddress: new RegExp(event.queryStringParameters.filter, 'i')
        },
        {
          'currentLocation.name': new RegExp(event.queryStringParameters.filter, 'i')
        },
        {
          'currentLocation.address.value': new RegExp(event.queryStringParameters.filter, 'i')
        }
      ];
      params.match.$or.push({
        shipmentStatus: akUtils.getShipmentStatus(event.queryStringParameters.filter)
      });
    }

    params.match.stationarySince = {
      $gte: stationaryTimeSeconds * 1000
    };
    params.match.$and = [];
    if (event.queryStringParameters.shipmentStatus) {
      params.match.$and.push({
        shipmentStatus: akUtils.getShipmentStatus(event.queryStringParameters.shipmentStatus)
      });
    }

    if (event.queryStringParameters.code) {
      params.match.$and.push({
        code: new RegExp(event.queryStringParameters.code, 'i')
      });
    }

    if (event.queryStringParameters.toAddress) {
      params.match.$and.push({
        toAddress: new RegExp(event.queryStringParameters.toAddress, 'i')
      });
    }

    if (event.queryStringParameters.currentLocation) {
      params.match.$and.push({
        $or: [
          {
            'currentLocation.address': new RegExp(event.queryStringParameters.currentLocation, 'i')
          },
          {
            'currentLocation.name': new RegExp(event.queryStringParameters.currentLocation, 'i')
          }
        ]
      });
    }

    params.match.$and.length > 0 ? '' : delete params.match.$and;
    params.limit = event.queryStringParameters.limit
      ? parseInt(event.queryStringParameters.limit, 10)
      : 20;
    params.skip = event.queryStringParameters.offset
      ? parseInt(event.queryStringParameters.offset, 10)
      : 0;

    const sorting = this.extractSortOptions(event, 'stationaryShipments');
    // // console.log(sorting.length);

    params.sort = {};

    if (!Object.keys(sorting).length) {
      params.sort.stationarySince = -1;
    } else {
      params.sort = sorting;
    }
    // const util = require('util');
    // // console.log(util.inspect(params, false, null));

    return bluebirdPromise
      .all([this.stationaryShipmentsData(params), this.stationaryShipmentsCount(params)])
      .then(
        result =>
          // // console.log(result);
          result
      );
  });
};

/**
 *
 */
reportService.prototype.stationaryShipmentsData = function(params) {
  return shipmentmodel
    .aggregate([
      {
        $match: clientHandler.addClientFilterToConditions({
          shipmentStatus: {
            $in: [
              shipmentStatusMap.PartialShipped,
              shipmentStatusMap.Shipped,
              shipmentStatusMap.Scheduled,
              shipmentStatusMap.SoftShipped
            ]
          }
        })
      },
      {
        $lookup: {
          from: 'shipmenttrackings',
          localField: '_id',
          foreignField: 'shipment.id',
          as: 'trackingData'
        }
      },
      {
        $addFields: {
          toAddress: {
            $filter: {
              input: '$addresses',
              as: 'address',
              cond: {
                $eq: ['$$address.addressType', 'shipToAddress']
              }
            }
          }
        }
      },
      {
        $unwind: '$trackingData'
      },
      {
        $addFields: {
          stationarySince: {
            $subtract: [new Date(), '$trackingData.lastMoved']
          }
        }
      },
      {
        $project: params.project
      },
      {
        $match: params.match
      },
      {
        $sort: params.sort
      },
      {
        $skip: params.skip
      },
      {
        $limit: params.limit
      }
    ])
    .collation({
      locale: 'en_US',
      caseLevel: false
    })
    .exec()
    .then(result => {
      // // console.log(result);
      const list = [];
      if (result) {
        for (const i in result) {
          if (result.hasOwnProperty(i)) {
            list.push(this.formatReportData(result[i], 'stationaryShipments'));
          }
        }
      }
      // // console.log(list);
      return list;
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

/**
 *
 */
reportService.prototype.stationaryShipmentsCount = function(params) {
  return shipmentmodel
    .aggregate([
      {
        $match: clientHandler.addClientFilterToConditions({
          shipmentStatus: {
            $in: [
              shipmentStatusMap.PartialShipped,
              shipmentStatusMap.Shipped,
              shipmentStatusMap.Scheduled,
              shipmentStatusMap.SoftShipped
            ]
          }
        })
      },
      {
        $lookup: {
          from: 'shipmenttrackings',
          localField: '_id',
          foreignField: 'shipment.id',
          as: 'trackingData'
        }
      },
      {
        $addFields: {
          toAddress: {
            $filter: {
              input: '$addresses',
              as: 'address',
              cond: {
                $eq: ['$$address.addressType', 'shipToAddress']
              }
            }
          }
        }
      },
      {
        $unwind: '$trackingData'
      },
      {
        $addFields: {
          stationarySince: {
            $subtract: [new Date(), '$trackingData.lastMoved']
          }
        }
      },
      {
        $project: params.project
      },
      {
        $match: params.match
      },
      {
        $count: 'count'
      }
    ])
    .collation({
      locale: 'en',
      caseLevel: false
    })
    .exec()
    .then(result => {
      // // console.log(result);
      // return 100;
      if (result[0].count) {
        return result[0].count;
      }
      return 0;
    })
    .then(result => {
      if (result === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

/**
 * 
 */
reportService.prototype.internalExternalShipment = function(event) {
  const params = {};

  params.addFields = {
    toAddress: {
      $filter: {
        input: '$addresses',
        as: 'address',
        cond: {
          $eq: ['$$address.addressType', 'shipToAddress']
        }
      }
    }
  };

  params.gUnwind = {
    path: '$toAddress'
  };

  params.group = {
    _id: '$toAddress.location.id',
    shipments: {
      $addToSet: '$$ROOT'
    }
  };

  params.project = {
    _id: 0,
    location: { $arrayElemAt: ['$shipments.toAddress.location', 1] },
    externalCount: {
      $size: {
        $filter: {
          input: '$shipments',
          as: 'shipment',
          cond: {
            $eq: ['$$shipment.isInternal', false]
          }
        }
      }
    },

    internalCount: {
      $size: {
        $filter: {
          input: '$shipments',
          as: 'shipments',
          cond: {
            $eq: ['$$shipments.isInternal', true]
          }
        }
      }
    }
  };

  params.match = {};

  if (event.queryStringParameters && event.queryStringParameters.filter) {
    const numberCastFilter = !Number.isNaN(parseInt(event.queryStringParameters.filter, 10))
      ? parseInt(event.queryStringParameters.filter, 10)
      : -1; // defaults to -1
    params.match.$or = [
      {
        'location.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        externalCount: numberCastFilter
      },
      {
        internalCount: numberCastFilter
      }
    ];
  }

  params.match.$and = [];

  if (mongoose.Types.ObjectId.isValid(event.queryStringParameters.location)) {
    params.match.$and.push({
      'location.id': mongoose.Types.ObjectId(event.queryStringParameters.location)
    });
  }

  if (!Number.isNaN(parseInt(event.queryStringParameters.externalCount))) {
    params.match.$and.push({
      externalCount: parseInt(event.queryStringParameters.externalCount)
    });
  }

  if (!Number.isNaN(parseInt(event.queryStringParameters.internalCount))) {
    params.match.$and.push({
      internalCount: parseInt(event.queryStringParameters.internalCount)
    });
  }

  params.match.$and.length > 0 ? '' : delete params.match.$and;
  params.limit = event.queryStringParameters.limit
    ? parseInt(event.queryStringParameters.limit, 10)
    : 20;
  params.skip = event.queryStringParameters.offset
    ? parseInt(event.queryStringParameters.offset, 10)
    : 0;

  const sorting = this.extractSortOptions(event, 'internalExternalShipment');
  // // console.log(sorting.length);

  params.sort = {};

  if (!Object.keys(sorting).length) {
    params.sort['location.name'] = 1;
  } else {
    params.sort = sorting;
  }
  // const util = require('util');
  // // console.log(util.inspect(params, false, null));

  return bluebirdPromise
    .all([this.internalExternalShipmentData(params), this.internalExternalShipmentCount(params)])
    .then(
      result =>
        // // console.log(result);
        result
    );
};

/**
 *
 */
reportService.prototype.internalExternalShipmentData = function(params) {
  return shipmentmodel
    .aggregate([
      {
        $match: clientHandler.addClientFilterToConditions({})
      },
      {
        $addFields: params.addFields
      },
      {
        $unwind: params.gUnwind
      },
      {
        $group: params.group
      },
      {
        $project: params.project
      },
      {
        $match: params.match
      },
      {
        $sort: params.sort
      },
      {
        $skip: params.skip
      },
      {
        $limit: params.limit
      }
    ])
    .collation({
      locale: 'en_US',
      caseLevel: false
    })
    .exec()
    .then(result => {
      // // console.log(result);
      const list = [];
      if (result) {
        for (const i in result) {
          if (result.hasOwnProperty(i)) {
            list.push(this.formatReportData(result[i], 'internalExternalShipment'));
          }
        }
      }
      // // console.log(list);
      return list;
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

/**
 *
 */
reportService.prototype.internalExternalShipmentCount = function(params) {
  return shipmentmodel
    .aggregate([
      {
        $match: clientHandler.addClientFilterToConditions({})
      },
      {
        $addFields: params.addFields
      },
      {
        $unwind: params.gUnwind
      },
      {
        $group: params.group
      },
      {
        $project: params.project
      },
      {
        $match: params.match
      },
      {
        $count: 'count'
      }
    ])
    .collation({
      locale: 'en',
      caseLevel: false
    })
    .exec()
    .then(result => {
      // // console.log(result);
      // return 100;
      if (result[0].count) {
        return result[0].count;
      }
      return 0;
    })
    .then(result => {
      if (result === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

/**
 * 
 */
reportService.prototype.sensorConnectionStatus = function(event) {
  const params = {};

  params.lookup = {
    from: 'producttrackings',
    localField: '_id',
    foreignField: 'sensor.id',
    as: 'trackingData'
  };

  params.match = {};

  if (event.queryStringParameters && event.queryStringParameters.filter) {
    // filters._all = event.queryStringParameters.filter;
    params.match.$or = [
      {
        name: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        isAssigned: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'product.code': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'product.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'attributes.value': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'trackingData.currentLocation.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'trackingData.currentLocation.address.value': new RegExp(
          event.queryStringParameters.filter,
          'i'
        )
      }
    ];
  }
  params.match.$and = [];

  if (event.queryStringParameters.sensor) {
    params.match.$and.push({
      name: new RegExp(event.queryStringParameters.sensor, 'i')
    });
  }
  if (event.queryStringParameters.sku) {
    params.match.$and.push({
      'product.code': new RegExp(event.queryStringParameters.sku, 'i')
    });
  }
  if (event.queryStringParameters.product) {
    params.match.$and.push({
      'product.name': new RegExp(event.queryStringParameters.product, 'i')
    });
  }

  if (yesNoValues[parseInt(event.queryStringParameters.isAssigned, 10)]) {
    params.match.$and.push({
      isAssigned: yesNoValues[parseInt(event.queryStringParameters.isAssigned, 10)]
    });
  }

  if (event.queryStringParameters.manufacturer) {
    params.match.$and.push({
      attributes: {
        $elemMatch: {
          name: 'manufacturer',
          value: new RegExp(event.queryStringParameters.manufacturer, 'i')
        }
      }
    });
  }

  params.match.$and.length > 0 ? '' : delete params.match.$and;
  params.limit = event.queryStringParameters.limit
    ? parseInt(event.queryStringParameters.limit, 10)
    : 20;
  params.skip = event.queryStringParameters.offset
    ? parseInt(event.queryStringParameters.offset, 10)
    : 0;

  const sorting = this.extractSortOptions(event, 'sensorConnectionStatus');
  // // console.log(sorting.length);

  params.sort = {};

  if (!Object.keys(sorting).length) {
    params.sort.name = 1;
  } else {
    params.sort = sorting;
  }
  const util = require('util');
  // console.log(util.inspect(params, false, null));

  return bluebirdPromise
    .all([this.sensorConnectionStatusData(params), this.sensorConnectionStatusCount(params)])
    .then(
      result =>
        // // console.log(result);
        result
    );
};

/**
 *
 */
reportService.prototype.sensorConnectionStatusData = function(params) {
  return thingsmodel
    .aggregate([
      {
        $match: clientHandler.addClientFilterToConditions({
          type: 'beacon'
        })
      },
      {
        $addFields: {
          isAssigned: {
            $cond: [
              {
                $ifNull: ['$product.id', false]
              },
              'Yes',
              'No'
            ]
          }
        }
      },
      {
        $lookup: params.lookup
      },
      {
        $match: params.match
      },
      {
        $sort: params.sort
      },
      {
        $skip: params.skip
      },
      {
        $limit: params.limit
      }
    ])
    .collation({
      locale: 'en_US',
      caseLevel: false
    })
    .exec()
    .then(result => {
      const list = [];
      if (result) {
        for (const i in result) {
          if (result.hasOwnProperty(i)) {
            list.push(this.formatReportData(result[i], 'sensorConnectionStatus'));
          }
        }
      }
      // // console.log(list);
      return list;
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

/**
 *
 */
reportService.prototype.sensorConnectionStatusCount = function(params) {
  return thingsmodel
    .aggregate([
      {
        $match: clientHandler.addClientFilterToConditions({
          type: 'beacon'
        })
      },
      {
        $addFields: {
          isAssigned: {
            $cond: [
              {
                $ifNull: ['$product.id', false]
              },
              'Yes',
              'No'
            ]
          }
        }
      },
      {
        $lookup: params.lookup
      },
      {
        $match: params.match
      },
      {
        $count: 'count'
      }
    ])
    .collation({
      locale: 'en',
      caseLevel: false
    })
    .exec()
    .then(result => {
      // // console.log(result);
      // return 100;
      if (result[0].count) {
        return result[0].count;
      }
      return 0;
    })
    .then(result => {
      if (result === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

/**
 * 
 */
reportService.prototype.appStatus = function(event, widgetName) {
  const params = {};

  params.preParams = [
    {
      $match: clientHandler.addClientFilterToConditions({
        type: 'software'
      })
    },
    {
      $project: {
        client: 0
      }
    },
    {
      $addFields: {
        associatedUser: {
          $filter: {
            input: '$attributes',
            as: 'attribute',
            cond: {
              $eq: ['$$attribute.name', 'associatedUserId']
            }
          }
        }
      }
    },
    {
      $addFields: {
        appName: {
          $filter: {
            input: '$attributes',
            as: 'attribute',
            cond: {
              $eq: ['$$attribute.name', 'appName']
            }
          }
        }
      }
    },
    {
      $addFields: {
        channelId: {
          $filter: {
            input: '$attributes',
            as: 'attribute',
            cond: {
              $eq: ['$$attribute.name', 'channelId']
            }
          }
        }
      }
    },
    {
      $addFields: {
        bluetooth: {
          $filter: {
            input: '$attributes',
            as: 'attribute',
            cond: {
              $eq: ['$$attribute.name', 'bluetoothStatus']
            }
          }
        }
      }
    },
    {
      $addFields: {
        gps: {
          $filter: {
            input: '$attributes',
            as: 'attribute',
            cond: {
              $eq: ['$$attribute.name', 'locationStatus']
            }
          }
        }
      }
    },
    {
      $addFields: {
        gps: '$gps'
      }
    },
    {
      $addFields: {
        bluetooth: '$bluetooth'
      }
    },
    {
      $unwind: {
        path: '$associatedUser',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $unwind: {
        path: '$appName',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $unwind: {
        path: '$channelId',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $unwind: {
        path: '$gps',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $unwind: {
        path: '$bluetooth',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $lookup: {
        from: 'appsettings',
        localField: 'associatedUser.value',
        foreignField: 'user.email',
        as: 'appSettings'
      }
    },
    {
      $unwind: {
        path: '$appSettings',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $addFields: {
        sameApp: {
          $eq: ['$appName.value', '$appSettings.appName']
        }
      }
    },
    {
      $match: {
        $or: [
          {
            sameApp: true
          },
          {
            appSettings: {
              $exists: false
            }
          }
        ]
      }
    },
    {
      $lookup: {
        from: 'devicetrackings',
        localField: '_id',
        foreignField: 'device.id',
        as: 'trackingData'
      }
    },
    {
      $addFields: {
        trackingData: {
          $arrayElemAt: ['$trackingData', -1]
        }
      }
    },
    {
      $addFields: {
        loggedInUser: '$appSettings.user'
      }
    },
    {
      $addFields: {
        isReporting: '$trackingData.isReporting'
      }
    }
  ];

  params.project = {
    code: 1,
    attributes: 1,
    name: 1,
    isLoggedIn: {
      $cond: [
        {
          $or: [
            {
              $eq: ['$associatedUser.value', '']
            },
            {
              $eq: [
                {
                  $type: '$associatedUser.value'
                },
                'missing'
              ]
            }
          ]
        },
        'No',
        'Yes'
      ]
    },
    hasLinkedChannel: {
      $cond: [
        {
          $eq: ['$channelId.value', '']
        },
        'No',
        'Yes'
      ]
    },
    channelId: '$channelId',
    associatedUser: '$associatedUser.value',
    isActive: {
      $cond: [
        {
          $eq: ['$status', 1]
        },
        'Yes',
        'No'
      ]
    },
    isReporting: {
      $cond: [
        {
          $eq: ['$isReporting', 1]
        },
        'Yes',
        'No'
      ]
    },
    gpsStatus: {
      $cond: [
        {
          $or: [
            {
              $eq: ['$gps.value', '0']
            },
            {
              $eq: ['$gps.value', '']
            }
          ]
        },
        'Off',
        'On'
      ]
    },
    btStatus: {
      $cond: [
        {
          $or: [
            {
              $eq: ['$bluetooth.value', '0']
            },
            {
              $eq: ['$bluetooth.value', '']
            }
          ]
        },
        'Off',
        'On'
      ]
    },
    beaconServiceStatus: {
      $cond: [
        {
          $eq: ['$appSettings.beaconServiceStatus', false]
        },
        'Off',
        'On'
      ]
    },
    lastTracked: '$trackingData.lastTracked'
  };

  params.match = {};

  if (event.queryStringParameters && event.queryStringParameters.filter) {
    // filters._all = event.queryStringParameters.filter;
    params.match.$or = [
      {
        name: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'attributes.value': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        code: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        isLoggedIn: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        isActive: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        isReporting: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        gpsStatus: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        btStatus: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        beaconServiceStatus: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        associatedUser: new RegExp(event.queryStringParameters.filter, 'i')
      }
    ];
  }
  const onOffValues = ['Off', 'On'];
  const yesNoValues = ['No', 'Yes'];
  if (event.queryStringParameters.devicename) {
    params.match.name = new RegExp(event.queryStringParameters.devicename, 'i');
  }

  if (event.queryStringParameters.devicecode) {
    params.match.code = new RegExp(event.queryStringParameters.devicecode, 'i');
  }

  if (event.queryStringParameters.user) {
    params.match.associatedUser = new RegExp(event.queryStringParameters.associatedUser, 'i');
  }

  if (onOffValues[parseInt(event.queryStringParameters.gpsStatus, 10)]) {
    params.match.gpsStatus = onOffValues[parseInt(event.queryStringParameters.gpsStatus, 10)];
  }

  if (onOffValues[parseInt(event.queryStringParameters.btStatus, 10)]) {
    params.match.btStatus = onOffValues[parseInt(event.queryStringParameters.btStatus, 10)];
  }

  if (onOffValues[parseInt(event.queryStringParameters.beaconServiceStatus, 10)]) {
    params.match.beaconServiceStatus =
      onOffValues[parseInt(event.queryStringParameters.beaconServiceStatus, 10)];
  }

  if (yesNoValues[parseInt(event.queryStringParameters.isLoggedIn, 10)]) {
    params.match.isLoggedIn = yesNoValues[parseInt(event.queryStringParameters.isLoggedIn, 10)];
  }

  if (yesNoValues[parseInt(event.queryStringParameters.isReporting, 10)]) {
    params.match.isReporting = yesNoValues[parseInt(event.queryStringParameters.isReporting, 10)];
  }

  if (yesNoValues[parseInt(event.queryStringParameters.isActive, 10)]) {
    params.match.isActive = yesNoValues[parseInt(event.queryStringParameters.isActive, 10)];
  }

  if (event.queryStringParameters.lastTrackedFrom || event.queryStringParameters.lastTrackedTo) {
    params.match.lastTracked = {};
  }

  if (event.queryStringParameters.lastTrackedFrom) {
    params.match.lastTracked.$gte = new Date(event.queryStringParameters.lastTrackedFrom);
  }

  if (event.queryStringParameters.lastTrackedTo) {
    params.match.lastTracked.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.lastTrackedTo)
    );
  }

  params.match.$and = [];

  if (event.queryStringParameters.manufacturer) {
    params.match.$and.push({
      attributes: {
        $elemMatch: {
          name: 'manufacturer',
          value: new RegExp(event.queryStringParameters.manufacturer, 'i')
        }
      }
    });
  }

  if (event.queryStringParameters.os) {
    params.match.$and.push({
      attributes: {
        $elemMatch: {
          name: 'os',
          value: new RegExp(event.queryStringParameters.os, 'i')
        }
      }
    });
  }
  if (event.queryStringParameters.appName) {
    params.match.$and.push({
      attributes: {
        $elemMatch: {
          name: 'appName',
          value: new RegExp(event.queryStringParameters.appName, 'i')
        }
      }
    });
  }
  params.match.$and.length > 0 ? '' : delete params.match.$and;
  params.limit = event.queryStringParameters.limit
    ? parseInt(event.queryStringParameters.limit, 10)
    : 20;
  params.skip = event.queryStringParameters.offset
    ? parseInt(event.queryStringParameters.offset, 10)
    : 0;

  const sorting = this.extractSortOptions(event, 'appStatus');
  // // console.log(sorting.length);

  params.sort = {};

  if (!Object.keys(sorting).length) {
    params.sort.lastTracked = -1;
  } else {
    params.sort = sorting;
  }
  const util = require('util');
  // console.log(util.inspect(params.match, false, null));

  if (widgetName) {
    return this.appStatusWidget(params, widgetName);
  }

  return bluebirdPromise.all([this.appStatusData(params), this.appStatusCount(params)]).then(
    result =>
      // // console.log(result);
      result
  );
};

reportService.prototype.appStatusWidget = function(params, widgetName) {
  switch (widgetName) {
    case 'app_status':
      return thingsmodel
        .aggregate([
          ...params.preParams,
          {
            $project: params.project
          },
          {
            $match: params.match
          }
        ])
        .collation({
          locale: 'en_US',
          caseLevel: false
        })
        .exec()
        .then(data => {
          // console.log(data);
          const result = {
            Inactive: 0,
            Reporting: 0,
            'Not Reporting': 0
          };

          for (let i = 0; i < data.length; i += 1) {
            const elem = data[i];
            if (elem.isActive === 'No') {
              result.Inactive += 1;
            } else if (elem.isReporting === 'Yes') {
              result.Reporting += 1;
            } else if (elem.isReporting === 'No') {
              result['Not Reporting'] += 1;
            }
          }

          // console.log(result);
          const resultArr = [
            {
              label: 'Inactive',
              value: result.Inactive
            },
            {
              label: 'Reporting',
              value: result.Reporting
            },
            {
              label: 'Not Reporting',
              value: result['Not Reporting']
            }
          ];

          return resultArr;
        });

    default:
      return bluebirdPromise.reject();
  }
};
/**
 *
 */
reportService.prototype.appStatusData = function(params) {
  return thingsmodel
    .aggregate([
      ...params.preParams,
      {
        $project: params.project
      },
      {
        $match: params.match
      },
      {
        $sort: params.sort
      },
      {
        $skip: params.skip
      },
      {
        $limit: params.limit
      }
    ])
    .collation({
      locale: 'en_US',
      caseLevel: false
    })
    .exec()
    .then(result => {
      const list = [];
      if (result) {
        for (const i in result) {
          if (result.hasOwnProperty(i)) {
            list.push(this.formatReportData(result[i], 'appStatus'));
          }
        }
      }
      // // console.log(list);
      return list;
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

/**
 *
 */
reportService.prototype.appStatusCount = function(params) {
  return thingsmodel
    .aggregate([
      ...params.preParams,
      {
        $project: params.project
      },
      {
        $match: params.match
      },
      {
        $count: 'count'
      }
    ])
    .collation({
      locale: 'en',
      caseLevel: false
    })
    .exec()
    .then(result => {
      if (result[0].count) {
        return result[0].count;
      }
      return 0;
    })
    .then(result => {
      if (result === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

/**
 * 
 */
reportService.prototype.productsReadyToDispatch = function(event) {
  const params = {};

  params.preParams = [
    {
      $match: clientHandler.addClientFilterToConditions({
        shipmentStatus: 20
      })
    },
    {
      $unwind: '$products'
    },
    {
      $lookup: {
        from: 'products',
        localField: 'products.id',
        foreignField: '_id',
        as: 'product'
      }
    },
    {
      $unwind: '$product'
    },
    {
      $lookup: {
        from: 'orders',
        localField: 'products.orderDetails.id',
        foreignField: '_id',
        as: 'order'
      }
    },
    {
      $unwind: '$order'
    },
    {
      $addFields: {
        toAddress: {
          $filter: {
            input: '$addresses',
            as: 'address',
            cond: {
              $eq: ['$$address.addressType', 'shipToAddress']
            }
          }
        }
      }
    },
    {
      $unwind: '$toAddress'
    }
  ];

  params.project = {
    shipmentcode: '$code',
    _id: 0,
    shipmentId: '$_id',
    orderId: '$order._id',
    productId: '$product._id',
    scheduledPickupDate: 1,
    scheduledDeliveryDate: '$etd',
    carrierUser: 1,
    carrier: {
      $concat: ['$carrierUser.firstName', ' ', '$carrierUser.lastName']
    },
    toAddress: '$toAddress.location',
    ordercode: '$order.code',
    orderStatus: '$order.orderStatus',
    surgeryDate: '$order.etd',
    product: '$product.name',
    categories: '$product.categories',
    shipmentStatus: 1
  };
  params.match = {};

  if (event.queryStringParameters && event.queryStringParameters.filter) {
    // filters._all = event.queryStringParameters.filter;
    params.match.$or = [
      {
        shipmentcode: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        carrier: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'toAddress.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        ordercode: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        product: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'categories.name': new RegExp(event.queryStringParameters.filter, 'i')
      }
    ];

    if (orderStatusLabelMap[event.queryStringParameters.filter]) {
      params.match.$or = [
        ...params.match.$or,
        {
          orderStatus: orderStatusLabelMap[event.queryStringParameters.filter]
        }
      ];
    }
  }
  params.match.$and = [];
  if (event.queryStringParameters.product) {
    params.match.$and.push({
      product: new RegExp(event.queryStringParameters.product, 'i')
    });
  }
  if (event.queryStringParameters.shipmentcode) {
    params.match.$and.push({
      shipmentcode: new RegExp(event.queryStringParameters.shipmentcode, 'i')
    });
  }
  if (event.queryStringParameters.ordercode) {
    params.match.$and.push({
      ordercode: new RegExp(event.queryStringParameters.ordercode, 'i')
    });
  }
  if (event.queryStringParameters.category) {
    params.match.$and.push({
      'categories.name': new RegExp(event.queryStringParameters.category, 'i')
    });
  }
  if (event.queryStringParameters.shipToAddress) {
    params.match.$and.push({
      'toAddress.name': new RegExp(event.queryStringParameters.shipToAddress, 'i')
    });
  }
  if (event.queryStringParameters.orderStatus) {
    params.match.$and.push({
      orderStatus: parseInt(event.queryStringParameters.orderStatus, 10)
    });
  }

  if (event.queryStringParameters.shipmentStatus) {
    params.match.$and.push({
      shipmentStatus: parseInt(event.queryStringParameters.shipmentStatus, 10)
    });
  }

  if (event.queryStringParameters.carrier) {
    params.match.$and.push({
      'carrierUser.uuid': event.queryStringParameters.carrier
    });
  }

  if (event.queryStringParameters.surgeryDateFrom || event.queryStringParameters.surgeryDateTo) {
    params.match.surgeryDate = {};
  }

  if (event.queryStringParameters.surgeryDateFrom) {
    params.match.surgeryDate.$gte = new Date(event.queryStringParameters.surgeryDateFrom);
  }

  if (event.queryStringParameters.surgeryDateTo) {
    params.match.surgeryDate.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.surgeryDateTo)
    );
  }

  if (
    event.queryStringParameters.scheduledPickupDateFrom ||
    event.queryStringParameters.scheduledPickupDateTo
  ) {
    params.match.scheduledPickupDate = {};
  }

  if (event.queryStringParameters.scheduledPickupDateFrom) {
    params.match.scheduledPickupDate.$gte = new Date(
      event.queryStringParameters.scheduledPickupDateFrom
    );
  }

  if (event.queryStringParameters.scheduledPickupDateTo) {
    params.match.scheduledPickupDate.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.scheduledPickupDateTo)
    );
  }

  if (
    event.queryStringParameters.scheduledDeliveryDateFrom ||
    event.queryStringParameters.scheduledDeliveryDateTo
  ) {
    params.match.scheduledDeliveryDate = {};
  }

  if (event.queryStringParameters.scheduledDeliveryDateFrom) {
    params.match.scheduledDeliveryDate.$gte = new Date(
      event.queryStringParameters.scheduledDeliveryDateFrom
    );
  }

  if (event.queryStringParameters.scheduledDeliveryDateTo) {
    params.match.scheduledDeliveryDate.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.scheduledDeliveryDateTo)
    );
  }
  params.match.$and.length > 0 ? '' : delete params.match.$and;
  params.limit = event.queryStringParameters.limit
    ? parseInt(event.queryStringParameters.limit, 10)
    : 20;
  params.skip = event.queryStringParameters.offset
    ? parseInt(event.queryStringParameters.offset, 10)
    : 0;

  const sorting = this.extractSortOptions(event, 'productsReadyToDispatch');
  // // console.log(sorting.length);

  params.sort = {};

  if (!Object.keys(sorting).length) {
    params.sort.product = 1;
  } else {
    params.sort = sorting;
  }
  // const util = require('util');
  // // console.log(util.inspect(params, false, null));

  return bluebirdPromise
    .all([this.productsReadyToDispatchData(params), this.productsReadyToDispatchCount(params)])
    .then(
      result =>
        // // console.log(result);
        result
    );
};

/**
 *
 */
reportService.prototype.productsReadyToDispatchData = function(params) {
  const aggParams = params.preParams;
  return shipmentmodel
    .aggregate([
      ...aggParams,
      {
        $project: params.project
      },
      {
        $match: params.match
      },
      {
        $sort: params.sort
      },
      {
        $skip: params.skip
      },
      {
        $limit: params.limit
      }
    ])
    .collation({
      locale: 'en_US',
      caseLevel: false
    })
    .exec()
    .then(result => {
      let list = [];
      if (result) {
        list = result.map(x => this.formatReportData(x, 'productsReadyToDispatch'));
      }
      // // console.log(list);
      return list;
    })
    .then(result => {
      if (result.length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

/**
 *
 */
reportService.prototype.productsReadyToDispatchCount = function(params) {
  const aggParams = params.preParams;

  return shipmentmodel
    .aggregate([
      ...aggParams,
      {
        $project: params.project
      },
      {
        $match: params.match
      },
      {
        $count: 'count'
      }
    ])
    .collation({
      locale: 'en',
      caseLevel: false
    })
    .exec()
    .then(result => {
      // // console.log(result);
      // return 100;
      if (result[0].count) {
        return result[0].count;
      }
      return 0;
    })
    .then(result => {
      if (result === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    });
};

/**
 * 
 */
reportService.prototype.productThingMapping = function(event) {
  const params = {};

  params.project = {
    code: 1,
    name: 1,
    things: 1,
    client: 1,
    lastThingsChangeOn: 1
  };

  params.match = {};

  if (event.queryStringParameters && event.queryStringParameters.filter) {
    // filters._all = event.queryStringParameters.filter;
    params.match.$or = [
      {
        name: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        code: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'things.name': new RegExp(event.queryStringParameters.filter, 'i')
      }
    ];
  }

  if (event.queryStringParameters.code) {
    params.match.code = new RegExp(event.queryStringParameters.code, 'i');
  }

  if (mongoose.Types.ObjectId.isValid(event.queryStringParameters.product)) {
    params.match._id = mongoose.Types.ObjectId(event.queryStringParameters.product);
  }

  if (event.queryStringParameters.things && event.queryStringParameters.things.split(',').length) {
    const thingFilterIdArray = [];
    for (const id of event.queryStringParameters.things.split(',')) {
      if (mongoose.Types.ObjectId.isValid(id.trim())) {
        thingFilterIdArray.push(mongoose.Types.ObjectId(id.trim()));
      }
    }
    params.match['things.id'] = {
      $in: thingFilterIdArray
    };
  }

  if (
    event.queryStringParameters.lastThingsChangeOnFrom ||
    event.queryStringParameters.lastThingsChangeOnTo
  ) {
    params.match.lastThingsChangeOn = {};
  }

  if (event.queryStringParameters.lastThingsChangeOnFrom) {
    params.match.lastThingsChangeOn.$gte = new Date(
      event.queryStringParameters.lastThingsChangeOnFrom
    );
  }

  if (event.queryStringParameters.lastThingsChangeOnTo) {
    params.match.lastThingsChangeOn.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.lastThingsChangeOnTo)
    );
  }

  params.match = clientHandler.addClientFilterToConditions(params.match);

  params.limit = event.queryStringParameters.limit
    ? parseInt(event.queryStringParameters.limit, 10)
    : 20;
  params.skip = event.queryStringParameters.offset
    ? parseInt(event.queryStringParameters.offset, 10)
    : 0;

  const sorting = this.extractSortOptions(event, 'productThingMapping');
  params.sort = {};

  if (!Object.keys(sorting).length) {
    params.sort.lastThingsChangeOn = 1;
  } else {
    params.sort = sorting;
  }

  return bluebirdPromise.all([
    this.extractData(params, productModel, 'productThingMapping'),
    this.extractCount(params, productModel)
  ]);
};

/**
 * 
 */
reportService.prototype.productThingMappingHistory = function(event) {
  const params = {};

  params.project = {
    product: 1,
    thing: '$thing.name',
    associatedOn: 1,
    client: 1,
    disassociatedOn: 1,
    currentlyAssociated: {
      $cond: [
        {
          $eq: ['$disassociatedOn', null]
        },
        'Yes',
        'No'
      ]
    }
  };

  params.match = {
    'product.id': mongoose.Types.ObjectId(event.pathParameters.id)
  };

  if (event.queryStringParameters && event.queryStringParameters.filter) {
    // filters._all = event.queryStringParameters.filter;
    params.match.$or = [
      {
        thing: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        currentlyAssociated: new RegExp(event.queryStringParameters.filter, 'i')
      }
    ];
  }

  const yesNoValues = ['No', 'Yes'];
  if (event.queryStringParameters.thing) {
    params.match.thing = new RegExp(event.queryStringParameters.thing, 'i');
  }

  if (yesNoValues[parseInt(event.queryStringParameters.currentlyAssociated, 10)]) {
    params.match.currentlyAssociated =
      yesNoValues[parseInt(event.queryStringParameters.currentlyAssociated, 10)];
  }

  if (event.queryStringParameters.associatedOnFrom || event.queryStringParameters.associatedOnTo) {
    params.match.associatedOn = {};
  }

  if (event.queryStringParameters.associatedOnFrom) {
    params.match.associatedOn.$gte = new Date(event.queryStringParameters.associatedOnFrom);
  }

  if (event.queryStringParameters.associatedOnTo) {
    params.match.associatedOn.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.associatedOnTo)
    );
  }

  if (
    event.queryStringParameters.disassociatedOnFrom ||
    event.queryStringParameters.disassociatedOnTo
  ) {
    params.match.associatedOn = {};
  }

  if (event.queryStringParameters.disassociatedOnFrom) {
    params.match.associatedOn.$gte = new Date(event.queryStringParameters.disassociatedOnFrom);
  }

  if (event.queryStringParameters.disassociatedOnTo) {
    params.match.associatedOn.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.disassociatedOnTo)
    );
  }

  params.match = clientHandler.addClientFilterToConditions(params.match);

  params.limit = event.queryStringParameters.limit
    ? parseInt(event.queryStringParameters.limit, 10)
    : 20;
  params.skip = event.queryStringParameters.offset
    ? parseInt(event.queryStringParameters.offset, 10)
    : 0;

  const sorting = this.extractSortOptions(event, 'productThingMappingHistory');

  // // console.log(sorting.length);

  params.sort = {};

  if (!Object.keys(sorting).length) {
    // params.sort.addresses = {};
    // params.sort.addresses.location = {};
    params.sort = {
      disassociatedOn: -1,
      associatedOn: -1
    };
  } else {
    params.sort = sorting;
  }

  // const util = require('util');
  // // console.log(util.inspect(params, false, null));

  return bluebirdPromise
    .all([
      // this.ordersPerHospitalData(params),
      this.extractData(
        params,
        require('../models/productThingAssignment'),
        'productThingMappingHistory'
      ),
      this.extractCount(params, require('../models/productThingAssignment'))
      // this.ordersPerHospitalCount(params)
    ])
    .then(
      result =>
        // // console.log(result);
        result
    );
};



/**
 * 
 */
reportService.prototype.loginHistory = function(event, widgetName) {
  const params = {};

  params.project = {
    user: 1,
    device: 1,
    sensor: 1,
    loginTime: 1,
    logoutTime: 1
  };

  params.match = {};

  if (event.queryStringParameters && event.queryStringParameters.filter) {
    // filters._all = event.queryStringParameters.filter;
    params.match.$or = [
      {
        'user.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'device.code': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'device.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'device.appName': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'sensors.name': new RegExp(event.queryStringParameters.filter, 'i')
      }
    ];
  }

  if (event.queryStringParameters.user) {
    params.match['user.id'] = mongoose.Types.ObjectId(event.queryStringParameters.user);
  }
  
  if (event.queryStringParameters.device) {
    params.match.$or = [
      {
        'device.code': new RegExp(event.queryStringParameters.device, 'i')
      },
      {
        'device.name': new RegExp(event.queryStringParameters.device, 'i')
      }
    ]
  }

  if (event.queryStringParameters.loginTimeFrom || event.queryStringParameters.loginTimeTo) {
    params.match.loginTime = {};
  }

  if (event.queryStringParameters.loginTimeFrom) {
    params.match.loginTime.$gte = new Date(event.queryStringParameters.loginTimeFrom);
  }

  if (event.queryStringParameters.loginTimeTo) {
    params.match.loginTime.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.loginTimeTo)
    );
  }
  
  if (event.queryStringParameters.logoutTimeFrom || event.queryStringParameters.logoutTimeTo) {
    params.match.logoutTime = {};
  }

  if (event.queryStringParameters.logoutTimeFrom) {
    params.match.logoutTime.$gte = new Date(event.queryStringParameters.logoutTimeFrom);
  }

  if (event.queryStringParameters.logoutTimeTo) {
    params.match.logoutTime.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.logoutTimeTo)
    );
  }
  // console.log(JSON.stringify(params.match));
  // params.match = clientHandler.addClientFilterToConditions(params.match);

  params.limit = event.queryStringParameters.limit
    ? parseInt(event.queryStringParameters.limit, 10)
    : 20;
  params.skip = event.queryStringParameters.offset
    ? parseInt(event.queryStringParameters.offset, 10)
    : 0;

  const sorting = this.extractSortOptions(event, 'loginHistory');

  // console.log(sorting.length);

  params.sort = {};

  if (!Object.keys(sorting).length) {
    // params.sort.addresses = {};
    // params.sort.addresses.location = {};
    params.sort = {
      '_id': -1
    };
  } else {
    params.sort = sorting;
  }
  
  return bluebirdPromise
    .all([
      this.extractData(params, loginHistoryModel, 'loginHistory'),
      this.extractCount(params, loginHistoryModel)
    ])
    .then(
      result =>
        result
    );
};
//----------------

module.exports = new reportService();
