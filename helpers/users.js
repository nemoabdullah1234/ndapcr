const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');
const usermodel = require('../models/users');
const thingsHelper = require('../helpers/things');
const validator = require('../lib/validatorAsync');
const akUtils = require('../lib/utility');
const jsTypeChecker = require('javascript-type-checker');
const mongoose = require('mongoose');
const bluebirdPromise = require('bluebird');
const commonHelper = require('./common');
const AWS = require('aws-sdk');
const CognitoSDK = require('amazon-cognito-identity-js-node');

const client = clientHandler.getClient();
const userPoolId = process.env.cognitoUserpoolId;

AWS.CognitoIdentityServiceProvider.CognitoUserPool = CognitoSDK.CognitoUserPool;
// const AWSCognito = new CognitoSDK
const cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider({
  apiVersion: '2016-04-18',
  accessKeyId: process.env.accessKeyId,
  secretAccessKey: process.env.secretAccessKey
});
const cognitoUserpool = new AWS.CognitoIdentityServiceProvider.CognitoUserPool({
  UserPoolId: process.env.cognitoUserpoolId,
  ClientId: process.env.cognitoClientId
});

// promisifiedFunctions
const updateUser = bluebirdPromise.promisify(
  cognitoidentityserviceprovider.adminUpdateUserAttributes.bind(cognitoidentityserviceprovider)
);
const disableUser = bluebirdPromise.promisify(
  cognitoidentityserviceprovider.adminDisableUser.bind(cognitoidentityserviceprovider)
);
const enableUser = bluebirdPromise.promisify(
  cognitoidentityserviceprovider.adminEnableUser.bind(cognitoidentityserviceprovider)
);
const addToGroup = bluebirdPromise.promisify(
  cognitoidentityserviceprovider.adminAddUserToGroup.bind(cognitoidentityserviceprovider)
);
const removeFromGroup = bluebirdPromise.promisify(
  cognitoidentityserviceprovider.adminRemoveUserFromGroup.bind(cognitoidentityserviceprovider)
);
const getUser = bluebirdPromise.promisify(
  cognitoidentityserviceprovider.adminGetUser.bind(cognitoidentityserviceprovider)
);
const registerUser = bluebirdPromise.promisify(cognitoUserpool.signUp.bind(cognitoUserpool));
const updateUserAttributes = bluebirdPromise.promisify(
  cognitoidentityserviceprovider.updateUserAttributes.bind(cognitoidentityserviceprovider)
);
// const search = require('../services/search');

const userService = function() {};

/**
 * Set client of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
userService.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

/**
 * Set headers of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
userService.prototype.setHeaders = function(headers) {
  this.headers = headers;
};

/**
 * Set headers of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
userService.prototype.setConfigs = function() {
  // console.log('config');
  return require('./configuration')
    .getConfigurations()
    .then(configs => {
      this.configs = configs;
    });
};
/**
 * Query the database to fetch users on the basis of search parameters and other parameters
 * 
 * @param {Object} searchParams search filters
 * @param {Object} otherParams pagination, sorting etc other params.
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
userService.prototype.get = function(searchParams, otherParams) {
  akUtils.log(otherParams, 'searchParams');
  return usermodel
    .find(searchParams)
    .sort(otherParams.sort)
    .skip(otherParams.pageParams.offset)
    .limit(otherParams.pageParams.limit)
    .collation({
      locale: 'en_US',
      caseLevel: false
    })
    .exec()
    .then(result => {
      const list = [];
      if (result) {
        for (let i = 0; i < result.length; i++) {
          list.push(this.formatResponse(result[i], otherParams.isDropdown));
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

/**
 * Fetch a particular user by providing its ID
 * 
 * @param {String} userId ID of the user to Fetch
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
userService.prototype.getById = function(userId = 'default') {
  // if (!mongoose.Types.ObjectId.isValid(userId)) {
  //   return bluebirdPromise.reject();
  // }
  // if (!forSearch) {
  //   return search.searchById('users', userId + "");
  // } else {
  let conditions = {
    sub: userId
  };
  conditions = clientHandler.addClientFilterToConditions(conditions);

  return usermodel
    .find(conditions)
    .exec()
    .then(result => {
      if (result.length > 0) {
        return bluebirdPromise.resolve(this.formatResponse(result[0]));
      }
      return bluebirdPromise.reject();
    });
  // }
};

/**
 * Fetch a particular user by providing its Code
 * 
 * @param {String} code Code of the user to Fetch
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
userService.prototype.getByCode = function(code = '') {
  let conditions = {
    code
  };
  conditions = clientHandler.addClientFilterToConditions(conditions);

  return usermodel
    .find(conditions)
    .exec()
    .then(result => {
      if (result.length > 0) {
        return bluebirdPromise.resolve(this.formatResponse(result[0]));
      }
      return bluebirdPromise.reject();
    });
};

/**
 * Count users on the basis of some search conditions.
 * 
 * @param {Object} searchParams Search Conditions
 * @return {Promise<Number>} Number of matching users.
 * 
 */
userService.prototype.count = function(searchParams = {}) {
  return usermodel.count(searchParams).exec();
};

/**
 * Performs response from DB operations to return as API response.
 * 
 * @param {Object} data Database operation result.
 * @param {Boolean} isDropdown Whether the APi is requesting a dropdown.
 * @return {Promise} formattedResponse Formatted Response
 * 
 */
userService.prototype.formatResponse = function(data, isDropdown = false) {
  let formattedResponse = {};
  if (!isDropdown) {
    formattedResponse = commonHelper.deepCloneObject(data);
    formattedResponse.id = data._id;
    delete formattedResponse._id;
    delete formattedResponse.__v;
    return formattedResponse;
  }
  formattedResponse.id = data._id;
  formattedResponse.sub = data.sub;
  formattedResponse.name = `${data.given_name} ${data.family_name}`;
  return formattedResponse;
};

/**
 * Map keys for sorting.
 * 
 * @param {String} key
 * @return {String} 
 * 
 */
userService.prototype.getColumnMap = function getColumnMap(key) {
  const map = {
    id: '_id',
    given_name: 'given_name',
    family_name: 'family_name',
    email: 'email',
    updatedOn: 'updatedOn',
    updatedBy: 'updatedBy',
    status: 'UserStatus',
    isadminapproved: 'isAdminApproved',
    updatedAt: 'UserLastModifiedDate',
    isActive: 'Enabled',
    group: 'groups.name'
  };

  if (key) {
    return map[key] || key;
  }
  return map;
};

/**
 * Generate the search conditions for the GET operation.
 * 
 * @param {Object} event Lambda Event
 * @return {Object} filters.
 * 
 */
userService.prototype.getFilterParams = function(event) {
  const filters = {};
  // filters = clientHandler.addClientFilterToConditions(filters);
  if (event.queryStringParameters && event.queryStringParameters.filter) {
    // filters._all = event.queryStringParameters.filter;
    filters.$or = [
      {
        given_name: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        family_name: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        email: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        UserStatus: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'groups.name': new RegExp(event.queryStringParameters.filter, 'i')
      }
    ];
  }
  /* firstName=a&
  lastName=s&
  email=ss&
  modifiedFrom=2017-10-20T05:06:57Z
  &modifiedTo=2017-10-21T05:06:57Z
  &adminApproved=1
  &status=1 */

  if (event.queryStringParameters.firstName) {
    filters.given_name = new RegExp(event.queryStringParameters.firstName, 'i');
  }

  if (event.queryStringParameters.lastName) {
    filters.family_name = new RegExp(event.queryStringParameters.lastName, 'i');
  }

  if (event.queryStringParameters.email) {
    filters.email = new RegExp(event.queryStringParameters.email, 'i');
  }

  if (event.queryStringParameters.status) {
    filters.$or = [];
    filters.$or.push({ Enabled: event.queryStringParameters.status });
    if (event.queryStringParameters.status === '0') {
      filters.$or.push({ Enabled: { $exists: false } });
    }
  }
  if (event.queryStringParameters.adminApproved) {
    // filters.isAdminApproved = event.queryStringParameters.adminApproved === '1' ? 'yes' : 'no';
    filters.$or = [];
    filters.$or.push({
      isAdminApproved: event.queryStringParameters.adminApproved === '1' ? 'yes' : 'no'
    });
    if (event.queryStringParameters.adminApproved === '0') {
      filters.$or.push({ isAdminApproved: { $exists: false } });
    }
  }

  if (event.queryStringParameters.modifiedFrom || event.queryStringParameters.modifiedTo) {
    filters.UserLastModifiedDate = {};
  }

  if (event.queryStringParameters.modifiedFrom) {
    filters.UserLastModifiedDate.$gte = new Date(event.queryStringParameters.modifiedFrom);
  }

  if (event.queryStringParameters.modifiedTo) {
    filters.UserLastModifiedDate.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.modifiedTo)
    );
  }

  // if (request.queryStringParameters.status === "1" || request.queryStringParameters.status === "0") filters.status = request.queryStringParameters.status === "1";
  // if (event.queryStringParameters.dd === '1') {
  //   filters.status = 1;
  //   filters.sysDefined = 0;
  // }

  return filters;
};

/**
 * Generate the extra parameters for the GET operation like sorting, pagination etc.
 * 
 * @param {Object} request Lambda Event
 * @return {Object} extraParams
 * 
 */
userService.prototype.getExtraParams = function(event) {
  const params = {};
  params.sort = {};
  if (!event.queryStringParameters) {
    params.pageParams = {
      offset: 0,
      limit: 20
    };
    params.sort.updatedOn = -1;
    return params;
  }
  const dd = event.queryStringParameters.dd === '1';
  const offset = event.queryStringParameters.offset ? event.queryStringParameters.offset : 0;
  const limit = event.queryStringParameters.limit ? event.queryStringParameters.limit : 20;
  params.isDropdown = dd;
  params.pageParams = {
    offset: dd ? 0 : parseInt(offset, 10),
    limit: dd ? 65535 : parseInt(limit, 10)
  };
  if (event.queryStringParameters.sort) {
    const sortQuery = event.queryStringParameters.sort;
    const sortColumns = sortQuery.split(',');
    sortColumns.forEach(function(col) {
      let sortOrder = 1;
      col = col.trim();
      const isValidColumn = this.getColumnMap(col) || this.getColumnMap(col.replace('-', ''));
      if (isValidColumn) {
        if (col.startsWith('-')) {
          sortOrder = -1;
          col = col.replace('-', '');
        }

        col = this.getColumnMap(col);
        params.sort[col] = sortOrder;
      }
    }, this);
  } else {
    params.sort.family_name = 1;
  }

  return params;
};

/**
 * Performs validations common in both update and save.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
userService.prototype.commonValidations = function(event) {
  return bluebirdPromise.resolve();

  return bluebirdPromise
    .all([
      bluebirdPromise.all([
        validator.required(event.body.code),
        validator.stringLength(0, validator.CODE_MAX_LENGTH, event.body.code),
        validator.notDuplicate('users', 'code', event.body.code, event.pathParameters.id)
      ]),
      bluebirdPromise.all([
        validator.required(event.body.name),
        validator.stringLength(0, validator.NAME_MAX_LENGTH, event.body.name)
      ]),
      bluebirdPromise.all([validator.valueAllowed([0, 1], event.body.status)]),
      bluebirdPromise.all([
        validator.type('array', event.body.tags),
        validator.duplicateArrayElements(null, event.body.tags),
        validator.validatePopulatableLists('tags', event.body.tags),
        validator.arrayOfType('string', event.body.tags)
      ])
    ])
    .then(result => {
      const validatorErrorsMap = {
        code: {
          index: 0,
          fieldName: 'Code'
        },
        name: {
          index: 1,
          fieldName: 'Name'
        },
        status: {
          index: 2,
          fieldName: 'Status'
        },
        tags: {
          index: 3,
          fieldName: 'Tags'
        }
      };
      const errors = akUtils.mapAndGetValidationErrors(result, validatorErrorsMap);
      if (errors) {
        return bluebirdPromise.reject(errors);
      }
      return bluebirdPromise.resolve();
    });
};

/**
 * Performs update-specific validations before performing common validations.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
userService.prototype.validateUpdate = function(event) {
  return bluebirdPromise.resolve();
  let basicErrors;
  return this.commonValidations(event)
    .catch(errors => errors)
    .then(errorsIfAny => {
      basicErrors = errorsIfAny || {};
      return bluebirdPromise.all([
        bluebirdPromise.all([
          validator.elementExists('users', event.pathParameters.id),
          validator.notSysDefined('users', event.pathParameters.id),
          validator.deactivationCheck('users', event.body.status, event.pathParameters.id)
        ]),
        bluebirdPromise.all([
          validator.checkSame('users', 'code', event.body.code, event.pathParameters.id)
        ])
      ]);
    })
    .then(result => {
      const mapping = {
        global: {
          index: 0,
          fieldName: 'User'
        },
        code: {
          index: 1,
          fieldName: 'Code'
        }
      };
      const validationResult = akUtils.mapAndGetValidationErrors(result, mapping);
      const combinedErrors = Object.assign({}, basicErrors, validationResult);
      if (!jsTypeChecker.isEmptyObject(combinedErrors)) {
        return bluebirdPromise.reject(
          akUtils.getObjectValues(akUtils.sortErrorsObject(combinedErrors, 'users'))
        );
      }
      return bluebirdPromise.resolve();
    })
    .catch(errors => bluebirdPromise.reject(errors));
};

/**
 * Checks if a give code already exists in the database.
 * 
 * @param {String} code Code to check
 * @param {String} excludedObjId Object ID of current object if checking while update.
 * @return {Promise} Resolved promise if duplicate code. Rejected promise otherwise
 * 
 */
userService.prototype.isDuplicateCode = function(code = '', excludedObjId = null) {
  let conditions;
  if (excludedObjId !== null && mongoose.Types.ObjectId.isValid(excludedObjId)) {
    conditions = {
      code,
      _id: {
        $ne: mongoose.Types.ObjectId(excludedObjId)
      }
    };
  } else {
    conditions = {
      code
    };
  }
  conditions = clientHandler.addClientFilterToConditions(conditions);

  return usermodel
    .findOne(conditions)
    .exec()
    .then(result => {
      if (result) {
        return bluebirdPromise.resolve();
      }
      return bluebirdPromise.reject();
    });
};

userService.prototype.isDuplicate = function(field, value = '', excludedObjId = null) {
  let conditions = {};
  conditions[field] = value;
  if (excludedObjId !== null && mongoose.Types.ObjectId.isValid(excludedObjId)) {
    conditions._id = {
      $ne: mongoose.Types.ObjectId(excludedObjId)
    };
  }
  conditions = clientHandler.addClientFilterToConditions(conditions);

  return usermodel
    .findOne(conditions)
    .exec()
    .then(result => {
      if (result) {
        return bluebirdPromise.resolve();
      }
      return bluebirdPromise.reject();
    });
};
/**
 * Performs save-specific validations before performing common validations.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
userService.prototype.validateRequest = function(event) {
  return this.commonValidations(event)
    .then(() => {})
    .catch(errors => {
      if (!jsTypeChecker.isEmptyObject(errors)) {
        return bluebirdPromise.reject(
          akUtils.getObjectValues(akUtils.sortErrorsObject(errors, 'users'))
        );
      }
      return bluebirdPromise.resolve();
    });
};

/**
 * Save an user
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of save operation.
 * 
 */
userService.prototype.save = function save(event) {
  return bluebirdPromise
    .all([
      thingsHelper.getForPopulation(event.body.things || []).catch(e => {
        akUtils.log(e, 'userService.prototype.save thingsHelper.getForPopulation');
        return [];
      })
    ])
    .then(populationResult => {
      const userData = event.body;

      const createUser = bluebirdPromise.promisify(
        cognitoidentityserviceprovider.adminCreateUser.bind(cognitoidentityserviceprovider)
      );
      const addToGroup = bluebirdPromise.promisify(
        cognitoidentityserviceprovider.adminAddUserToGroup.bind(cognitoidentityserviceprovider)
      );

      delete userData.password;
      const userAttributes = this.convertToUserAttributes(userData);

      // verify email from admin end
      userAttributes.push({ Name: 'email_verified', Value: 'true' });

      const params = {
        DesiredDeliveryMediums: ['EMAIL'],
        UserPoolId: userPoolId,
        Username: userData.username.toLowerCase(),
        UserAttributes: userAttributes
      };

      return createUser(params)
        .then(result => {
          // console.log('++++++UserData+++++');
          // console.log(userData);
          if (
            !userData.groups ||
            !Array.isArray(userData.groups) ||
            (userData.groups || []).length === 0
          ) {
            return bluebirdPromise.resolve(result);
          }
          const groups = userData.groups || [];
          return bluebirdPromise
            .each(groups, group =>
              addToGroup({
                GroupName: group,
                UserPoolId: userPoolId,
                Username: result.User.Username
              })
            )
            .then(res => {
              // console.log(res);
              return bluebirdPromise.resolve(result);
            });
        })
        .then(result => {
          if (!userData.isActive) {
            const params = {
              UserPoolId: userPoolId,
              Username: userData.username.toLowerCase()
            };
            return disableUser(params).then(() => result);
          }
          return bluebirdPromise.resolve(result);
        })
        .then(result => {
          const user = this.convertToUsermodel(result);
          user.Enabled = userData.isActive;
          user.groups = (userData.groups || []).map(grp => ({
            name: grp
          }));
          const userObj = new usermodel(user);
          userObj.client = clientHandler.getClient();
          userObj.things = populationResult[0] || [];
          return userObj.save().then(() => bluebirdPromise.resolve(result));
        });
    });
};

/**
 * Send email if admin approved/disapprove user
 * 
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
userService.prototype.sendEmail = function(params, mailType) {
  const emailHelper = require('./emails');
  // console.log('User params: ');
  // console.log(params);

  if (mailType === 'userapproval') {
    const data = {
      adminUrl: process.env.adminurl,
      username: params.username,
      email: params.email,
      message: 'Your account has been approved.'
    };
    return emailHelper.sendEmail(
      data.email,
      'Your account has been approved',
      'user-approval-email',
      data
    );
  } else if (mailType === 'userdisapproval') {
    const data = {
      adminUrl: process.env.adminurl,
      username: params.username,
      email: params.email,
      message: 'Your account has been disapproved. Please contact admin for further support.'
    };
    return emailHelper.sendEmail(
      data.email,
      'Your account has been disapproved',
      'user-disapproval-email',
      data
    );
  }
};

/**
 * Update an user
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of update operation.
 * 
 */
userService.prototype.update = function(event) {
  return bluebirdPromise
    .all([
      thingsHelper.getForPopulation(event.body.things || []).catch(e => {
        akUtils.log(e, 'userService.prototype.save thingsHelper.getForPopulation');
        return [];
      })
    ])
    .then(populationResult => {
      const userData = event.body;

      delete userData.password;
      const userAttributes = this.convertToUserAttributes(userData);
      let userOldData = '';
      // verify email from admin end
      userAttributes.push({ Name: 'email_verified', Value: 'true' });

      let userExists = true;

      const params = {
        UserPoolId: userPoolId,
        Username: userData.username.toLowerCase(),
        UserAttributes: userAttributes
      };

      return updateUser(params).then(() =>
        usermodel
          .findOne({ Username: event.pathParameters.id })
          .then(userObj => {
            // console.log(userObj);
            if (!userObj) {
              userExists = false;
              return;
            }
            userOldData = userObj;
            const currentGroups = (userObj.groups || []).map(item => item.name);
            const newGroups = userData.groups;

            return bluebirdPromise
              .each(currentGroups, grp => {
                if ((newGroups || []).indexOf(grp) > -1) {
                  return undefined;
                }
                return removeFromGroup({
                  GroupName: grp /* required */,
                  UserPoolId: userPoolId /* required */,
                  Username: (userData.username || '').toLowerCase() /* required */
                });
              })
              .then(() =>
                bluebirdPromise.each(newGroups || [], grp => {
                  if ((currentGroups || []).indexOf(grp) > -1) {
                    return undefined;
                  }
                  return addToGroup({
                    GroupName: grp /* required */,
                    UserPoolId: userPoolId /* required */,
                    Username: (userData.username || '').toLowerCase() /* required */
                  });
                })
              )
              .then(() => {
                // console.log(userObj.Enabled);

                if (userObj.Enabled !== userData.isActive) {
                  const params = {
                    UserPoolId: userPoolId,
                    Username: userData.username.toLowerCase()
                  };
                  if (userData.isActive) {
                    return enableUser(params);
                  }
                  return disableUser(params);
                }
                return bluebirdPromise.resolve();
              });
          })
          .then(() =>
            getUser({
              UserPoolId: userPoolId,
              Username: userData.username.toLowerCase()
            })
          )
          .then(result => {
            const user = this.convertToUsermodel(result);
            if (event.body.things && Array.isArray(event.body.things)) {
              user.things = populationResult[0] || [];
            }
            user.groups = (userData.groups || []).map(grp => ({
              name: grp
            }));
            const updateParams = {
              $set: user
            };
            // if (!userExists) {
            //   updateParams.$setOnInsert = { __v: 1 };
            // } else {
            //   updateParams.$inc = { __v: 1 };
            // }
            return usermodel.findOneAndUpdate({ Username: event.pathParameters.id }, updateParams, {
              upsert: false,
              new: true
            });
          })
          .then(result => {
            // below block send email to user on approval/ disapproval
            let sendApprovalDisApprovalMail = false;
            let mailType = '';
            if (
              userData.isAdminApproved &&
              userOldData.isAdminApproved &&
              userData.isAdminApproved !== userOldData.isAdminApproved
            ) {
              sendApprovalDisApprovalMail = true;
              if (userData.isAdminApproved === 'yes') {
                mailType = 'userapproval';
              } else if (userData.isAdminApproved === 'no') {
                mailType = 'userdisapproval';
              }
            }
            // send email
            if (sendApprovalDisApprovalMail && mailType !== '') {
              return this.sendEmail(userData, mailType).then(() => result);
            }
            return bluebirdPromise.resolve(result);
          })
      );
    });
};

/**
 * Update an user
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of update operation.
 * 
 */
userService.prototype.register = function(event) {
  const userData = event.body;
  userData.email = userData.email.toLowerCase();
  const password = userData.password;

  delete userData.password;
  delete userData.isAdminApproved;

  const userAttributes = this.convertToUserAttributes(userData);

  // verify email from admin end
  userAttributes.push({ Name: 'custom:isAdminApproved', Value: 'no' });

  return registerUser(userData.email, password, userAttributes, null)
    .then(result => {
      akUtils.log(result, 'registerUser');

      const userObj = new usermodel(this.convertToUsermodel(userData));
      userObj.UserStatus = 'UNCONFIRMED';
      userObj.UserLastModifiedDate = new Date();
      userObj.UserCreateDate = new Date();
      akUtils.log(userObj, 'userObj');
      userObj.updatedBy = currentUserHandler.getCurrentUser();
      userObj.client = clientHandler.getClient();
      userObj.things = [];
      return userObj.save().then(() => bluebirdPromise.resolve(result));
    })
    .catch(err => bluebirdPromise.reject(err));
};

userService.prototype.convertToUserAttributes = function(userData) {
  const userAttributes = [];
  const validAttributes = [
    'title',
    'email',
    // 'password',
    'given_name',
    'family_name',
    'zoneinfo',
    'phone_number',
    'address',
    'city',
    'state',
    'country',
    'radius',
    'MobileNumber',
    'zipcode',
    'latitude',
    'longitude',
    'picture',
    'isAdminApproved',
    'MobileCode',
    'CountryCode'
  ];
  const customAttributes = [
    'city',
    'state',
    'country',
    'MobileNumber',
    'zipcode',
    'radius',
    'latitude',
    'longitude',
    'title',
    'isAdminApproved',
    'MobileCode',
    'CountryCode'
  ];
  let ckey = '';
  for (const key in userData) {
    if (validAttributes.indexOf(key) >= 0) {
      if (userData[key] === null || userData[key] === undefined) {
        userData[key] = '';
      }
      // check if custom attribute
      if (customAttributes.indexOf(key) >= 0) {
        ckey = `custom:${key}`;
      } else {
        ckey = key;
      }
      if (ckey === 'email') {
        userData[key] = userData[key].toLowerCase();
      }
      userAttributes.push({ Name: ckey, Value: String(userData[key]).trim() });
    }
  }
  return userAttributes;
};
userService.prototype.convertToUsermodel = function(userData) {
  userData = userData.User || userData;

  const attr = (userData.Attributes || userData.UserAttributes || []).reduce((a, b) => {
    a[b.Name.replace('custom:', '')] = b.Value;
    return a;
  }, {});
  attr.client = clientHandler.getClient();
  return Object.assign({}, userData, attr);
};

/**
 * Update an user
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of update operation.
 * 
 */
userService.prototype.updateProfile = function(event) {
  const username = (event.headers.authorizer || {})['cognito:username'];
  const sub = (event.headers.authorizer || {}).sub || '';
  const userData = event.body;

  delete userData.password;
  delete userData.isAdminApproved;

  const userAttributes = this.convertToUserAttributes(userData);

  // verify email from admin end
  const params = {
    AccessToken: event.headers.Authorization
      .split('::')
      .slice(-1)
      .pop() /* required */,
    UserAttributes: userAttributes
  };

  return updateUserAttributes(params)
    .then(result =>
      getUser({
        UserPoolId: userPoolId,
        Username: username
      })
    )
    .then(result => {
      const user = this.convertToUsermodel(result);
      user.updatedBy = currentUserHandler.getCurrentUser();
      user.client = clientHandler.getClient();
      const updateParams = {
        $set: user
      };
      updateParams.$inc = { __v: 1 };
      return usermodel.findOneAndUpdate({ sub }, updateParams, {
        upsert: false,
        new: true
      });
    });
};

userService.prototype.getUserTimeZone = function(uuid) {
  return usermodel
    .findOne(
      clientHandler.addClientFilterToConditions({
        sub: uuid
      })
    )
    .exec()
    .then(userdata => (userdata || {}).zoneinfo)
    .catch(e => {
      // console.log(e);
    })
    .then(result => result || 'UTC');
};
/**
 * Update an user
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of update operation.
 * 
 */
userService.prototype.updateOnTrigger = function(event) {
  // console.log('-------Update On Trigger---------');
  // console.log(JSON.stringify(event));

  let userData = event.request.userAttributes;
  userData = Object.getOwnPropertyNames(userData).reduce((tmp, key) => {
    if (key === 'cognito:user_status') {
      tmp.UserStatus = userData[key];
    } else {
      tmp[key.replace('custom:', '')] = userData[key];
    }
    return tmp;
  }, {});
  userData.client = clientHandler.getClient();
  userData.updatedBy = currentUserHandler.getCurrentUser();
  akUtils.log(clientHandler.getClient(), 'client');
  // console.log('userData');
  // console.log(userData);
  const updateParams = {
    $set: userData
  };

  updateParams.$inc = { __v: 1 };

  return usermodel
    .update({ Username: event.userName }, updateParams, {
      upsert: false,
      new: true
    })
    .then(res => {
      // console.log('db updated');
      // console.log(res);
      return res;
    })
    .catch(err => {
      // console.log('db update error');
      // console.log(err);
    });
};

userService.prototype.associateThingToUser = function(sub, thingCode) {
  // // console.log(thingCode);
  return thingsHelper
    .getByCode(thingCode)
    .then(
      result => {
        const thingToAssociate = {
          id: result.id,
          code: result.code,
          name: result.name,
          type: result.type
        };

        return usermodel.findOneAndUpdate(
          { sub },
          {
            $push: {
              things: thingToAssociate
            }
          }
        );
      },
      {
        new: true
      }
    )
    .catch(e => {
      akUtils.log(e, 'associateThingToUser');
    });
};

userService.prototype.disassociateThingFromUser = function(sub, thingCode) {
  return usermodel
    .findOneAndUpdate(
      { sub },
      {
        $pull: {
          things: {
            code: [thingCode]
          }
        }
      },
      {
        new: true
      }
    )
    .catch(e => {
      akUtils.log(e, 'disassociateThingFromUser');
    });
};

module.exports = new userService();
