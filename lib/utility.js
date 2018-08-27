const validator = require('../lib/validatorAsync');
const currentUserHandler = require('../lib/currentUserHandler');
// let jsTypeChecker = require('javascript-type-checker');
class AkUtility {
  mapAndGetValidationErrors(validationResults, mapper) {
    validationResults = validationResults.map(resultElem =>
      resultElem.filter(element => !element.status)
    );

    for (const i in mapper) {
      if (mapper.hasOwnProperty(i)) {
        mapper[i] = validationResults[mapper[i].index].map(elem =>
          validator.getErrorObject(elem.validatorErrors, mapper[i].fieldName, i)
        )[0];
      }
    }
    for (const i in mapper) {
      if (mapper.hasOwnProperty(i)) {
        if (mapper[i] === undefined) {
          delete mapper[i];
        }
      }
    }

    return mapper;
  }

  getObjectValues(obj) {
    const values = [];
    for (const i in obj) {
      if (obj.hasOwnProperty(i)) {
        values.push(obj[i]);
      }
    }

    return values;
  }

  getArrayDifference(array1, array2) {
    const a = new Set(array1);
    const b = new Set(array2);
    return [...new Set([...a].filter(x => !b.has(x)))];
  }

  getChangedValueKeys(object1, object2) {
    const obj1keys = Object.getOwnPropertyNames(object1);
    const obj2keys = Object.getOwnPropertyNames(object2);

    const changedKeys = obj1keys.reduce((result, key) => {
      if (object1[key] !== object2[key]) {
        result.push(key);
      }
    }, []);
  }

  /**
 * Get common elements of 2 arrays
 * 
 * @param {Array} array1 First array
 * @param {Array} array2 Second array
 * @return {Array} Array of common elements
 */
  getArrayIntersection(array1, array2) {
    const a = new Set(array1);
    const b = new Set(array2);
    return [...a].filter(v => b.has(v));
  }

  compareArraysForEquality(array1, array2) {
    if (array1.length !== array2.length) {
      return false;
    }

    const arr1Set = new Set(...array1);
    const arr2Set = new Set(...array2);

    return [...arr1Set].reduce((result, element) => result && arr2Set.has(element), true);
  }

  sortErrorsObject(errorsObj, key) {
    const sortedErrorsObj = {};
    const errorFieldPriority = require('../models/errorFieldPriority.json')[key];
    if (!errorFieldPriority) {
      return errorsObj;
    }
    let fields = Object.getOwnPropertyNames(errorsObj);
    fields = fields.sort((a, b) => errorFieldPriority[a] - errorFieldPriority[b]);
    for (let i = 0; i < fields.length; i++) {
      sortedErrorsObj[fields[i]] = errorsObj[fields[i]];
    }

    return sortedErrorsObj;
  }

  convertDateToTimezone({ dateToConvert, timeZone, formatType, format, defaultValue }) {
    if (defaultValue === null || defaultValue === undefined) {
      defaultValue = 'NA';
    }
    try {
      if (!dateToConvert) {
        throw new Error('no - date');
      }

      if (!timeZone) {
        timeZone = 'UTC';
      }
      const moment = require('moment-timezone');
      dateToConvert = new Date(dateToConvert);
      if (!moment.isDate(dateToConvert)) {
        throw new Error('invalid - date');
      }
      const convertedDate = moment(dateToConvert).tz(timeZone);

      if (format) {
        return convertedDate.format(format);
      }
      switch (formatType) {
        case 'd':
          return convertedDate.format("DD MMM'YY");
        case 'dt':
          return convertedDate.format("DD MMM'YY HH:mm");
        case 'dts':
          return convertedDate.format("DD MMM'YY HH:mm:ss");
        case 'dtz':
          return convertedDate.format("DD MMM'YY HH:mm (z)");
        case 'ta':
          return convertedDate.format('hh:mm A');
        default:
          return convertedDate.format();
      }
    } catch (e) {
      return defaultValue;
    }
  }

  objectKeyByValue(obj, value) {
    return Object.keys(obj).filter(key => obj[key] === value)[0] || '';
  }

  // format empty string for mobile
  emptyValue(val) {
    if (!val.trim()) {
      return 'NA';
    }
    return val.trim();
  }

  isFutureDate(dateToCheck, format, timezone) {
    const moment = require('moment-timezone');
    const defaultTimezone = currentUserHandler.getCurrentUser().timezone;
    const defaultFormat = 'YYYY-MM-DD';
    const providedDateUTC = moment
      .tz(dateToCheck, format || defaultFormat, timezone || defaultTimezone)
      .utc()
      .format();
    return moment(providedDateUTC).isAfter(
      moment
        .tz(moment().format(format || defaultFormat), timezone || defaultTimezone)
        .utc()
        .format(),
      'day'
    );
  }

  addDaysToDate(dateToAddTo, daysToAdd, format, timezone) {
    // timezone = "Asia/Kolkata";
    const moment = require('moment-timezone');
    const defaultTimezone = currentUserHandler.getCurrentUser().timezone;
    const defaultFormat = 'YYYY-MM-DD';
    if (format === 'iso') {
      format = 'YYYY-MM-DDTHH:mm:ss.SSS[Z]';
    }
    const providedDateUTC = moment
      .tz(dateToAddTo, format || defaultFormat, timezone || defaultTimezone)
      .utc()
      .format();
    return moment(providedDateUTC)
      .add(daysToAdd, 'd')
      .utc()
      .toDate();
  }

  subtractDaysFromDate(dateToProcess, daysToSubtract, format, timezone) {
    // timezone = "Asia/Kolkata";
    const moment = require('moment-timezone');
    const defaultTimezone = currentUserHandler.getCurrentUser().timezone;
    const defaultFormat = 'YYYY-MM-DD';
    if (format === 'iso') {
      format = 'YYYY-MM-DDTHH:mm:ss.SSS[Z]';
    }
    const providedDateUTC = moment
      .tz(dateToProcess, format || defaultFormat, timezone || defaultTimezone)
      .utc()
      .format();
    return moment(providedDateUTC)
      .subtract(daysToSubtract, 'd')
      .utc()
      .toDate();
  }

  cleanFormatResponse(object) {
    // timezone = "Asia/Kolkata";
    object = JSON.parse(JSON.stringify(object));
    if (typeof object === 'string') {
      if (object.trim() === '') {
        return 'NA';
      }
      return object.trim();
    } else if (typeof object === 'object') {
      for (const key in object) {
        object[key] = this.cleanFormatResponse(object[key]);
      }
    }
    return object;
  }

  cleanFormatReportResponse(object) {
    object = JSON.parse(JSON.stringify(object));
    if (typeof object === 'string') {
      if (object.trim() === '') {
        return '';
      }
      return object.trim();
    } else if (object === null) {
      return '';
    } else if (typeof object === 'object') {
      for (const key in object) {
        object[key] = this.cleanFormatReportResponse(object[key]);
      }
    }
    return object;
  }

  getOrderStatus(status) {
    const statusLabel = require('../mappings/orderStatusLabel.json');
    const statusMap = require('../mappings/orderStatus.json');
    if (!status) {
      return 0;
    }
    if (statusLabel[status]) {
      return parseInt(statusLabel[status], 10);
    } else if (statusMap[status]) {
      return parseInt(statusMap[status], 10);
    }
    return parseInt(status, 10);
  }

  getPolicyFromRoleName(roleName) {
    const r = `${roleName}`.split('-');
    r[0] = 'policy';
    return r.join('-').toLowerCase();
  }

  getShipmentStatus(status) {
    const statusLabel = require('../mappings/shipmentStatusLabel.json');
    const statusMap = require('../mappings/shipmentStatus.json');
    if (!status) {
      return 0;
    }
    if (statusLabel[status]) {
      return parseInt(statusLabel[status], 10);
    } else if (statusMap[status]) {
      return parseInt(statusMap[status], 10);
    }
    return parseInt(status, 10);
  }

  formatToDateFilter(date) {
    // timezone = "Asia/Kolkata";
    const moment = require('moment-timezone');
    return moment(date)
      .add(59, 's')
      .utc()
      .toDate();
  }

  subtractSecondsFromDate(date, secondsToRemove) {
    const moment = require('moment-timezone');
    return moment(date)
      .subtract(secondsToRemove, 's')
      .utc()
      .toDate();
  }

  log(data, tag = '', options = {}) {
    if (process.env.logLevel === 'All') {
      // console.log(`${tag || ''}`);
      // console.log(data);
    } else if (process.env.logLevel === 'Error' && data instanceof Error) {
      // console.log(`${tag || ''}`);
      // console.log(data);
    }
  }

  convertToMilliseconds(valueToConvert, fromUnit) {
    valueToConvert = Number(valueToConvert);
    switch (fromUnit) {
      case 'seconds':
        return valueToConvert * 1000;
      case 'minutes':
        return valueToConvert * 1000 * 60;
      case 'hours':
        return valueToConvert * 1000 * 60 * 60;
      case 'days':
        return valueToConvert * 1000 * 60 * 60 * 24;
      case 'weeks':
        return valueToConvert * 1000 * 60 * 60 * 24 * 7;
      default:
        return valueToConvert;
    }
  }

  convertFromMilliseconds(valueToConvert, toUnit) {
    valueToConvert = Number(valueToConvert);
    switch (toUnit) {
      case 'seconds':
        return valueToConvert / 1000;
      case 'minutes':
        return valueToConvert / 1000 / 60;
      case 'hours':
        return valueToConvert / 1000 / 60 / 60;
      case 'days':
        return valueToConvert / 1000 / 60 / 60 / 24;
      case 'weeks':
        return valueToConvert / 1000 / 60 / 60 / 24 / 7;
      default:
        return valueToConvert;
    }
  }

  getMongoSysAttrsToObjQuery(attrFieldName) {
    attrFieldName = attrFieldName || 'attributes';
    return [
      {
        $addFields: {
          sysAttributes: {
            $filter: {
              input: `$${attrFieldName}`,
              as: 'attribute',
              cond: {
                $eq: ['$$attribute.sysDefined', 1]
              }
            }
          }
        }
      },
      {
        $addFields: {
          sysAttributes: {
            $map: {
              input: `$sysAttributes`,
              as: 'attribute',
              in: {
                k: '$$attribute.name',
                v: '$$attribute.value'
              }
            }
          }
        }
      },
      {
        $addFields: {
          sysAttributes: {
            $arrayToObject: '$sysAttributes'
          }
        }
      }
    ];
  }

  getEndOf(date, unit) {
    const moment = require('moment-timezone');
    return moment(date)
      .endOf(unit)
      .toDate();
  }

  isoDateToMilliseconds(isoDate) {
    if (!isoDate) {
      return null;
    }

    return new Date(isoDate).getTime();
  }

  getDeviceBeaconCode(deviceCode) {
    return `DB-${deviceCode || ''}`;
  }

  getRoleFromGroupName(groupName) {
    return `role-${process.env.projectName}-${groupName}`.toLowerCase();
  }
}

module.exports = new AkUtility();
