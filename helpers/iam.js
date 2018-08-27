/* jshint esversion: 6 */

const bluebirdPromise = require('bluebird');
const aws = require('aws-sdk');
const restIdMap = require('../mappings/restIdMap.json');
const akUtils = require('../lib/utility');

const region = process.env.region;
const cognitoExtId = process.env.userpoolExternalId;
// const accountNo = process.env.accountNo;
const commonHelper = require('./common');

const httpVerbs = ['GET', 'PUT', 'POST'];
const iamHelper = function() {};

iamHelper.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

/**
 * Performs response from DB operations to return as API response.
 * 
 * @param {Object} data Database operation result.
 * @param {Boolean} isDropdown Whether the APi is requesting a dropdown.
 * @return {object} formattedResponse Formatted Response
 * 
 */
iamHelper.prototype.formatResponse = function formatResponse(data, formatType, extraData) {
  const formattedResponse = [];
  const dType = typeof data;
  let policydata = '';
  const versions = '';

  if (formatType === 'GetRolePolicy' && dType === 'object') {
    policydata = decodeURIComponent(data.PolicyDocument);

    if (typeof policydata === 'string') {
      policydata = JSON.parse(policydata);
    }

    formattedResponse.push(policydata);
  }

  return formattedResponse;
};

iamHelper.prototype.saveGroupPolicy = function saveGroupPolicy(modules, roleName, userPoolId) {
  const iam = new aws.IAM({
    apiVersion: '2010-05-08'
  });
  const allowedResources = [];
  const deniedResources = [];
  const map = restIdMap.restApi;

  modules = modules.reduce((result, item) => {
    result[item.name] = item.resources.reduce((result, obj) => {
      const verbs = ((map[item.name] || {})[obj.componentName] || {}).httpVerb || httpVerbs;
      result[obj.componentName] = {};
      (verbs || []).forEach(verb => {
        result[obj.componentName][verb] = obj[verb.toLowerCase()];
      });
      // result[obj.componentName].GET = obj.get;
      // result[obj.componentName].PUT = obj.put;
      // result[obj.componentName].POST = obj.post;
      // result[obj.componentName].DELETE = obj.delete;
      return result;
    }, {});
    return result;
  }, {});

  Object.getOwnPropertyNames(modules).forEach(key => {
    if (['userpool'].indexOf(key) > -1) {
      return;
    }
    Object.getOwnPropertyNames(modules[key]).forEach(component => {
      if (!map[key][component] || (map[key][component].id || '') === '') {
        return;
      }
      const methods = modules[key][component];
      for (const verb in methods) {
        if (methods.hasOwnProperty(verb)) {
          const arn = commonHelper.getGatewayArn({
            component,
            verb,
            stage: '*',
            restApiId: map[key][component].id,
            resource: map[key][component].resource
          });
          if (methods[verb]) {
            allowedResources.push(arn);
          } else {
            deniedResources.push(arn);
          }
        }
      }
    });
  });
  const optionsAllow = commonHelper.getGatewayArn({
    component: '*',
    verb: 'OPTIONS',
    stage: '*',
    restApiId: '*',
    resource: '*'
  });
  allowedResources.push(optionsAllow);

  const PolicyDocument = {
    Version: '2012-10-17',
    Statement: []
  };

  if (allowedResources && allowedResources.length) {
    const allowedResourcesStatement = {
      Sid: 'MasterAllow',
      Effect: 'Allow',
      Action: ['execute-api:Invoke'],
      Resource: allowedResources
    };
    PolicyDocument.Statement.push(allowedResourcesStatement);
  }
  // if (deniedResources && deniedResources.length) {
  //   const deniedResourcesStatement = {
  //     Sid: 'MasterDeny',
  //     Effect: 'Deny',
  //     Action: ['execute-api:Invoke'],
  //     Resource: deniedResources
  //   };
  //   PolicyDocument.Statement.push(deniedResourcesStatement);
  // }

  // Cognito Access policy
  let allowUserpool = false;
  if (modules.userpool) {
    Object.getOwnPropertyNames(modules.userpool.Userpool).forEach(component => {
      if (component !== 'OPTIONS') {
        allowUserpool = modules.userpool.Userpool[component] || allowUserpool;
      }
    });
  }
  if (roleName === akUtils.getRoleFromGroupName(process.env.adminGroupName)) {
    allowUserpool = true;
  }
  const userPoolResourcesStatement = {
    Sid: 'Userpool',
    Effect: allowUserpool === true ? 'Allow' : 'Deny',
    Action: ['cognito-idp:*'],
    Resource: commonHelper.getUserPoolArn({ userpoolId: userPoolId })
  };
  PolicyDocument.Statement.push(userPoolResourcesStatement);

  const params = {
    PolicyDocument: JSON.stringify(PolicyDocument),
    PolicyName: akUtils.getPolicyFromRoleName(roleName),
    RoleName: roleName
  };

  const promisifiedFunction = bluebirdPromise.promisify(iam.putRolePolicy.bind(iam));
  return promisifiedFunction(params);
};

iamHelper.prototype.getRolePolicy = function getRolePolicy(policyData) {
  const params = {
    PolicyName: akUtils.getPolicyFromRoleName(policyData.roleName) /* required */,
    RoleName: policyData.roleName /* required */
  };
  // console.log(params);
  const iam = new aws.IAM({
    apiVersion: '2010-05-08'
  });
  const promisifiedFunction = bluebirdPromise.promisify(iam.getRolePolicy.bind(iam));
  return promisifiedFunction(params)
    .then(data => {
      const policydata = this.formatResponse(data, 'GetRolePolicy');
      const response = {};
      response.roleName = policyData.roleName;
      response.modules = this.formatPolicyResponse({
        policyData: policydata,
        roleName: policyData.roleName
      });

      return bluebirdPromise.resolve(response);
    })
    .catch(error => bluebirdPromise.reject(error));
};

iamHelper.prototype.validateGroupPostRequest = function validateGroupPostRequest(req) {
  return new bluebirdPromise((resolve, reject) => {
    const errors = [];
    if (
      typeof req.body.groupName === 'undefined' ||
      req.body.groupName === null ||
      req.body.groupName === ''
    ) {
      errors.push({ errorCode: 5001, message: 'Group name be empty' });
    }
    if (
      typeof req.body.userPoolId === 'undefined' ||
      req.body.userPoolId === null ||
      req.body.userPoolId === ''
    ) {
      errors.push({ errorCode: 5002, message: 'UserPoolId cannot be empty' });
    }

    if (errors.length === 0) {
      resolve();
    } else {
      const validation = new Error();
      validation.errors = errors;
      reject(validation);
    }
  });
};

iamHelper.prototype.createGroup = function createGroup(req) {
  return new bluebirdPromise((resolve, reject) => {
    const groupName = req.body.groupName;
    const userPoolId = req.body.userPoolId;
    const description = req.body.description;
    const precedence = req.body.precedence;

    // create group here
    const cognitoidentityserviceprovider = new aws.CognitoIdentityServiceProvider();
    const groupParams = {
      GroupName: groupName /* required */,
      UserPoolId: userPoolId /* required */,
      Description: description,
      Precedence: parseInt(precedence, 10) || 0
    };

    cognitoidentityserviceprovider.createGroup(groupParams, (err, data) => {
      if (err) {
        reject(err);
      } else {
        const iam = new aws.IAM({
          apiVersion: '2010-05-08'
        });

        // create role here

        const trustPolicy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: {
                Service: 'lambda.amazonaws.com'
              },
              Action: 'sts:AssumeRole'
            },
            {
              Effect: 'Allow',
              Principal: {
                Federated: 'cognito-identity.amazonaws.com'
              },
              Action: 'sts:AssumeRoleWithWebIdentity',
              Condition: {
                StringEquals: {
                  'cognito-identity.amazonaws.com:aud': `${region}:${cognitoExtId}`
                },
                'ForAnyValue:StringLike': {
                  'cognito-identity.amazonaws.com:amr': 'authenticated'
                }
              }
            }
          ]
        };

        const roleParams = {
          AssumeRolePolicyDocument: JSON.stringify(trustPolicy),
          Path: '/',
          RoleName: akUtils.getRoleFromGroupName(groupName)
        };
        iam.createRole(roleParams, (err, data) => {
          if (err) {
            reject(err);
          } else {
            // create inline policy here
            const PolicyDocument = {
              Version: '2012-10-17',
              Statement: []
            };
            const deniedResourcesStatement = {
              Sid: 'MasterDeny',
              Effect: 'Deny',
              Action: ['lambda:InvokeFunction'],
              Resource: '*'
            };
            PolicyDocument.Statement.push(deniedResourcesStatement);

            const inlinePolicyParams = {
              PolicyDocument: JSON.stringify(PolicyDocument),
              PolicyName: akUtils.getPolicyFromRoleName(data.Role.RoleName),
              RoleName: data.Role.RoleName
            };

            const roleArn = data.Role.Arn;
            const roleName = data.Role.RoleName;

            iam.putRolePolicy(inlinePolicyParams, (err, data) => {
              if (err) {
                reject(err);
              } else {
                // update group role arn here
                resolve(data);
                const groupUpdateParams = {
                  GroupName: groupName /* required */,
                  UserPoolId: userPoolId /* required */,
                  RoleArn: roleArn
                };
                cognitoidentityserviceprovider.updateGroup(groupUpdateParams, (err, data) => {
                  if (err) {
                    reject(err);
                  } else {
                    const params = {
                      PolicyArn: 'arn:aws:iam::aws:policy/AWSIoTDataAccess',
                      RoleName: roleName
                    };
                    akUtils.log(params, 'IOT access policy params');
                    iam.attachRolePolicy(params, (err, data) => {
                      if (err) {
                        reject(err);
                      } else {
                        resolve(data);
                      }
                    });
                    resolve(data);
                  }
                });
              }
            });
          }
        });
      }
    });
  });
};

iamHelper.prototype.formatPolicyResponse = function formatPolicyResponse({ policyData, roleName }) {
  let allowedResources = [];
  let deniedResources = [];
  const response = [];
  const map = restIdMap.restApi;

  if (typeof policyData === 'string') {
    policyData = JSON.parse(policyData);
  }
  policyData.forEach(policy => {
    const filteredStatements = policy.Statement.filter(
      statement => statement.Action.indexOf('execute-api:Invoke') > -1
    );

    filteredStatements.forEach(st => {
      if (st.Effect === 'Allow') {
        allowedResources = allowedResources.concat(st.Resource);
      } else {
        deniedResources = deniedResources.concat(st.Resource);
      }
    });
  });

  // Rest Api Policy Mapping and static hardcoded data. Response formatting.
  Object.getOwnPropertyNames(map).forEach(name => {
    const temp = {};
    temp.name = name;
    temp.resources = [];
    Object.getOwnPropertyNames(map[name]).forEach(component => {
      const restApiId = map[name][component].id;
      let resource = map[name][component].resource || '*';

      if (resource.substring(0, 1) === '/') {
        resource = resource.substring(1, resource.length);
      }

      const resPolicy = {};
      resPolicy.componentName = component;
      const verbs = httpVerbs; // map[name][component].httpVerb || httpVerbs;

      const allowedVerb = allowedResources
        .filter(res => {
          const tmp = res.split(':');
          const apiGatewayArnTmp = tmp[5].split('/');

          const stage = apiGatewayArnTmp[1];
          const arnResource = apiGatewayArnTmp.slice(3).join('/');
          return (
            apiGatewayArnTmp[2] !== 'OPTIONS' &&
            apiGatewayArnTmp[0] === restApiId &&
            arnResource === resource
          );
        })
        .map(arn => {
          const tmp = arn.split(':');
          const apiGatewayArnTmp = tmp[5].split('/');
          return apiGatewayArnTmp[2];
        });

      verbs.forEach(verb => {
        resPolicy[verb.toLowerCase()] = allowedVerb.indexOf(verb) > -1;
      });

      temp.resources.push(resPolicy);
    });
    // }
    response.push(temp);
  });

  // UserPool Permissions
  let userPoolPermission = false;

  policyData.forEach(policy => {
    const cognitoPolicy = policy.Statement.filter(
      statement => statement.Action.indexOf('cognito-idp:*') > -1
    );

    cognitoPolicy.forEach(cPolicy => {
      userPoolPermission = cPolicy.Effect === 'Allow' || userPoolPermission;
    });
  });
  const userpool = {
    name: 'userpool',
    resources: [
      {
        componentName: 'Userpool',
        get: userPoolPermission,
        post: userPoolPermission,
        put: userPoolPermission
      }
    ]
  };
  response.push(userpool);
  return response;
};

module.exports = new iamHelper();
