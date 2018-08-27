/* jshint esversion: 6 */

const mongoose = require('mongoose');
const kms = require('../lib/aws/kms');

const kmsLib = new kms();
const bluebirdPromise = require('bluebird');

const encryptedDbURI = process.env.dbURI;
const encryptedTrackingDbURI = process.env.trackingDbURI;
const iamURI = process.env.iamURI;
const slugify = require('slugify');
const deepTrim = require('deep-trim');
const validationLib = require('../lib/validator');
const jwt = require('jsonwebtoken');

const commonHelper = function() {};

/**
 * Set client across all helpers
 * 
 * @param {Object} clientObj
 */
commonHelper.prototype.setClientAndUpdatedBy = function(clientObj, updatedByObj) {
  this.client = clientObj;
  require('./core/location').setClient(clientObj);
  require('./core/floor').setClient(clientObj);
  require('./tracking/findZone').setClient(clientObj);
  require('./tracking/nearbyLocation').setClient(clientObj);
  require('./apiGateway').setClient(clientObj);
  require('./attribute').setClient(clientObj);
  require('./availablegadgets').setClient(clientObj);
  require('./category').setClient(clientObj);
  require('./collection').setClient(clientObj);
  require('./device').setClient(clientObj);
  // require('./gadgetpositions').setClient(clientObj);
  require('./gateways').setClient(clientObj);
  require('./iam').setClient(clientObj);
  require('./order').setClient(clientObj);
  require('./product').setClient(clientObj);
  require('./shipment').setClient(clientObj);
  require('./tags').setClient(clientObj);
  require('./things').setClient(clientObj);
  require('./gateways').setClient(clientObj);
  require('./tracking').setClient(clientObj);
  require('./syncjob').setClient(clientObj);
  require('./configuration').setClient(clientObj);
  require('./auditTrail').setClient(clientObj);
  require('../lib/validatorAsync').setClient(clientObj);
  require('../lib/clientHandler').setClient(clientObj);
  require('../lib/currentUserHandler').setCurrentUser(updatedByObj);
};
/**
   * Deep clones a object.
   * 
   * @param {Object} objectToClone
   * @return {Object} cloned Object
   */
commonHelper.prototype.deepCloneObject = function(objectToClone) {
  return JSON.parse(JSON.stringify(objectToClone));
};

commonHelper.prototype.addClientFilterToConditions = function(conditions, clientObj) {
  conditions['client.clientId'] = clientObj.clientId;
  conditions['client.projectId'] = clientObj.projectId;
  return conditions;
};

commonHelper.prototype.getClientObject = event =>
  require('../lib/clientHandler').getClientObject(event);

commonHelper.prototype.getListById = function(key, idList, clientObj, allowPartialList = false) {
  const conditions = {};
  let model;
  const objIdList = idList.map(id => mongoose.Types.ObjectId(id));

  conditions._id = { $in: objIdList };
  conditions.client = clientObj;

  if (key === 'attributes') {
    model = require('../models/attribute');
  }
  if (key === 'categories') {
    model = require('../models/category');
  }
  if (key === 'products') {
    model = require('../models/product');
  }
  if (key === 'things') {
    model = require('../models/things');
  }
  if (key === 'tags') {
    model = require('../models/tags');
  }

  return model
    .find(conditions)
    .exec()
    .then(result => {
      if (result.length !== new Set(idList).size && !allowPartialList) {
        return bluebirdPromise.reject();
      }
      const resultMap = {};
      for (let i = 0; i < result.length; i++) {
        resultMap[String(result[i]._id)] = result[i];
      }
    });
};

commonHelper.prototype.getActionSourceUser = event =>
  require('../lib/currentUserHandler').getCurrentUserObject(event);

/**
 * Get common elements of 2 arrays
 * 
 * @param {Array} array1 First array
 * @param {Array} array2 Second array
 * @return {Array} Array of common elements
 */
commonHelper.prototype.getArrayIntersection = (array1, array2) => {
  const a = new Set(array1);
  const b = new Set(array2);
  return [...a].filter(v => b.has(v));
};

/**
 * Check if an array is made of up empty arrays to n-level
 * 
 * @param {Array} arrayToCheck
 * @return {Boolean} 
 */
commonHelper.prototype.isArrayOfEmptyArrays = arrayToCheck => {
  for (const el of arrayToCheck) {
    if (Array.isArray(el)) {
      this.isArrayOfEmptyArrays(el);
    } else if (el.length > 0) {
      return false;
    }
  }

  return true;
};

/**
 * Generate Slug
 * 
 * @param {String} stringToSlugify
 * @return {String} Slugified String
 */
commonHelper.prototype.generateSlug = stringToSlugify => slugify(stringToSlugify);

commonHelper.prototype.generateUniqueId = () =>
  require('node-unique-id-generator').generateUniqueId();

/**
 * Check if latitude is valid
 * 
 * @param {Number} latitude
 * @return {Boolean}
 */
commonHelper.prototype.isValidLatitude = latitude => {
  if (typeof latitude !== 'number' || isNaN(latitude)) {
    return false;
  }
  return latitude >= -90 && latitude <= 90;
};

/**
 * Check if longitude is valid
 * 
 * @param {Number} longitude
 * @return {Boolean}
 */
commonHelper.prototype.isValidLongitude = longitude => {
  if (typeof longitude !== 'number' || isNaN(longitude)) {
    return false;
  }
  return longitude >= -180 && longitude <= 180;
};

commonHelper.prototype.formatResponse = (code, message, description, data) => {
  const response = {
    statusCode: 201,
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      code,
      message,
      description,
      data
    })
  };

  return response;
};

commonHelper.prototype.parseLambdaEvent = function(event) {
  if (!event.queryStringParameters) {
    event.queryStringParameters = {};
  }
  if (!event.pathParameters) {
    event.pathParameters = {};
  }
  if (!event.headers) {
    event.headers = {};
  }
  if (!event.body) {
    event.body = {};
  } else if (typeof event.body === 'string' || event.body instanceof String) {
    event.body = JSON.parse(event.body);
  }
  if (!event.headers.authorizer) {
    event.headers.authorizer = {};
  }
  if (event.headers.Authorization) {
    let token = event.headers.Authorization.split('::');
    token = jwt.decode(token[token.length - 2], { complete: true });
    if (token) {
      const tokenData = token.payload;
      event.headers.authorizer = token.payload;
      if (typeof tokenData['cognito:preferred_role'] !== 'undefined') {
        const prefRoleArr = tokenData['cognito:preferred_role'].split('::');
        const prefRoleArr1 = prefRoleArr[prefRoleArr.length - 1].split(':');
        event.headers.authorizer.clientId = prefRoleArr1[0];
      }
      if (tokenData.iss !== null) {
        const userPoolArr = tokenData.iss.split('/');
        event.headers.authorizer.projectId = userPoolArr[userPoolArr.length - 1];
      }
    }
  }
  return deepTrim(event);
};

commonHelper.prototype.validateCategories = categoryidList => {
  const errors = [];
  if (categoryidList) {
    if (!Array.isArray(categoryidList)) {
      errors.push({ code: 2011, message: 'Categories must be an array.' });
    } else {
      if (categoryidList.length < 0) {
        errors.push({ code: 2022, message: 'Category is mandatory' });
      }
      for (let i = 0; i < categoryidList.length; i++) {
        if (typeof categoryidList[i] !== 'string') {
          errors.push({ code: 2016, message: 'Category Ids must be String' });
          break;
        } else if (!mongoose.Types.ObjectId.isValid(categoryidList[i])) {
          errors.push({ code: 2015, message: 'Invalid Category Ids Provided' });
          break;
        }
      }
      if (categoryidList.length !== new Set(categoryidList).size) {
        errors.push({ code: 2013, message: 'Category cannot be duplicate' });
      }
    }
  }
  return errors;
};

commonHelper.prototype.getCategoryListFromIds = function(categoryIdList) {
  if (this.validateCategories(categoryIdList).length === 0) {
    const categoryList = [];
    if (!categoryIdList) {
      return bluebirdPromise.resolve(categoryList);
    }
    const categoryHelper = require('./category');
    return bluebirdPromise
      .map(categoryIdList, id =>
        categoryHelper
          .getById(id)
          .then(result => {
            const categoryItem = {};
            categoryItem.id = mongoose.Types.ObjectId(result.id);
            categoryItem.name = result.name;
            categoryList.push(categoryItem);
          })
          .then(() => {})
      )
      .then(() => categoryList);
  }
  return bluebirdPromise.resolve([]);
};
commonHelper.prototype.validateAttributes = attributeList => {
  const errors = [];
  if (attributeList) {
    if (!Array.isArray(attributeList)) {
      errors.push({ code: 2011, message: 'Attributes must be an array.' });
    } else {
      for (const i in attributeList) {
        if (typeof attributeList[i] !== typeof {}) {
          errors.push({ code: 2016, message: 'Attribute must be Object' });
          break;
        } else if (!mongoose.Types.ObjectId.isValid(attributeList[i].id)) {
          errors.push({ code: 2015, message: 'Invalid Attribute Ids Provided' });
          break;
        } else if (typeof attributeList[i].value !== 'string') {
          errors.push({ code: 2018, message: 'Attribute value must be a string.' });
          break;
        } else if (
          typeof attributeList[i].value === 'string' &&
          attributeList[i].value.length > 50
        ) {
          errors.push({ code: 2018, message: 'Attribute value cannot be more than 50 characters' });
          break;
        }
      }
      const seen = new Set();
      const hasDuplicates = attributeList.some(
        currentObject => seen.size === seen.add(currentObject.id).size
      );
      if (hasDuplicates) {
        errors.push({ code: 2013, message: 'Attribute Id cannot be duplicate' });
      }
    }
  }
  return errors;
};
commonHelper.prototype.getAttributeListFromIds = function(attributeIdList) {
  if (this.validateAttributes(attributeIdList).length === 0) {
    const attributeList = [];
    if (!attributeIdList) {
      return bluebirdPromise.resolve(attributeList);
    }
    const attributeHelper = require('./attribute');
    return bluebirdPromise
      .map(attributeIdList, obj =>
        attributeHelper
          .getById(obj.id)
          .then(result => {
            const attributeItem = {};
            attributeItem.id = mongoose.Types.ObjectId(result.id);
            attributeItem.name = result.name;
            attributeItem.value = obj.value;
            attributeItem.sysDefined = result.sysDefined;
            attributeItem.status = result.status;
            attributeList.push(attributeItem);
          })
          .then(() => {})
      )
      .then(() => attributeList);
  }
  return bluebirdPromise.resolve([]);
};
commonHelper.prototype.validateThings = thingsList => {
  const errors = [];
  if (thingsList) {
    if (!Array.isArray(thingsList)) {
      errors.push({ code: 2011, message: 'Things must be an array.' });
    } else {
      for (const i in thingsList) {
        if (typeof thingsList[i] !== 'string') {
          errors.push({ code: 2016, message: 'Thing Ids must be String' });
          break;
        } else if (!mongoose.Types.ObjectId.isValid(thingsList[i])) {
          errors.push({ code: 2015, message: 'Invalid things Ids Provided' });
          break;
        }
      }
      const seen = new Set();
      const hasDuplicates = thingsList.some(
        currentObject => seen.size === seen.add(currentObject).size
      );
      if (hasDuplicates) {
        errors.push({ code: 2013, message: 'Things Id cannot be duplicate' });
      }
    }
  }
  return errors;
};

commonHelper.prototype.getThingsListFromIds = function(thingsIdList) {
  if (this.validateThings(thingsIdList).length === 0) {
    const thingsList = [];
    if (!thingsIdList) {
      return bluebirdPromise.resolve(thingsList);
    }
    const thingsHelper = require('./things');
    return bluebirdPromise
      .map(thingsIdList, obj =>
        thingsHelper
          .getById(obj)
          .then(result => {
            const thingItem = {};
            thingItem.id = mongoose.Types.ObjectId(result.id);
            thingItem.code = result.code;
            thingItem.name = result.name;
            thingItem.type = result.type;
            thingsList.push(thingItem);
          })
          .then(() => {})
      )
      .then(() => thingsList);
  }
  return bluebirdPromise.resolve([]);
};
commonHelper.prototype.moveSystemAttributesToGlobal = function(
  formattedResponse,
  typeconversions = {},
  key = 'attributes'
) {
  if (!formattedResponse[key]) {
    return formattedResponse;
  }
  const rootObj = {};
  let arrSysAttribute = [];
  let nonSysAttribute = [];
  arrSysAttribute = formattedResponse[key].filter(obj => obj.sysDefined === 1);
  nonSysAttribute = formattedResponse[key].filter(obj => obj.sysDefined !== 1);
  const arrayLength = arrSysAttribute.length;
  for (let i = 0; i < arrayLength; i++) {
    let value;
    if (typeconversions[arrSysAttribute[i].name] === 'number') {
      value = Number(arrSysAttribute[i].value);
    } else if (typeconversions[arrSysAttribute[i].name] === 'boolean') {
      value = Boolean(arrSysAttribute[i].value);
    } else {
      value = String(arrSysAttribute[i].value);
    }
    rootObj[arrSysAttribute[i].name] = value;
  }
  formattedResponse[key] = nonSysAttribute;
  formattedResponse = Object.assign({}, formattedResponse, rootObj);
  return formattedResponse;
};
commonHelper.prototype.getTagListFromNames = function(tagNameList, event) {
  if (this.validateTags(tagNameList).length === 0) {
    const tagList = [];
    if (!tagNameList) {
      return bluebirdPromise.resolve(tagList);
    }
    const tagHelper = require('./tags');
    return bluebirdPromise
      .map(tagNameList, name =>
        tagHelper
          .getByName(name)
          .then(result => {
            const tagItem = {};
            tagItem.id = mongoose.Types.ObjectId(result.id);
            tagItem.name = result.name;
            tagList.push(tagItem);
          })
          .catch(err => {
            // console.log(err);
            const saveEvent = this.deepCloneObject(event);
            saveEvent.body.name = name;
            saveEvent.body.status = 1;
            return tagHelper.save(saveEvent).then(result => {
              const tagItem = {};
              tagItem.id = mongoose.Types.ObjectId(result._id);
              tagItem.name = result.name;
              tagList.push(tagItem);
            });
          })
          .then(() => {})
      )
      .then(() => tagList);
  }
  return bluebirdPromise.resolve([]);
};

commonHelper.prototype.validateTags = tagNameList => {
  const errors = [];
  if (tagNameList) {
    if (!Array.isArray(tagNameList)) {
      errors.push({ code: 2011, message: 'Tags must be an array.' });
    } else {
      for (const i in tagNameList) {
        if (typeof tagNameList[i] !== 'string' || tagNameList[i] === '') {
          errors.push({ code: 2012, message: 'Tags must be an array of non-empty strings only.' });
          break;
        }
      }
      if (tagNameList.length !== new Set(tagNameList).size) {
        errors.push({ code: 2013, message: 'Tags cannot be duplicate' });
      }
    }
  }
  return errors;
};

commonHelper.prototype.updateChildren = function(key, formattedSourceObj) {
  let model;
  if (key === 'category') {
    model = require('../models/category');
  } else if (key === 'collection') {
    model = require('../models/kollection');
  } else if (key === 'location') {
    model = require('../models/location');
  } else if (key === 'product') {
    model = require('../models/product');
  } else {
    return bluebirdPromise.reject('Invalid Key Specified');
  }

  const renameOptions = {};
  renameOptions.query = { 'ancestors.id': mongoose.Types.ObjectId(formattedSourceObj.id) };
  renameOptions.$set = {
    $set: {
      'ancestors.$.name': formattedSourceObj.name,
      'ancestors.$.seoName': formattedSourceObj.seoName
    }
  };
  renameOptions.options = { upsert: false, multi: true };

  let conditions = { 'ancestors.id': mongoose.Types.ObjectId(formattedSourceObj.id) };
  conditions = require('../lib/clientHandler').addClientFilterToConditions(conditions);
  return model
    .update(renameOptions.query, renameOptions.$set, renameOptions.options)
    .exec()
    .then(() => model.find(conditions).exec())
    .then(resList =>
      bluebirdPromise
        .each(resList, element => {
          let newAncestors = [];
          const oldAncestors = element.ancestors;
          for (
            let i = 0;
            i < oldAncestors.length && String(oldAncestors[i].id) !== String(formattedSourceObj.id);
            i++
          ) {
            newAncestors.push(oldAncestors[i]);
          }
          newAncestors.push({
            id: formattedSourceObj.id,
            name: formattedSourceObj.name,
            seoName: formattedSourceObj.seoName
          });
          newAncestors = newAncestors.concat(formattedSourceObj.ancestors);
          const updateAncestorsOptions = {};
          updateAncestorsOptions.query = { _id: mongoose.Types.ObjectId(element._id) };
          updateAncestorsOptions.$set = { $set: { ancestors: newAncestors } };
          updateAncestorsOptions.options = { upsert: false, multi: true };
          return model
            .update(
              updateAncestorsOptions.query,
              updateAncestorsOptions.$set,
              updateAncestorsOptions.options
            )
            .exec();
        })
        .then(() => {})
    );
};

commonHelper.prototype.lambdaEventToBodyParserReq = function(event) {
  const req = {};
  req.params = {};
  req.query = {};
  req.body = {};
  req.headers = {};
  if (!process.env.IS_LOCAL) {
    if (event.queryStringParameters !== null) {
      req.query = event.queryStringParameters;
    }
    if (event.pathParameters !== null) {
      req.params = event.pathParameters;
    }
    if (event.headers !== null) {
      req.headers = event.headers;
    }
    if (event.body !== null) {
      req.body = JSON.parse(event.body);
    }
  }
  return req;
};

commonHelper.prototype.decryptDbURI = function() {
  if (process.env.kms === 1 || process.env.kms === '1') {
    return kmsLib.decrypt(encryptedDbURI);
  }
  return new bluebirdPromise((resolve, reject) => {
    if (encryptedDbURI) {
      resolve(encryptedDbURI);
    } else {
      reject(false);
    }
  });
};

commonHelper.prototype.decryptTrackingDbURI = function() {
  if (process.env.kms === 1 || process.env.kms === '1') {
    return kmsLib.decrypt(encryptedTrackingDbURI);
  }
  return new bluebirdPromise((resolve, reject) => {
    if (encryptedTrackingDbURI) {
      resolve(encryptedTrackingDbURI);
    } else {
      reject(false);
    }
  });
};

commonHelper.prototype.iamURI = function() {
  return iamURI;
};

commonHelper.prototype.connectToDb = function(dbURI) {
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState !== 1 && mongoose.connection.readyState !== 2) {
    mongoose.connect(dbURI);
  }
};

commonHelper.prototype.getAllowedPolicies = function(policy) {
  let allowedPolicies = [];
  policy[0].Statement.forEach(element => {
    switch (element.Sid) {
      case 'MasterAllow':
        if (element.Effect === 'Allow' && element.Action.indexOf('lambda:InvokeFunction') > -1) {
          allowedPolicies = allowedPolicies.concat(element.Resource);
        }
        break;
      case 'Userpool':
        if (element.Effect === 'Allow' && element.Action.indexOf('cognito-idp:*') > -1) {
          allowedPolicies = allowedPolicies.concat('userpoolfullaccess');
        }
        break;
    }
  });
  return allowedPolicies;
};

commonHelper.prototype.validateAndGetSystemAttributes = function(
  collectionCode,
  event,
  validations = {}
) {
  const sysDefinedAttrPair = [];
  const errors = [];
  const collectionHelper = require('./collection');
  const attributeHelper = require('./attribute');
  return collectionHelper
    .getByCode(collectionCode)
    .then(result =>
      bluebirdPromise
        .map(result.items, element => attributeHelper.getById(element.id))
        .then(sysDefAttrList => {
          for (let i = 0; i < sysDefAttrList.length; i++) {
            const sysDefAttr = {};
            let validationList = [];
            if (validations[sysDefAttrList[i].name]) {
              validationList = validations[sysDefAttrList[i].name];
            }
            for (let j = 0; j < validationList.length; j++) {
              if (!validationList[j].params) {
                validationList[j].params = [];
              }

              validationList[j].params.push(event.body[sysDefAttrList[i].name]);
              if (event.body[sysDefAttrList[i].name]) {
                const validationResult = validationList[j].function(...validationList[j].params);
                if (!validationResult.status) {
                  errors.push({
                    code: Number(`${22}${i}${j}`),
                    message: validationLib.getErrorMessage(
                      validationResult.validatorErrors,
                      validationList[j].fieldName
                    )
                  });
                }
              }
              if (validationList[j].function === validationLib.required) {
                const validationResult = validationList[j].function(...validationList[j].params);
                if (!validationResult.status) {
                  // console.log(event.body[sysDefAttrList[i].name]);
                  // console.log(sysDefAttrList[i].name);
                  errors.push({
                    code: Number(`${22}${i}${j}`),
                    message: validationLib.getErrorMessage(
                      validationResult.validatorErrors,
                      validationList[j].fieldName
                    )
                  });
                }
              }
            }
            sysDefAttr.id = sysDefAttrList[i].id;
            sysDefAttr.name = sysDefAttrList[i].name;
            sysDefAttr.value = event.body[sysDefAttrList[i].name];
            sysDefAttr.sysDefined = sysDefAttrList[i].sysDefined;
            sysDefAttr.status = sysDefAttrList[i].status;
            if (sysDefAttr.value !== null && sysDefAttr.value !== undefined) {
              sysDefinedAttrPair.push(sysDefAttr);
            }
          }
          if (errors.length > 0) {
            return bluebirdPromise.reject(errors);
          }
          return bluebirdPromise.resolve(sysDefinedAttrPair);
        })
        .catch(err => {
          // console.log(err);
          if (errors.length > 0) {
            return bluebirdPromise.reject(errors);
          }
          return bluebirdPromise.reject('No Attribute for provided Id.');
        })
    )
    .catch(err => {
      if (errors.length > 0) {
        return bluebirdPromise.reject(errors);
      }
      // console.log(err);
      return bluebirdPromise.reject('No Collection with Specified Code.');
    });
};

commonHelper.prototype.populateSystemAttributes = function(collectionCode, event) {
  let sysDefinedAttrPair = [];
  const collectionHelper = require('./collection');
  const attributeHelper = require('./attribute');
  return collectionHelper
    .getByCode(collectionCode)
    .then(result => {
      let attrIdObjList = [];
      attrIdObjList = result.items.map(item => ({
        id: item.id
      }));
      return attributeHelper.getForPopulation(attrIdObjList, true);
    })
    .then(sysDefAttrList => {
      sysDefinedAttrPair = sysDefAttrList
        .map(sysDefAttr => {
          sysDefAttr.value = event.body[sysDefAttr.name] || '';
          return sysDefAttr;
        })
        .filter(sysDefAttr => sysDefAttr.value !== null && typeof sysDefAttr.value !== 'undefined');
      return sysDefinedAttrPair;
    })
    .catch(() => []);
};

commonHelper.prototype.getPolygonGeoJSONObj = function(latitude, longitude, radius) {
  const turfCircle = require('@turf/circle');
  const turfHelper = require('@turf/helpers');
  const center = turfHelper.point([longitude, latitude]);
  const steps = 36;
  const units = 'meters';
  return turfCircle(center, radius, steps, units).geometry;
};

commonHelper.prototype.getEmptyPolygonGeoJSONObj = function() {
  const turfHelper = require('@turf/helpers');
  return turfHelper.polygon([]).geometry;
};

commonHelper.prototype.getProductListFromIds = function getProductListFromIds(
  products,
  deliveryStatus = 10
) {
  const productArray = [];
  const productHelper = require('./product');
  const err = [];
  return bluebirdPromise
    .each(products, product => {
      const temp = {};
      return bluebirdPromise
        .all([productHelper.getById(product.id), this.getOrderFromId(product.orderId)])
        .then(resultObj => {
          if (Object.keys(resultObj[0]).length > 0) {
            if (typeof resultObj[0].things === typeof [] && resultObj[0].things.length > 0) {
              temp.id = resultObj[0].id;
              temp.code = resultObj[0].code;
              temp.name = resultObj[0].name;
              temp.things = resultObj[0].things;
              temp.orderDetails = resultObj[1];
              temp.deliveryStatus = deliveryStatus;
              productArray.push(temp);
            } else {
              err.push(`Things not attached with product: ${resultObj[0].code}`);
            }
          } else {
            err.push('Product Something Went Wrong');
          }
        });
    })
    .then(() => {
      if (err.length > 0) {
        return bluebirdPromise.reject(err);
      }
      return bluebirdPromise.resolve(productArray);
    })
    .catch(err => bluebirdPromise.reject(err));
};

commonHelper.prototype.getProductFromId = function getProductFromId(productId) {
  if (!productId && (productId || '').trim() === '') {
    return {};
  }
  const productHelper = require('./product');
  const err = [];
  return productHelper
    .getById(productId)
    .then(res => {
      const product = {};
      product.id = res.id;
      product.code = res.code;
      product.name = res.name;
      return bluebirdPromise.resolve(product);
    })
    .catch(error => {
      // console.log(error);
      err.push('Product Something Went Wrong');
      return bluebirdPromise.reject(err);
    });
};

commonHelper.prototype.getLocationListFromIds = function getLocationListFromIds(locations) {
  const locationArray = [];
  const locationHelper = require('./core/location');
  return bluebirdPromise
    .each(locations, item => {
      const temp = {};
      // // console.log(item.location);
      temp.addressType = item.addressType;
      return locationHelper
        .getById(item.location.id, false)
        .then(res => {
          if (!res || typeof res === 'undefined' || typeof res !== 'object') {
            return bluebirdPromise.reject('Something Went Wrong');
          }

          temp.location = {};
          temp.location.id = res.id;
          temp.location.name = res.name;
          temp.location.code = res.code;
          // // console.log(res);
          temp.location.address = res.attributes;
          temp.location.pointCoordinates = {
            type: 'Point',
            coordinates: [res.coordinates.longitude, res.coordinates.latitude]
          };
          locationArray.push(temp);
        })
        .catch(() => bluebirdPromise.reject('Wrong Location id provided'));
    })
    .then(() => bluebirdPromise.resolve(locationArray))
    .catch(err => bluebirdPromise.reject(err));
};

commonHelper.prototype.getOrderFromId = function getOrderFromId(orderId = '') {
  if (orderId === '' || orderId === null || typeof orderId === 'undefined') {
    return {};
  }
  const orderHelper = require('./order');
  let orderDetails = {};
  return orderHelper
    .getById(orderId)
    .then(res => {
      if (!res || typeof res === 'undefined' || typeof res !== 'object') {
        return bluebirdPromise.reject('Something Went Wrong');
      }

      orderDetails.id = res.id;
      orderDetails.name = res.name;
      orderDetails.code = res.code;
      orderDetails.orderStatus = res.orderStatus;
      orderDetails.etd = res.etd;
      const addresses = res.addresses.reduce((a, b) => {
        a[b.addressType] = b.location;
        return a;
      }, {});
      orderDetails = Object.assign({}, orderDetails, addresses);
      return bluebirdPromise.resolve(orderDetails);
    })
    .catch(() =>
      // // console.log(err);
      bluebirdPromise.reject('Wrong Order id provided')
    );
};

commonHelper.prototype.convertUserAndClientToHeader = function(syncjob) {
  return {
    authorizer: {
      clientId: syncjob.client.clientId ? syncjob.client.clientId : '',
      projectId: syncjob.client.projectId ? syncjob.client.projectId : '',
      sub: syncjob.updatedBy.uuid ? syncjob.updatedBy.uuid : '',
      given_name: syncjob.updatedBy.firstName ? syncjob.updatedBy.firstName : '',
      family_name: syncjob.updatedBy.lastName ? syncjob.updatedBy.lastName : '',
      email: syncjob.updatedBy.email ? syncjob.updatedBy.email : ''
    }
  };
};
commonHelper.prototype.generateCode = function(length) {
  // Use it as a replacement for uid:
  const suid = require('rand-token').uid;
  const code = suid(length);
  return code;
};

commonHelper.prototype.setHeader = function(header) {
  this.headers = header;
};

commonHelper.prototype.getAncestors = function(key, parentId) {
  let helper;
  if (!parentId) {
    return bluebirdPromise.resolve([]);
  }
  if (key === 'categories') {
    helper = require('./category');
  }
  if (key === 'collections') {
    helper = require('./collection');
  }
  if (key === 'products') {
    helper = require('./product');
  }
  if (key === 'locations') {
    helper = require('./core/location');
  }
  if (key === 'floors') {
    helper = require('./core/floor');
  }
  return helper.getById(parentId).then(result => {
    const parentAncestorObj = {};
    parentAncestorObj.id = result.id;
    parentAncestorObj.seoName = result.seoName;
    parentAncestorObj.name = result.name;
    let ancestors = [];
    ancestors.push(parentAncestorObj);
    ancestors = [...(ancestors || []), ...(result.ancestors || [])];
    return ancestors;
  });
};

commonHelper.prototype.populateCollectionItems = function(key, itemIdList) {
  itemIdList = itemIdList || [];
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
  conditions = require('../lib/clientHandler').addClientFilterToConditions(conditions);
  return model.find(conditions).then(result =>
    result
      .map(item => ({
        id: item._id,
        name: item.name,
        sysDefined: item.sysDefined || 0
      }))
      .sort((a, b) => itemIdList.indexOf(a.id) - itemIdList.indexOf(b.id))
  );
};

commonHelper.prototype.populateSingleLocation = function(id, moveSysAttrs = false) {
  const locationHelper = require('./core/location');
  return locationHelper
    .getById(id, moveSysAttrs)
    .then(result => {
      if (result.status !== 0) {
        return result;
      }
      return bluebirdPromise.reject('inactive-location');
    })
    .catch(reason => {
      if (reason === 'inactive-location') {
        return bluebirdPromise.reject(reason);
      }
      return {};
    });
};

commonHelper.prototype.populateSingleZone = function(id, moveSysAttrs = false) {
  const zoneHelper = require('./core/zone');
  return zoneHelper
    .getById(id, moveSysAttrs)
    .then(result => {
      if (result.status !== 0) {
        return result;
      }
      return bluebirdPromise.reject('inactive-zone');
    })
    .catch(reason => {
      if (reason === 'inactive-zone') {
        return bluebirdPromise.reject(reason);
      }
      return {};
    });
};

commonHelper.prototype.populateSingleFloor = function(id, moveSysAttrs = false) {
  const floorHelper = require('./core/floor');
  return floorHelper
    .getById(id, moveSysAttrs)
    .then(result => {
      if (result.status !== 0) {
        return result;
      }
      return bluebirdPromise.reject('inactive-floor');
    })
    .catch(reason => {
      if (reason === 'inactive-floor') {
        return bluebirdPromise.reject(reason);
      }
      return {};
    });
};

commonHelper.prototype.findDependencyCount = function(key, id) {
  const dependencyJson = require('./modelDependency.json');
  let dependents;
  if (key === 'tags') {
    dependents = dependencyJson.dependencies.tag[0].dependentModels;
  }
  if (key === 'attributes') {
    dependents = dependencyJson.dependencies.attribute[0].dependentModels;
  }
  if (key === 'categories') {
    dependents = dependencyJson.dependencies.category[0].dependentModels;
  }
  if (key === 'things') {
    dependents = dependencyJson.dependencies.thing[0].dependentModels;
  }
  if (key === 'products') {
    dependents = dependencyJson.dependencies.product[0].dependentModels;
  }
  if (key === 'locations') {
    dependents = dependencyJson.dependencies.location[0].dependentModels;
  }
  const condition = [];
  const check = [];
  for (const i in dependents) {
    if (dependents.hasOwnProperty(i)) {
      let model;
      condition[i] = [];
      model = require(`../models/${dependencyJson.collectionModelMapping[i]}`);
      for (let j = 0; j < dependents[i].length; j++) {
        condition[i][j] = {};
        condition[i][j][`${dependents[i][j]}.id`] = mongoose.Types.ObjectId(id);
      }

      check.push({
        model,
        modelName: i,
        conditions: { $or: condition[i] }
      });
    }
  }

  for (let i = 0; i < check.length; i++) {
    // console.log(`modelName${check[i].modelName}`);
    // console.log(`conditions${JSON.stringify(check[i].conditions)}`);
  }
  return bluebirdPromise
    .map(check, item => item.model.count(item.conditions).exec())
    .then(res => res.reduce((sum, item) => sum + item, 0));
};

commonHelper.prototype.getLambdaArn = function() {
  const authjson = require('../mappings/authJson.json');
  const httpMethods = ['Get', 'Post', 'Put'];
  Object.keys(authjson).forEach(compName => {
    httpMethods.forEach(method => {
      const arnList = authjson[compName][method].arn;
      authjson[compName][method].arn = [];
      arnList.forEach(arn => {
        const a = `arn:aws:lambda:${process.env.region}:${process.env
          .accountNo}:function:${arn}:${process.env.stage}`;
        authjson[compName][method].arn.push(a);
      });
    });
  });
  return bluebirdPromise.resolve(authjson);
};

commonHelper.prototype.getGatewayArn = function({ component, verb, resource, stage, restApiId }) {
  if (!restApiId) {
    return;
  }
  if (!resource) {
    resource = '*';
  }
  let cleanedResource = resource;

  if (resource.substring(0, 1) === '/') {
    cleanedResource = resource.substring(1, resource.length);
  }

  if (!stage) {
    stage = process.env.stage;
  }
  const arn = `arn:aws:execute-api:${process.env.region}:${process.env
    .accountNo}:${restApiId}/${stage}/${verb}/${cleanedResource}`;
  // arn = `${restApiId}/${stage}/${verb}/${cleanedResource}`;
  return arn;
};

commonHelper.prototype.getUserPoolArn = function({ userpoolId }) {
  const arn = `arn:aws:cognito-idp:${process.env.region}:${process.env
    .accountNo}:userpool/${userpoolId}`;
  return arn;
};

commonHelper.prototype.getCurrentLocationString = function(currentLocationObj = {}) {
  const locationData = [];
  const locationName = currentLocationObj.name || '';
  if (!locationName) {
    const locAttrs = currentLocationObj.address || [];
    const locAttrObj = locAttrs.reduce((result, x) => {
      const obj = {};
      obj[x.name] = x.value;
      return Object.assign({}, result, obj);
    }, {});
    if (locAttrs.length > 0) {
      if (locAttrObj.address) {
        locationData.push(locAttrObj.address);
      }
      if (locAttrObj.city) {
        locationData.push(locAttrObj.city);
      }
      if (locAttrObj.state) {
        locationData.push(locAttrObj.state);
      }
      if (locAttrObj.country) {
        locationData.push(locAttrObj.country);
      }
    }
  } else {
    locationData.push(locationName);
  }
  return locationData.join(', ');
};
module.exports = new commonHelper();
