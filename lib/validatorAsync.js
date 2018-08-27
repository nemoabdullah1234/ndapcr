const jsTypeChecker = require('javascript-type-checker');
const clientHandler = require('../lib/clientHandler');
const bluebirdPromise = require('bluebird');
const mongoose = require('mongoose');

class Validator {
  /**
   * Creates an instance of Validator.
   * @memberof Validator
   */
  constructor() {
    this.required.bind(this);
    this.type.bind(this);
    this.range.bind(this);
    this.regex.bind(this);
    this.stringLength.bind(this);
    this.urlRegex =
      'https?://(?:www.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9].[^s]{2,}|www.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9].[^s]{2,}|https?://(?:www.|(?!www))[a-zA-Z0-9].[^s]{2,}|www.[a-zA-Z0-9].[^s]{2,}';
    this.CODE_MAX_LENGTH = 50;
    this.NAME_MAX_LENGTH = 50;
  }
  setClient(clientObj) {
    this.client = clientObj;
  }

  required(data, options = {}) {
    let result;
    if (data) {
      result = {
        status: true,
        validatorErrors: {}
      };
      if (Array.isArray(data) && data.length === 0) {
        result = {
          status: false,
          validatorErrors: {
            eCode: 'ak-required',
            data,
            multiple: !!options.multiple
          }
        };
      }
    } else {
      result = {
        status: false,
        validatorErrors: {
          eCode: 'ak-required',
          data,
          multiple: !!options.multiple
        }
      };
    }
    return bluebirdPromise.resolve(result);
  }
  requiredKeyinObject(data, key) {
    let result;
    if (!data) {
      result = {
        status: true,
        validatorErrors: {}
      };
    } else {
      if (!Array.isArray(data)) {
        data = [data];
      }
      result = {
        status: true,
        validatorErrors: {}
      };

      data.forEach(d => {
        if (typeof d[key] === 'undefined') {
          result = {
            status: false,
            validatorErrors: {
              eCode: 'ak-requiredKey',
              data,
              key
            }
          };
        }
      });
    }
    return bluebirdPromise.resolve(result);
  }

  requiredIfDependencyProvided(data, dependentData, dependentDataLabel) {
    let result;
    if (data) {
      result = {
        status: true,
        validatorErrors: {}
      };
    } else if (!dependentData) {
      result = {
        status: true,
        validatorErrors: {}
      };
    } else {
      result = {
        status: false,
        validatorErrors: {
          eCode: 'ak-requiredIfDependencyProvided',
          dependentData,
          dependentDataLabel
        }
      };
    }

    return bluebirdPromise.resolve(result);
  }

  type(requiredType = '', data = '') {
    if (!data) {
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    }
    let result;

    if (jsTypeChecker.getType(data) === requiredType) {
      result = {
        status: true,
        validatorErrors: {}
      };
    } else {
      result = {
        status: false,
        validatorErrors: {
          eCode: 'ak-type',
          data,
          requiredType
        }
      };
    }
    return bluebirdPromise.resolve(result);
  }

  regex(regex = '', dataString = '') {
    if (!dataString) {
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    }
    if (!jsTypeChecker.isString(dataString)) {
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    }
    let result;
    const regexp = new RegExp(regex);

    if (!jsTypeChecker.isString(regex)) {
      throw new Error('regex must be a string');
    } else if (regexp.test(dataString)) {
      result = {
        status: true,
        validatorErrors: {}
      };
    } else {
      result = {
        status: false,
        validatorErrors: {
          eCode: 'ak-regex',
          regex,
          data: dataString
        }
      };
    }
    return bluebirdPromise.resolve(result);
  }

  range(minValue = 0, maxValue = 0, data = 0) {
    if (!jsTypeChecker.isNumber(data)) {
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    }
    let result;

    if (!jsTypeChecker.isNumber(minValue)) {
      throw new Error('minValue must be a number');
    } else if (!jsTypeChecker.isNumber(maxValue)) {
      throw new Error('maxValue must be a number');
    } else if (minValue > maxValue) {
      throw new Error('minValue cannot be greater than maxValue');
    } else if (data >= minValue && data <= maxValue) {
      result = {
        status: true,
        validatorErrors: {}
      };
    } else {
      result = {
        status: false,
        validatorErrors: {
          eCode: 'ak-range',
          minValue,
          maxValue,
          data
        }
      };
    }
    return bluebirdPromise.resolve(result);
  }

  nonNegative(data = 0) {
    if (!jsTypeChecker.isNumber(data)) {
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    }
    let result;

    if (!jsTypeChecker.isNumber(data)) {
      throw new Error('data must be a number');
    } else if (data >= 0) {
      result = {
        status: true,
        validatorErrors: {}
      };
    } else {
      result = {
        status: false,
        validatorErrors: {
          eCode: 'ak-nonNegative',
          data
        }
      };
    }
    return bluebirdPromise.resolve(result);
  }

  valueAllowed(allowedValues, data, key = null) {
    if (typeof data === 'undefined') {
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    }
    let result;

    if (Array.isArray(data) && key) {
      data = data.map(item => item[key]);
    } else if (typeof data === typeof {} && key) {
      data = data[key];
    } else {
      data = [data];
    }
    if (new Set(allowedValues).isSuperset(new Set(data))) {
      result = {
        status: true,
        validatorErrors: {}
      };
    } else {
      result = {
        status: false,
        validatorErrors: {
          eCode: 'ak-valueAllowed',
          allowedValues,
          data
        }
      };
    }
    return bluebirdPromise.resolve(result);
  }

  requiredValues(requiredValues, data, key = null, options = {}) {
    if (!data) {
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    }
    let result;

    if (Array.isArray(data) && key) {
      data = data.map(item => item[key]);
    } else if (typeof data === typeof {} && key) {
      data = data[key];
    } else {
      data = [data];
    }
    if (new Set(data).isSuperset(new Set(requiredValues))) {
      result = {
        status: true,
        validatorErrors: {}
      };
    } else {
      result = {
        status: false,
        validatorErrors: {
          eCode: 'ak-requiredValues',
          allowedValues: requiredValues,
          data,
          multiple: !!options.multiple
        }
      };
    }
    return bluebirdPromise.resolve(result);
  }

  stringLength(minLength = 0, maxLength = 0, data = '') {
    if (!jsTypeChecker.isString(data)) {
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    }
    let result;
    if (!jsTypeChecker.isNumber(minLength)) {
      throw new Error('minLength must be a number');
    } else if (!jsTypeChecker.isNumber(maxLength)) {
      throw new Error('maxLength must be a number');
    } else if (minLength > maxLength) {
      throw new Error('minLength cannot be greater than maxLength');
    } else if (data.length >= minLength && data.length <= maxLength) {
      result = {
        status: true,
        validatorErrors: {}
      };
    } else {
      result = {
        status: false,
        validatorErrors: {
          eCode: 'ak-stringLength',
          minLength,
          maxLength,
          data
        }
      };
    }
    return bluebirdPromise.resolve(result);
  }

  duplicateArrayElements(nestedKey, data) {
    if (!data) {
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    }

    if (!jsTypeChecker.isArray(data)) {
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    }
    // remove duplicate objects
    data = Array.from(new Set((data || []).map(JSON.stringify))).map(JSON.parse);
    let result;
    let isDuplicate = false;
    if (nestedKey) {
      data = data.map(dataElem => {
        const nestedKeys = nestedKey.split('.');
        nestedKeys.forEach(element => {
          dataElem = dataElem[element];
        });
        return dataElem;
      });
    }
    isDuplicate = new Set(data).size !== data.length;
    if (!isDuplicate) {
      result = {
        status: true,
        validatorErrors: {}
      };
    } else {
      result = {
        status: false,
        validatorErrors: {
          eCode: 'ak-duplicateElem',
          nestedKey,
          data
        }
      };
    }
    return bluebirdPromise.resolve(result);
  }

  notDuplicate(key, field, data, excludedId, parentId) {
    if (!data) {
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    }
    let helper;
    if (key === 'attributes') {
      helper = require('../helpers/attribute');
    }
    if (key === 'categories') {
      helper = require('../helpers/category');
    }
    if (key === 'products') {
      helper = require('../helpers/product');
    }
    if (key === 'tags') {
      helper = require('../helpers/tags');
    }
    if (key === 'things') {
      helper = require('../helpers/things');
    }
    if (key === 'gateways') {
      helper = require('../helpers/gateways');
    }
    if (key === 'collections') {
      helper = require('../helpers/collection');
    }
    if (key === 'locations') {
      helper = require('../helpers/core/location');
    }
    if (key === 'floors') {
      helper = require('../helpers/core/floor');
    }
    if (key === 'zones') {
      helper = require('../helpers/core/zone');
    }
    if (key === 'orders') {
      helper = require('../helpers/order');
    }
    if (key === 'shipments') {
      helper = require('../helpers/shipment');
    }
    if (key === 'tempTags') {
      helper = require('../helpers/tempTags');
    }
    if (key === 'nfcTag') {
      helper = require('../helpers/nfcTag');
    }
    let result;
    return helper
      .isDuplicate(field, data, excludedId, parentId)
      .then(() => {
        result = {
          status: false,
          validatorErrors: {
            eCode: 'ak-duplicate',
            key,
            field,
            data,
            excludedId
          }
        };
        return result;
      })
      .catch(() => {
        result = {
          status: true,
          validatorErrors: {}
        };
        return result;
      });
  }

  elementExists(key, id) {
    if (!id) {
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    }
    let helper;
    if (key === 'attributes') {
      helper = require('../helpers/attribute');
    }
    if (key === 'categories') {
      helper = require('../helpers/category');
    }
    if (key === 'tags') {
      helper = require('../helpers/tags');
    }
    if (key === 'products') {
      helper = require('../helpers/product');
    }
    if (key === 'things') {
      helper = require('../helpers/things');
    }
    if (key === 'gateways') {
      helper = require('../helpers/gateways');
    }
    if (key === 'collections') {
      helper = require('../helpers/collection');
    }
    if (key === 'locations') {
      helper = require('../helpers/core/location');
    }
    if (key === 'floors') {
      helper = require('../helpers/core/floor');
    }
    if (key === 'zones') {
      helper = require('../helpers/core/zone');
    }
    if (key === 'orders') {
      helper = require('../helpers/order');
    }
    if (key === 'shipments') {
      helper = require('../helpers/shipment');
    }
    if (key === 'tempTags') {
      helper = require('../helpers/tempTags');
    }
    if (key === 'nfcTag') {
      helper = require('../helpers/nfcTag');
    }
    return helper
      .getById(id)
      .then(() => ({
        status: true,
        validatorErrors: {}
      }))
      .catch(() => ({
        status: false,
        validatorErrors: {
          eCode: 'ak-elementExists',
          key,
          id
        }
      }));
  }

  notSysDefined(key, id) {
    if (!id) {
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    }
    let helper;
    if (key === 'attributes') {
      helper = require('../helpers/attribute');
    }
    if (key === 'categories') {
      helper = require('../helpers/category');
    }
    if (key === 'tags') {
      helper = require('../helpers/tags');
    }
    if (key === 'products') {
      helper = require('../helpers/product');
    }
    if (key === 'things') {
      helper = require('../helpers/things');
    }
    if (key === 'gateways') {
      helper = require('../helpers/gateways');
    }
    if (key === 'collections') {
      helper = require('../helpers/collection');
    }
    if (key === 'devices') {
      helper = require('../helpers/device');
    }
    if (key === 'orders') {
      helper = require('../helpers/order');
    }
    if (key === 'shipments') {
      helper = require('../helpers/shipment');
    }
    return helper
      .getById(id)
      .then(result => {
        if (result.sysDefined !== 1) {
          return {
            status: true,
            validatorErrors: {}
          };
        }
        return {
          status: false,
          validatorErrors: {
            eCode: 'ak-notSysDefined',
            key,
            id
          }
        };
      })
      .catch(() => ({
        status: true,
        validatorErrors: {}
      }));
  }

  checkSame(key, field, value, id) {
    if (!value) {
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    }
    let helper;
    if (key === 'attributes') {
      helper = require('../helpers/attribute');
    }
    if (key === 'categories') {
      helper = require('../helpers/category');
    }
    if (key === 'tags') {
      helper = require('../helpers/tags');
    }
    if (key === 'products') {
      helper = require('../helpers/product');
    }
    if (key === 'things') {
      helper = require('../helpers/things');
    }
    if (key === 'gateways') {
      helper = require('../helpers/gateways');
    }
    if (key === 'collections') {
      helper = require('../helpers/collection');
    }
    if (key === 'devices') {
      helper = require('../helpers/device');
    }
    if (key === 'locations') {
      helper = require('../helpers/core/location');
    }
    if (key === 'floors') {
      helper = require('../helpers/core/floor');
    }
    if (key === 'zones') {
      helper = require('../helpers/core/zone');
    }
    if (key === 'orders') {
      helper = require('../helpers/order');
    }
    if (key === 'shipments') {
      helper = require('../helpers/shipment');
    }
    if (key === 'tempTags') {
      helper = require('../helpers/tempTags');
    }
    if (key === 'nfcTag') {
      helper = require('../helpers/nfcTag');
    }
    return helper
      .getById(id)
      .then(result => {
        if (result[field] === value) {
          return {
            status: true,
            validatorErrors: {}
          };
        }
        return {
          status: false,
          validatorErrors: {
            eCode: 'ak-checkSame',
            key,
            field,
            value,
            id
          }
        };
      })
      .catch(() => ({
        status: true,
        validatorErrors: {}
      }));
  }

  arrayOfType(type, data) {
    let result;
    try {
      let isSuccess = true;
      isSuccess = data.reduce((result, element) => {
        result = result && jsTypeChecker.getType(element) === type;
        return result;
      }, true);
      if (isSuccess) {
        result = {
          status: true,
          validatorErrors: {}
        };
      } else {
        result = {
          status: false,
          validatorErrors: {
            eCode: 'ak-arrayOfType',
            type
          }
        };
      }
    } catch (e) {
      result = {
        status: true,
        validatorErrors: {}
      };
    }

    return bluebirdPromise.resolve(result);
  }

  validatePopulatableLists(key = '', data = [], excludedId = '') {
    if (!data) {
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    }

    if (!jsTypeChecker.isArray(data)) {
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    }
    let list = data;
    let result;
    let helper;
    try {
      if (key === 'attributes') {
        helper = require('../helpers/attribute');
        list = data.map(x => x.id);
      }
      if (key === 'tags') {
        helper = require('../helpers/tags');
      }
      if (key === 'categories') {
        helper = require('../helpers/category');
      }
      if (key === 'things') {
        helper = require('../helpers/things');
      }
      if (key === 'gateways') {
        helper = require('../helpers/gateways');
      }
      return helper.validatePopulatable(list, excludedId).then(status => {
        if (status) {
          result = {
            status: true,
            validatorErrors: {}
          };
        } else {
          result = {
            status: false,
            validatorErrors: {
              eCode: 'ak-populatable',
              key
            }
          };
        }
        return result;
      });
    } catch (e) {
      result = {
        status: true,
        validatorErrors: {}
      };

      return bluebirdPromise.resolve(result);
    }
  }

  validateParent(key, parentId, selfId) {
    if (!parentId) {
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    } else if (!mongoose.Types.ObjectId.isValid(parentId)) {
      return bluebirdPromise.resolve({
        status: false,
        validatorErrors: {
          eCode: 'ak-validateParent',
          key,
          parent: parentId,
          self: selfId
        }
      });
    }
    let model;
    let conditions = {
      _id: mongoose.Types.ObjectId(parentId),
      status: 1
    };
    if (key === 'categories') {
      model = require('../models/category');
    }
    if (key === 'collections') {
      model = require('../models/kollection');
    }
    if (key === 'products') {
      model = require('../models/product');
    }
    if (key === 'locations') {
      model = require('../models/location');
    }
    if (key === 'floors') {
      model = require('../models/location');
      conditions.type = 'floor';
    }

    if (mongoose.Types.ObjectId.isValid(selfId)) {
      conditions['ancestors.id'] = { $ne: mongoose.Types.ObjectId(selfId) };
    }
    conditions = require('./clientHandler').addClientFilterToConditions(conditions);
    return model
      .count(conditions)
      .exec()
      .then(count => {
        if (count) {
          return {
            status: true,
            validatorErrors: {}
          };
        }
        return {
          status: false,
          validatorErrors: {
            eCode: 'ak-validateParent',
            key,
            parent: parentId,
            self: selfId
          }
        };
      });
  }

  validateCollectionItems(key, itemIdList) {
    if (!key) {
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    }
    if (!itemIdList) {
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    }

    if (!jsTypeChecker.isArray(itemIdList)) {
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    }

    const isSuccess = itemIdList.reduce((result, itemId) => {
      result = result && mongoose.Types.ObjectId.isValid(itemId);
      return result;
    }, true);

    if (!isSuccess) {
      return bluebirdPromise.resolve({
        status: false,
        validatorErrors: {
          eCode: 'ak-validateCollectionItems',
          key,
          itemList: itemIdList
        }
      });
    }
    itemIdList = [...new Set(itemIdList)];
    itemIdList = itemIdList.map(id => mongoose.Types.ObjectId(id));
    let model;
    if (key === 'attributes') {
      model = require('../models/attribute');
    }
    if (key === 'categories') {
      model = require('../models/category');
    }
    if (key === 'products') {
      model = require('../models/product');
    }

    let conditions = { _id: { $in: itemIdList }, status: 1 };
    conditions = require('./clientHandler').addClientFilterToConditions(conditions);
    return model.count(conditions).then(count => {
      if (count !== itemIdList.length) {
        return bluebirdPromise.resolve({
          status: false,
          validatorErrors: {
            eCode: 'ak-validateCollectionItems',
            key,
            itemList: itemIdList
          }
        });
      }
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    });
  }

  validateLocation(locationId) {
    if (!locationId) {
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    }

    if (!jsTypeChecker.isString(locationId)) {
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    }

    if (!mongoose.Types.ObjectId.isValid(locationId)) {
      return bluebirdPromise.resolve({
        status: false,
        validatorErrors: {
          eCode: 'ak-validateLocation',
          locationId
        }
      });
    }

    const locationHelper = require('../helpers/core/location');
    return locationHelper
      .getById(locationId)
      .then(result => {
        if (result.status !== 0) {
          return {
            status: true,
            validatorErrors: {}
          };
        }
        return {
          status: false,
          validatorErrors: {
            eCode: 'ak-validateLocation',
            locationId
          }
        };
      })
      .catch(() =>
        bluebirdPromise.resolve({
          status: false,
          validatorErrors: {
            eCode: 'ak-validateLocation',
            locationId
          }
        })
      );
  }

  validateZone(zoneId, floorId) {
    if (!zoneId) {
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    }

    if (!jsTypeChecker.isString(zoneId)) {
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    }

    if (!mongoose.Types.ObjectId.isValid(zoneId)) {
      return bluebirdPromise.resolve({
        status: false,
        validatorErrors: {
          eCode: 'ak-validateZone',
          zoneId,
          floorId
        }
      });
    }

    const locationHelper = require('../helpers/core/zone');
    return locationHelper
      .getById(zoneId)
      .then(result => {
        if (result.status !== 0 && !!floorId) {
          return {
            status: true,
            validatorErrors: {}
          };
        }

        if (result.status !== 0 && result.parent === floorId) {
          return {
            status: true,
            validatorErrors: {}
          };
        }
        return {
          status: false,
          validatorErrors: {
            eCode: 'ak-validateZone',
            zoneId,
            floorId
          }
        };
      })
      .catch(() =>
        bluebirdPromise.resolve({
          status: false,
          validatorErrors: {
            eCode: 'ak-validateZone',
            zoneId,
            floorId
          }
        })
      );
  }

  validateFloor(floorId, locationId) {
    if (!floorId) {
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    }

    if (!jsTypeChecker.isString(floorId)) {
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    }

    if (!mongoose.Types.ObjectId.isValid(floorId)) {
      return bluebirdPromise.resolve({
        status: false,
        validatorErrors: {
          eCode: 'ak-validateFloor',
          floorId,
          locationId
        }
      });
    }

    const locationHelper = require('../helpers/core/floor');
    return locationHelper
      .getById(floorId)
      .then(result => {
        if (result.status !== 0 && !!floorId) {
          return {
            status: true,
            validatorErrors: {}
          };
        }

        if (result.status !== 0 && result.parent === floorId) {
          return {
            status: true,
            validatorErrors: {}
          };
        }
        return {
          status: false,
          validatorErrors: {
            eCode: 'ak-validateFloor',
            floorId,
            locationId
          }
        };
      })
      .catch(() =>
        bluebirdPromise.resolve({
          status: false,
          validatorErrors: {
            eCode: 'ak-validateFloor',
            floorId,
            locationId
          }
        })
      );
  }

  sysDefinedCollectionUpdate(collectionId, requestBody, options = {}) {
    const helper = require('../helpers/collection');
    return helper
      .getById(collectionId)
      .then(result => {
        if (result.sysDefined !== 1) {
          return {
            status: true,
            validatorErrors: {}
          };
        }
        if (
          !(
            result.code === requestBody.code &&
            result.name === requestBody.name &&
            result.status === requestBody.status &&
            result.type === requestBody.type &&
            result.parent === (requestBody.parent || null)
          )
        ) {
          return {
            status: false,
            validatorErrors: {
              eCode: 'ak-sysDefinedCollectionUpdate',
              collectionId,
              change: 'valueChanged'
            }
          };
        }

        const requestItems = requestBody.items;

        const currentSysDefinedItems = result.items
          .filter(item => item.sysDefined === 1)
          .map(item => String(item.id).valueOf());
        const commonItems = options.AkUtils.getArrayIntersection(
          currentSysDefinedItems,
          requestItems
        );
        // console.log(currentSysDefinedItems);
        // console.log(requestItems);
        const sysDefinedItemsNotChanged = options.AkUtils.compareArraysForEquality(
          currentSysDefinedItems,
          commonItems
        );
        if (sysDefinedItemsNotChanged) {
          return {
            status: true,
            validatorErrors: {}
          };
        }

        return {
          status: false,
          validatorErrors: {
            eCode: 'ak-sysDefinedCollectionUpdate',
            collectionId,
            change: 'sysDefinedModified'
          }
        };
      })
      .catch(() => ({
        status: true,
        validatorErrors: {}
      }));
  }

  deactivationCheck(key, requestedStatus, id) {
    if (requestedStatus !== 0) {
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    }

    let helper;
    if (key === 'tags') {
      helper = require('../helpers/tags');
    }
    if (key === 'attributes') {
      helper = require('../helpers/attribute');
    }
    if (key === 'categories') {
      helper = require('../helpers/category');
    }
    if (key === 'things') {
      helper = require('../helpers/things');
    }
    if (key === 'products') {
      helper = require('../helpers/product');
    }
    if (key === 'locations') {
      helper = require('../helpers/core/location');
    }
    if (key === 'floors') {
      helper = require('../helpers/core/floor');
      key = 'locations';
    }
    if (key === 'zones') {
      helper = require('../helpers/core/zone');
      key = 'locations';
    }
    if (key === 'tempTags') {
      helper = require('../helpers/tempTags');
      key = 'things';
    }
    if (key === 'nfcTag') {
      helper = require('../helpers/nfcTag');
      key = 'things';
    }
    return helper
      .getById(id)
      .then(result => {
        // console.log(result);
        if (result.status === 0) {
          return {
            status: true,
            validatorErrors: {}
          };
        }
        // console.log('++++++++++');
        return this.findInactiveDependencyCount(key, id).then(totalCount => {
          // console.log('totalCount');
          // console.log(totalCount);
          if (totalCount === 0) {
            return {
              status: true,
              validatorErrors: {}
            };
          }

          return {
            status: false,
            validatorErrors: {
              eCode: 'ak-deactivationCheck',
              key,
              id
            }
          };
        });
      })
      .catch(e => {
        // console.log(e);
        return {
          status: true,
          validatorErrors: {}
        };
      });
  }

  validateTimeDiff(smallDate, largeDate, timeGap = null) {
    if (!smallDate || !largeDate) {
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    }
    let result;
    const timediff = require('timediff');
    const diff = timediff(smallDate, largeDate, 'm').minutes;
    if (!timeGap) {
      timeGap = 0;
    }
    if (diff >= timeGap) {
      result = {
        status: true,
        validatorErrors: {}
      };
    } else {
      result = {
        status: false,
        validatorErrors: {
          eCode: 'ak-timediff',
          timeGap
        }
      };
    }
    return bluebirdPromise.resolve(result);
  }
  validateDiff(minValue, maxValue, diff = 0, options) {
    if (!minValue || !maxValue) {
      return bluebirdPromise.resolve({
        status: true,
        validatorErrors: {}
      });
    }
    let result;
    const gap = maxValue - minValue;
    if (gap >= diff) {
      result = {
        status: true,
        validatorErrors: {}
      };
    } else {
      result = {
        status: false,
        validatorErrors: {
          eCode: 'ak-diff',
          diff,
          options
        }
      };
    }
    return bluebirdPromise.resolve(result);
  }
  getErrorObject(validatorErrorsObj, placeholder, field) {
    const eCode = validatorErrorsObj.eCode;
    let message = '';
    switch (eCode) {
      case 'ak-required':
        message = `${placeholder} is mandatory`;
        if (validatorErrorsObj.multiple) {
          message = `${placeholder} are mandatory`;
        }
        break;

      case 'ak-requiredValues':
        message = `${placeholder} is mandatory`;
        if (validatorErrorsObj.multiple) {
          message = `${placeholder} are mandatory`;
        }
        break;
      case 'ak-type':
        message = `Invalid ${placeholder}(only ${validatorErrorsObj.requiredType}s are allowed)`;
        break;
      case 'ak-regex':
        message = `Invalid ${placeholder}`;
        break;
      case 'ak-range':
        message = `Invalid ${placeholder}(must be between ${validatorErrorsObj.minValue} and ${validatorErrorsObj.maxValue})`;
        break;
      case 'ak-valueAllowed':
        message = `Invalid ${placeholder}`;
        break;
      case 'ak-stringLength':
        if (validatorErrorsObj.minLength === 0) {
          message = `${placeholder} cannot be more than ${validatorErrorsObj.maxLength} characters`;
        } else {
          message = `${placeholder} must be between ${validatorErrorsObj.minLength} and ${validatorErrorsObj.maxLength} characters`;
        }
        break;

      case 'ak-duplicateElem':
        message = `${placeholder} may not be repeated`;
        break;
      case 'ak-duplicate':
        message = `${placeholder} already exists`;
        break;

      case 'ak-elementExists':
        message = `${placeholder} does not exist`;
        break;

      case 'ak-notSysDefined':
        message = `Cannot modify sysDefined ${placeholder}`;
        break;

      case 'ak-checkSame':
        message = `${placeholder} cannot be modified`;
        break;

      case 'ak-arrayOfType':
        message = `${placeholder} must be a list of ${validatorErrorsObj.type}`;
        break;

      case 'ak-populatable':
        message = `One or more ${placeholder} does not exist or is not available`;
        break;

      case 'ak-validateParent':
        message = `${placeholder} does not exist or is not valid`;
        break;

      case 'ak-validateCollectionItems':
        message = `One or more ${validatorErrorsObj.key} does not exist or is not available`;
        break;

      case 'ak-nonNegative':
        message = `${placeholder} cannot be negative.`;
        break;

      case 'ak-validateLocation':
        message = 'Location does not exist or is not available';
        break;

      case 'ak-validateZone':
        if (validatorErrorsObj.floorId) {
          message = 'Zone does not exist in this floor or is not available';
        }
        message = 'Zone does not exist or is not available';
        break;

      case 'ak-requiredKey':
        message = `${validatorErrorsObj.key} key is required`;
        break;

      case 'ak-validateFloor':
        if (validatorErrorsObj.locationId) {
          message = 'Floor does not exist in this location or is not available';
        }
        message = 'Floor does not exist or is not available';
        break;

      case 'ak-sysDefinedCollectionUpdate':
        if (validatorErrorsObj.change === 'valueChanged') {
          message = 'Cannot modify anything except items of a sysDefined Collection';
        } else if (validatorErrorsObj.change === 'sysDefinedModified') {
          message = 'Can only modify non-sysDefined items of a sysDefined Collection';
        }
        break;

      case 'ak-productAddition':
        message = validatorErrorsObj.data;
        break;

      case 'ak-deactivationCheck':
        message = `${placeholder} is used somewhere. Cannot deactivate.`;
        break;

      case 'ak-timediff':
        message = `${(placeholder || '').split('--')[0]} must be less than ${(placeholder || ''
        ).split('--')[1]}`;
        if (validatorErrorsObj.timeGap > 0) {
          message = `${(placeholder || '').split(
            '--'
          )[0]} must be at least ${validatorErrorsObj.timeGap} minutes greater than ${(placeholder ||
            ''
          ).split('--')[1]}`;
        }
        break;
      case 'ak-diff':
        message = `${(validatorErrorsObj.options || {}).minValueLabel ||
          ''} must be less than ${(validatorErrorsObj.options || {}).maxValueLabel || ''}`;
        if (validatorErrorsObj.diff > 0) {
          message = `${(validatorErrorsObj.options || {}).maxValueLabel ||
            ''} must be at least ${validatorErrorsObj.diff} greater than ${(validatorErrorsObj.options ||
            {}
          ).minValueLabel || ''}`;
        }
        break;

      case 'ak-requiredIfDependencyProvided':
        message = `${placeholder} is required to provide ${validatorErrorsObj.dependentDataLabel}`;
        break;

      default:
        message = 'Something Went Wrong';
        break;
    }

    return {
      message,
      code: eCode,
      field
    };
  }

  findInactiveDependencyCount(key, id) {
    const MODEL_FILE_DIR = '../models/';
    const dependencyJson = require('../mappings/deactivationDependencies');
    const dependents = dependencyJson.dependencies[key];
    const modelFilePaths = dependencyJson.modelFilePaths;
    const condition = [];
    const check = [];

    for (let i = 0; i < dependents.length; i++) {
      const model = require(MODEL_FILE_DIR + modelFilePaths[dependents[i].model]);
      condition[i] = [];
      for (let j = 0; j < dependents[i].paths.length; j++) {
        condition[i][j] = {};
        condition[i][j][`${dependents[i].paths[j]}.id`] = mongoose.Types.ObjectId(id);
      }
      check.push({
        model,
        modelName: dependents[i].model,
        conditions: clientHandler.addClientFilterToConditions(
          Object.assign({}, { $or: condition[i] }, dependents[i].additionalConditions || {})
        )
      });
    }

    return bluebirdPromise
      .map(check, item =>
        item.model
          .count(item.conditions)
          .exec()
          .then(count => {
            // console.log(count);
            // console.log(item.modelName);
            return count;
          })
      )
      .then(res => res.reduce((sum, item) => sum + item, 0))
      .catch(e => {
        // console.log(e);
      });
  }
}

Set.prototype.isSuperset = function(subset) {
  for (const elem of subset) {
    if (!this.has(elem)) {
      return false;
    }
  }
  return true;
};
module.exports = new Validator();
