const modelDependency = require('./modelDependency.json');
const mongoose = require('mongoose');

const modelMapping = modelDependency.collectionModelMapping;
const modelDir = '../models/';
const commonHelper = require('./common');
const bluebirdPromise = require('bluebird');
const currentUserHandler = require('../lib/currentUserHandler');

let changedCollection = '';
/**
 * Propagate Changes among dependent collections
 * 
 * @param {string} hook 
 * @param {string} event 
 * @param {object} emmitter 
 * @param {string} collection 
 */
module.exports.propagate = function({ hook, collection, result }) {
  result = commonHelper.deepCloneObject(result);
  changedCollection = collection;
  if (!result) {
    // console.log('Propogation Helper: No data changed or nothing passed in result');
    return bluebirdPromise.reject('No result passed');
  }
  const dependentCollections = modelDependency.dependencies[collection];
  if (!dependentCollections) {
    return bluebirdPromise.resolve();
  }
  const hookSpecificDependents = dependentCollections.filter(obj => obj.hook === hook);

  return bluebirdPromise
    .each(hookSpecificDependents, dependents =>
      bluebirdPromise.each(Object.keys(dependents.dependentModels), collection => {
        const keys = dependents.dependentModels[collection];
        const modelPath = modelMapping[collection];
        if (dependents.keyMap) {
          result = this.keyMapRes(result, dependents.keyMap);
        }
        return this.update(result, keys, modelPath, dependents);
      })
    )
    .then(() => {
      if (modelDependency.interRelation[collection]) {
        return this.interRelatedSolution(result, modelDependency.interRelation[collection]);
      }
      return bluebirdPromise.resolve();
    })
    .catch(err => {
      // console.log('Propogation promise error catch');
      // console.log(err);
    });
};

/**
 * Update the dependent collections based on new data
 * 
 * @param {object} changedData 
 * @param {array} keys 
 * @param {string} modelPath 
 */

module.exports.update = function(changedData, keys, modelPath, dependents) {
  const model = require(modelDir + modelPath);
  const keysinChangedData = Object.keys(changedData);

  const keysToMatch = dependents.keysToMatch;
  // // console.log(dependents);
  // // console.log('KeysToMatch---' + JSON.stringify(keysToMatch || {}));
  const type = dependents.type;
  // // console.log('dependents.type---' + dependents.type);

  return bluebirdPromise.each(keys, key => {
    const searchParams = {};
    const sKey = key
      .replace('$.', '')
      .replace('0.', '')
      .replace('1.', '');

    if (keysToMatch && Object.keys(keysToMatch).length > 0) {
      for (const i in keysToMatch) {
        if (i) {
          searchParams[`${sKey}.${keysToMatch[i]}`] = changedData[i];
        }
      }
    } else {
      searchParams[`${sKey}.id`] = changedData._id;
    }
    // // console.log(`searchParams---${JSON.stringify(searchParams || {})}`);
    // mongoose.set('debug', true);
    return model
      .findOne(searchParams)
      .exec()
      .then(res => {
        if (res) {
          res = commonHelper.deepCloneObject(res);
          let obj = this.getObjectAtIndex(res, key);
          if (Array.isArray(obj)) {
            obj = obj[0];
          }
          const keysinObject = Object.keys(obj);
          const keysToUpdate = commonHelper.getArrayIntersection(keysinChangedData, keysinObject);
          let updateObj = {};
          // if (key === 'product' || key === 'thing') {
          updateObj = this.getUpdateObject({
            changedData,
            keysToUpdate,
            embeddedInKey: key,
            type
          });
          // // console.log(`${modelPath}     ${JSON.stringify(updateObj)}`);
          // } else {
          //   updateObj = this.getUpdateObject({
          //     changedData: changedData,
          //     keysToUpdate: keysToUpdate,
          //     embeddedInKey: key
          //   });
          // }
          return model.update(searchParams, updateObj, { upsert: false, multi: true });
        }
      })
      .then(updateRes => {
        if (updateRes) {
          // console.log(
          //  `Propagation Helper: Update object Result modelPath: ${modelPath} changedCollection: ${changedCollection}`
          // /          );
          // console.log(updateRes);
        }
        return bluebirdPromise.resolve();
      })
      .catch(err => 
        // console.log('Propogation helper error in update');
        // console.log(err);
         bluebirdPromise.reject(err)
      );
  });
};

/**
 * Generate update object for mongodb update query
 * 
 * @param {object} changedData 
 * @param {array} keysToUpdate 
 * @param {string} embeddedInKey 
 * @param {string} [type='array'] 
 * @param {string} [query='set'] 
 * @returns 
 */

module.exports.getUpdateObject = function({
  changedData,
  keysToUpdate,
  embeddedInKey,
  type = 'array',
  query = 'set',
  keyToEmbed = undefined
}) {
  // // console.log(`${keysToUpdate}     ${embeddedInKey}`);
  // // console.log(`${type}     ${query}`);
  let updateObj = {};
  if (type === 'array') {
    keysToUpdate.forEach(key => {
      updateObj[`${embeddedInKey}.$.${key}`] = changedData[key];
    });
  } else if (type === 'object') {
    keysToUpdate.forEach(key => {
      updateObj[`${embeddedInKey}.${key}`] = changedData[key];
    });
  } else if (type === 'string') {
    updateObj[embeddedInKey] = changedData[keyToEmbed];
  }
  if (query === 'push' && type === 'array') {
    updateObj = {};
    updateObj.$push = {};
    updateObj.$push[embeddedInKey] = {};
    keysToUpdate.forEach(key => {
      updateObj.$push[embeddedInKey][key] = changedData[key];
    });
    updateObj.$set = {
      updatedBy: currentUserHandler.getCurrentUser(),
      updatedOn: Date.now()
    };
    return updateObj;
  }
  updateObj.updatedBy = currentUserHandler.getCurrentUser();
  updateObj.updatedOn = Date.now();
  return { $set: updateObj };
};

/**
 * Get data at specific index in multi dimensional object specified by a dot notation string key
 * 
 * @param {object} data 
 * @param {string} keyString 
 * @returns 
 */

module.exports.getObjectAtIndex = function(data, keyString) {
  keyString = keyString
    .replace('$.', '')
    .replace('0.', '')
    .replace('1.', '');
  const keySplit = keyString.split('.');
  let returnObject = data;
  keySplit.forEach(key => {
    // // console.log(`${key}          ${returnObject}`);
    if (Array.isArray(returnObject)) {
      returnObject = returnObject[0][key];
    } else {
      returnObject = (returnObject || {})[key];
    }
  });
  return returnObject;
};

/**
 * Key mapping between two different dependent collections
 * 
 * @param {object} data 
 * @param {object} keyMap 
 * @returns 
 */

module.exports.keyMapRes = function(data, keyMap) {
  for (const i in keyMap) {
    if (i) {
      data[keyMap[i]] = data[i];
    }
  }
  return data;
};

/**
 * Resolve reference between different collections
 * 
 * @param {object} changedData 
 * @param {object} interRelated 
 * @returns 
 */

module.exports.interRelatedSolution = function(changedData, interRelated) {
  if (!interRelated) {
    return bluebirdPromise.resolve('No References specified');
  }
  for (const i in interRelated.dependentModels) {
    if (i) {
      const modelPath = modelMapping[i];
      const model = require(modelDir + modelPath);
      const obj = interRelated.dependentModels[i];
      if (obj.keyMap) {
        changedData = this.keyMapRes(changedData, obj.keyMap);
      }
      const sourceObject = this.getObjectAtIndex(changedData, obj.sourceKey);
      const updateObj = this.getUpdateObject({
        changedData,
        keysToUpdate: obj.keysToSave,
        embeddedInKey: obj.EmbedInkey,
        type: obj.type,
        query: 'push',
        keyToEmbed: obj.keyToEmbed
      });
      return this.removePreviousEntries(changedData, model, obj.EmbedInkey, obj.type)
        .then(() => this.referenceUpdate(sourceObject, updateObj, model))
        .catch(err => 
          // console.log('Propagation Helper: Interrelated solution error');
          // console.log(err);
           bluebirdPromise.reject(err)
        );
    }
  }
};

/**
 * Update the inter related collections reference
 * 
 * @param {object} sourceObject 
 * @param {object} updateObj 
 * @param {object} model 
 * @returns 
 */

module.exports.referenceUpdate = function(sourceObject, updateObj, model) {
  if (Array.isArray(sourceObject)) {
    return bluebirdPromise.each(sourceObject, sObj => {
      const searchParams = { _id: sObj.id };
      return model
        .update(searchParams, updateObj, { upsert: false, multi: true })
        .exec()
        .then(res => 
          // console.log('Propagation Helper: Source Array update references=======');
          // console.log(res);
           bluebirdPromise.resolve(res)
        );
    });
  } else if (typeof sourceObject === typeof {}) {
    const searchParams = { _id: sourceObject.id };
    return model
      .update(searchParams, updateObj, { upsert: false, multi: true })
      .exec()
      .then(res => 
        // console.log('Propagation Helper: Source Object update references=======');
        // console.log(res);
         bluebirdPromise.resolve(res)
      );
  }
};

/**
 * On update of reference between two collections remove the previous reference data
 * 
 * @param {object} changedData 
 * @param {object} model 
 * @param {string} embeddedInKey 
 * @param {string} [type='object'] 
 * @returns 
 */
module.exports.removePreviousEntries = function(
  changedData,
  model,
  embeddedInKey,
  type = 'object'
) {
  const searchParams = {};
  searchParams[`${embeddedInKey}.id`] = changedData._id;
  if (type === 'array') {
    const pullQuery = {};
    pullQuery.$pull = {};
    pullQuery.$pull[embeddedInKey] = { id: changedData._id };
    pullQuery.$set = {
      updatedBy: currentUserHandler.getCurrentUser(),
      updatedOn: Date.now()
    };

    return model
      .update(searchParams, pullQuery, { upsert: false, multi: true })
      .exec()
      .then(res => 
        // console.log('Propagation Helper: pullObjectFromArray');
        // console.log(res);
         bluebirdPromise.resolve(res)
      );
  }
  const unsetQuery = {};
  unsetQuery.$set = {};
  unsetQuery.$set[embeddedInKey] = {};
  if (type === 'string') {
    unsetQuery.$set[embeddedInKey] = '';
  }
  return model
    .update(searchParams, unsetQuery, { upsert: false, multi: true })
    .exec()
    .then(res => 
      // console.log('Propagation Helper: removeObject');
      // console.log(res);
       bluebirdPromise.resolve(res)
    );
};
