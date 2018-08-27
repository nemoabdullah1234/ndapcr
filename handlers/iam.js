/* jshint esversion: 6 */

const commonHelper = require('../helpers/common');
const bluebirdPromise = require('bluebird');
const aws = require('aws-sdk');
const iamHelper = require('../helpers/iam');
const jwt = require('jsonwebtoken');
const request = require('request');
const jwkToPem = require('jwk-to-pem');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');
const akUtils = require('../lib/utility');
const akResponses = require('../lib/respones');

const userPoolId = process.env.cognitoUserpoolId;
const region = process.env.region;
const iss = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
let pems;

/**
 * Get Group Policy of an user group
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getGroupPolicy = (event, context, callback) => {
  // const req = commonHelper.lambdaEventToBodyParserReq(event);
  event = commonHelper.parseLambdaEvent(event);
  let roleName = '';
  if (event.queryStringParameters.role) {
    roleName = event.queryStringParameters.role;
  }
  if (!roleName) {
    const errresponse = {
      statusCode: 404,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        code: 404,
        message: 'No role provided in query',
        description: 'Provide role in query param role',
        data: []
      })
    };
    return callback(null, errresponse);
  }

  iamHelper
    .getRolePolicy({
      roleName
    })
    .then(res => {
      const response = {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          code: 200,
          message: 'Success',
          description: 'User Polices',
          data: res
        })
      };
      callback(null, response);
    })
    .catch(error => {
      const response = {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          code: 404,
          message: 'Error',
          description: 'Error',
          data: error
        })
      };

      callback(null, response);
    });
};

/**
 * Update policy of an user group
 * 
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.updateGroupPolicy = (event, context, callback) => {
  // const req = commonHelper.lambdaEventToBodyParserReq(event);
  event = commonHelper.parseLambdaEvent(event);

  let roleName = '';
  if (event.body.roleName) {
    roleName = event.body.roleName;
  }

  let userPoolId = '';
  if (event.body.userPoolId) {
    userPoolId = event.body.userPoolId;
  }

  if (!roleName) {
    const errresponse = {
      statusCode: 404,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        code: 404,
        message: 'roleName is missing',
        description: 'roleName is missing',
        data: []
      })
    };
    return callback(null, errresponse);
  }

  if (!userPoolId) {
    const errresponse = {
      statusCode: 404,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        code: 404,
        message: 'userPoolId is missing',
        description: 'userPoolId is missing',
        data: []
      })
    };
    return callback(null, errresponse);
  }

  if (!event.body.modules) {
    const errresponse = {
      statusCode: 404,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        code: 404,
        message: 'No modules provided to update',
        description: 'No modules provided to update',
        data: []
      })
    };
    return callback(null, errresponse);
  }

  iamHelper
    .saveGroupPolicy(event.body.modules, roleName, userPoolId)
    .then(() => {
      const response = {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          code: 200,
          message: 'Success',
          description: 'User Polices Updated',
          data: {}
        })
      };

      callback(null, response);
    })
    .catch(error => {
      const response = {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          code: 404,
          message: 'Error',
          description: 'Error',
          data: error
        })
      };

      callback(null, response);
    });
};

/**
 * Api Gateway custom authorizer
 * 
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * 
 */
module.exports.customauthorizer = (event, context, callback) => {
  // Download PEM for your UserPool if not already downloaded
  if (!pems) {
    // Download the JWKs and save it as PEM
    request(
      {
        url: `${iss}/.well-known/jwks.json`,
        json: true
      },
      (error, response, body) => {
        if (!error && response.statusCode === 200) {
          pems = {};
          const keys = body.keys;
          for (let i = 0; i < keys.length; i++) {
            // Convert each key to PEM
            const key_id = keys[i].kid;
            const modulus = keys[i].n;
            const exponent = keys[i].e;
            const key_type = keys[i].kty;
            const jwk = {
              kty: key_type,
              n: modulus,
              e: exponent
            };
            const pem = jwkToPem(jwk);
            pems[key_id] = pem;
          }
          // Now continue with validating the token
          ValidateToken(pems, event, context, callback);
        } else {
          // Unable to download JWKs, fail the call
          context.fail('error');
        }
      }
    );
  } else {
    // PEMs are already downloaded, continue with validating the token
    ValidateToken(pems, event, context, callback);
  }
};

/**
 * Token validator for custom authorizer
 * 
 * @param {any} pems 
 * @param {object} event 
 * @param {object} context 
 * 
 */
function ValidateToken(pems, event, context, callback) {
  let token = event.authorizationToken || '';
  token = token.split('::');
  if (token.length < 2) {
    // console.log('Invalid Authorization Token passed');
    context.fail('Unauthorized');
    return;
  }
  const idToken = jwt.decode(token[token.length - 2], {
    complete: true
  });
  const accessToken = token.slice(-1).pop();

  // Fail if the token is not jwt
  const decodedJwt = jwt.decode(accessToken, {
    complete: true
  });
  if (!decodedJwt) {
    // console.log('Not a valid JWT token');
    context.fail('Unauthorized');
    return;
  }

  // Fail if token is not from your UserPool
  if (decodedJwt.payload.iss !== iss) {
    // console.log('Invalid issuer');
    context.fail('Unauthorized');
    return;
  }

  // Reject the jwt if it's not an 'Access Token'
  if (decodedJwt.payload.token_use !== 'access') {
    // console.log('Not an access token');
    context.fail('Unauthorized');
    return;
  }

  if (idToken.payload.token_use !== 'id') {
    // console.log('Id token not recieved');
    context.fail('Unauthorized');
    return;
  }

  // Get the kid from the token and retrieve corresponding PEM
  const kid = decodedJwt.header.kid;
  const pem = pems[kid];
  if (!pem) {
    // console.log('Invalid access token');
    context.fail('Unauthorized');
    return;
  }

  // Verify the signature of the JWT token to ensure it's really coming from your User Pool
  jwt.verify(
    accessToken,
    pem,
    {
      issuer: iss
    },
    (err, payload) => {
      if (err) {
        context.fail('Unauthorized');
      } else {
        // Valid token. Generate the API Gateway policy for the user
        // Always generate the policy on value of 'sub' claim and not for 'username' because username is reassignable
        // sub is UUID for a user which is never reassigned to another user.
        const principalId = payload.sub;

        // Get AWS AccountId and API Options
        const apiOptions = {};
        const tmp = event.methodArn.split(':');
        const apiGatewayArnTmp = tmp[5].split('/');
        const awsAccountId = tmp[4];
        const restApiId = apiGatewayArnTmp[0];
        apiOptions.region = tmp[3];
        apiOptions.restApiId = apiGatewayArnTmp[0];
        apiOptions.stage = apiGatewayArnTmp[1];
        const method = apiGatewayArnTmp[2];
        let resource = '/'; // root resource
        if (apiGatewayArnTmp[3]) {
          resource += apiGatewayArnTmp[3];
        }

        // Uncomment below block to Allow All -----

        const policy = new AuthPolicy(principalId, awsAccountId, apiOptions);
        policy.allowAllMethods();
        context.succeed(policy.build());

        // ----------------
        const preferred_role = idToken.payload['cognito:preferred_role'];
        if ((preferred_role || '') === '') {
          // console.log('No Role Defined for user');
          context.fail('Unauthorized');
          return;
        }
        const roleName = preferred_role
          .split('/')
          .slice(-1)
          .pop();
        const params = {
          PolicyName: akUtils.getPolicyFromRoleName(roleName),
          /* required */
          RoleName: roleName /* required */
        };
        const iam = new aws.IAM({
          apiVersion: '2010-05-08'
        });
        // const policy = new AuthPolicy(principalId, awsAccountId, apiOptions);

        const promisifiedFunction = bluebirdPromise.promisify(iam.getRolePolicy.bind(iam));
        return promisifiedFunction(params)
          .then(data => {
            let policydata = decodeURIComponent(data.PolicyDocument);
            if (typeof policydata === 'string') {
              policydata = JSON.parse(policydata);
            }
            const filteredStatements = policydata.Statement.filter(
              statement => statement.Action.indexOf('execute-api:Invoke') > -1
            );
            filteredStatements.forEach((st, index) => {
              filteredStatements[index].Resource = st.Resource.filter(res => {
                const tmp = res.split(':');
                const policyArnTmp = tmp[5].split('/');
                return policyArnTmp[0] === restApiId && tmp[2] === 'execute-api';
              });
            });

            filteredStatements.forEach(statement => {
              if (statement.Effect === 'Allow') {
                statement.Resource.forEach(res => {
                  const tmp = res.split(':');
                  const policyArnTmp = tmp[5].split('/');
                  const verb = policyArnTmp[2];
                  policy.allowMethod(verb, '*');
                });
              } else if (statement.Effect === 'Deny') {
                statement.Resource.forEach(res => {
                  const tmp = res.split(':');
                  const policyArnTmp = tmp[5].split('/');
                  const verb = policyArnTmp[2];
                  const arnResource = policyArnTmp.slice(3).join('/') || '/';
                  policy.denyMethod(verb, arnResource);
                });
              }
            });
            context.succeed(policy.build());
          })
          .catch(error => {
            // console.log('Custom Authorizer: iam reject========');
            // console.log(error);
            return bluebirdPromise.reject(error);
          });
      }
    }
  );
}

/**
 * Create user group in userpool
 * 
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.createGroup = (event, context, callback) => {
  // const req = commonHelper.lambdaEventToBodyParserReq(event);
  event = commonHelper.parseLambdaEvent(event);

  const iamHelper = require('../helpers/iam');
  let errors = '';
  iamHelper
    .validateGroupPostRequest(event)
    .then(() =>
      iamHelper
        .createGroup(event)
        .then(result => {
          // return result;
        })
        .then(result => {
          const response = {
            statusCode: 201,
            headers: {
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              code: 201,
              message: 'Ok',
              description: 'Group created successfully',
              data: result
            })
          };
          callback(null, response);
        })
        .catch(error => {
          // console.log(error);
          const response = {
            statusCode: 400,
            headers: {
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              code: 400,
              message: 'Create Failed',
              description: 'Create Failed',
              data: error
            })
          };
          callback(null, response);
        })
    )
    .catch(errorObj => {
      // console.log(errorObj);
      if (typeof errorObj !== 'undefined' && typeof errorObj.errors !== 'undefined') {
        errors = errorObj.errors;
      } else {
        errors = errorObj;
      }
      const response = {
        statusCode: 422,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          code: 422,
          message: 'Errors',
          description: 'Error Occured',
          data: errors
        })
      };
      callback(null, response);
    });
};

/**
 * Check whether user is admin approved after user authorization from cognito
 * 
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.postAuthenticateUser = (event, context, callback) => {
  callback = {};
  clientHandler.setClient(clientHandler.getClientObject({}));
  currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject({}));
  const userHelper = require('../helpers/users');
  const userAttributes = event.request.userAttributes;
  commonHelper
    .decryptDbURI()
    .then(dbURI => {
      const mongoose = require('mongoose');
      commonHelper.connectToDb(dbURI);
      if (userAttributes && userAttributes['custom:isAdminApproved'] === 'yes') {
        userHelper
          .updateOnTrigger(event)
          .then(() => {
            mongoose.disconnect();
            context.done(null, event);
          })
          .catch(() => {
            mongoose.disconnect();
          });
      } else {
        mongoose.disconnect();
        const error = new Error('User is not approved. Please contact administrator');
        context.done(error, event);
      }
    })
    .catch(() => {
      const error = new Error('Database could not be reached');
      context.done(error, event);
    });
};

/**
 * Check whether user is admin approved after user authorization from cognito
 * 
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.sendCustomEmailCognito = (event, context, callback) => {
  const triggerSource = event.triggerSource;
  const emailshelper = require('../helpers/emails');
  if (triggerSource === 'CustomMessage_SignUp') {
    const data = {
      adminurl: process.env.adminurl,
      token: event.request.codeParameter,
      emailID: event.userName,
      username: event.userName,
      footerText: process.env.footerText,
      salutationText: process.env.salutationText,
      companyName: process.env.companyName,
      companyLogo: process.env.companyLogo
    };
    emailshelper.getEmailTemplate('user-welcome-email', data).then(email_data => {
      event.response.emailSubject = 'Verify your Account';
      event.response.emailMessage = email_data.html;
      context.done(null, event);
    });
  } else if (triggerSource === 'CustomMessage_AdminCreateUser') {
    const data = {
      adminurl: process.env.adminurl,
      token: event.request.codeParameter,
      emailID: event.userName,
      username: event.userName,
      footerText: process.env.footerText,
      salutationText: process.env.salutationText,
      companyName: process.env.companyName,
      companyLogo: process.env.companyLogo
    };
    emailshelper.getEmailTemplate('user-created-by-admin-email', data).then(email_data => {
      event.response.emailSubject = `Welcome to ${process.env.companyName}`;
      event.response.emailMessage = email_data.html;
      context.done(null, event);
    });
  } else if (triggerSource === 'CustomMessage_ResendCode') {
    const data = {
      adminurl: process.env.adminurl,
      token: event.request.codeParameter,
      emailID: event.userName,
      username: event.userName,
      footerText: process.env.footerText,
      salutationText: process.env.salutationText,
      companyName: process.env.companyName,
      companyLogo: process.env.companyLogo
    };
    emailshelper.getEmailTemplate('resend-code-email', data).then(email_data => {
      event.response.emailSubject = 'Your verification code';
      event.response.emailMessage = email_data.html;
      context.done(null, event);
    });
  } else if (triggerSource === 'CustomMessage_ForgotPassword') {
    const data = {
      adminurl: process.env.adminurl,
      token: event.request.codeParameter,
      footerText: process.env.footerText,
      salutationText: process.env.salutationText,
      companyName: process.env.companyName,
      companyLogo: process.env.companyLogo
    };
    emailshelper.getEmailTemplate('forget-password-email-reader', data).then(email_data => {
      event.response.emailSubject = 'Forgot Password Request';
      event.response.emailMessage = email_data.html;
      context.done(null, event);
    });
  }
};

/**
 * AuthPolicy receives a set of allowed and denied methods and generates a valid
 * AWS policy for the API Gateway authorizer. The constructor receives the calling
 * user principal, the AWS account ID of the API owner, and an apiOptions object.
 * The apiOptions can contain an API Gateway RestApi Id, a region for the RestApi, and a
 * stage that calls should be allowed/denied for. For example
 * {
 *   restApiId: 'xxxxxxxxxx',
 *   region: process.env.region,
 *   stage: 'dev'
 * }
 *
 * var testPolicy = new AuthPolicy('[principal user identifier]', '[AWS account id]', apiOptions);
 * testPolicy.allowMethod(AuthPolicy.HttpVerb.GET, '/users/username');
 * testPolicy.denyMethod(AuthPolicy.HttpVerb.POST, '/pets');
 * context.succeed(testPolicy.build());
 *
 * @class AuthPolicy
 * @constructor
 */
function AuthPolicy(principal, awsAccountId, apiOptions) {
  /**
     * The AWS account id the policy will be generated for. This is used to create
     * the method ARNs.
     *
     * @property awsAccountId
     * @type {String}
     */
  this.awsAccountId = awsAccountId;

  /**
     * The principal used for the policy, this should be a unique identifier for
     * the end user.
     *
     * @property principalId
     * @type {String}
     */
  this.principalId = principal;

  /**
     * The policy version used for the evaluation. This should always be '2012-10-17'
     *
     * @property version
     * @type {String}
     * @default '2012-10-17'
     */
  this.version = '2012-10-17';

  /**
     * The regular expression used to validate resource paths for the policy
     *
     * @property pathRegex
     * @type {RegExp}
     * @default '^\/[/.a-zA-Z0-9-\*]+$'
     */
  this.pathRegex = new RegExp('^[/.a-zA-Z0-9-*]+$');

  // these are the internal lists of allowed and denied methods. These are lists
  // of objects and each object has 2 properties: A resource ARN and a nullable
  // conditions statement.
  // the build method processes these lists and generates the approriate
  // statements for the final policy
  this.allowMethods = [];
  this.denyMethods = [];

  if (!apiOptions || !apiOptions.restApiId) {
    this.restApiId = '*';
  } else {
    this.restApiId = apiOptions.restApiId;
  }
  if (!apiOptions || !apiOptions.region) {
    this.region = '*';
  } else {
    this.region = apiOptions.region;
  }
  if (!apiOptions || !apiOptions.stage) {
    this.stage = '*';
  } else {
    this.stage = apiOptions.stage;
  }
}

/**
 * A set of existing HTTP verbs supported by API Gateway. This property is here
 * only to avoid spelling mistakes in the policy.
 *
 * @property HttpVerb
 * @type {Object}
 */
AuthPolicy.HttpVerb = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  HEAD: 'HEAD',
  DELETE: 'DELETE',
  OPTIONS: 'OPTIONS',
  ALL: '*'
};

AuthPolicy.prototype = (function() {
  /**
     * Adds a method to the internal lists of allowed or denied methods. Each object in
     * the internal list contains a resource ARN and a condition statement. The condition
     * statement can be null.
     *
     * @method addMethod
     * @param {String} The effect for the policy. This can only be 'Allow' or 'Deny'.
     * @param {String} he HTTP verb for the method, this should ideally come from the
     *                 AuthPolicy.HttpVerb object to avoid spelling mistakes
     * @param {String} The resource path. For example '/pets'
     * @param {Object} The conditions object in the format specified by the AWS docs.
     * @return {void}
     */
  const addMethod = function(effect, verb, resource, conditions) {
    if (verb !== '*' && !AuthPolicy.HttpVerb.hasOwnProperty(verb)) {
      throw new Error(`Invalid HTTP verb ${verb}. Allowed verbs in AuthPolicy.HttpVerb`);
    }

    if (!this.pathRegex.test(resource)) {
      throw new Error(`Invalid resource path: ${resource}. Path should match ${this.pathRegex}`);
    }

    let cleanedResource = resource;
    if (resource.substring(0, 1) === '/') {
      cleanedResource = resource.substring(1, resource.length);
    }
    const resourceArn = `arn:aws:execute-api:${this.region}:${this.awsAccountId}:${this
      .restApiId}/${this.stage}/${verb}/${cleanedResource}`;

    if (effect.toLowerCase() === 'allow') {
      this.allowMethods.push({
        resourceArn,
        conditions
      });
    } else if (effect.toLowerCase() === 'deny') {
      this.denyMethods.push({
        resourceArn,
        conditions
      });
    }
  };

  /**
     * Returns an empty statement object prepopulated with the correct action and the
     * desired effect.
     *
     * @method getEmptyStatement
     * @param {String} The effect of the statement, this can be 'Allow' or 'Deny'
     * @return {Object} An empty statement object with the Action, Effect, and Resource
     *                  properties prepopulated.
     */
  const getEmptyStatement = function(effect) {
    effect =
      effect.substring(0, 1).toUpperCase() + effect.substring(1, effect.length).toLowerCase();
    const statement = {};
    statement.Action = 'execute-api:Invoke';
    statement.Effect = effect;
    statement.Resource = [];

    return statement;
  };

  /**
     * This function loops over an array of objects containing a resourceArn and
     * conditions statement and generates the array of statements for the policy.
     *
     * @method getStatementsForEffect
     * @param {String} The desired effect. This can be 'Allow' or 'Deny'
     * @param {Array} An array of method objects containing the ARN of the resource
     *                and the conditions for the policy
     * @return {Array} an array of formatted statements for the policy.
     */
  const getStatementsForEffect = function(effect, methods) {
    const statements = [];

    if (methods.length > 0) {
      const statement = getEmptyStatement(effect);

      for (let i = 0; i < methods.length; i++) {
        const curMethod = methods[i];
        if (curMethod.conditions === null || curMethod.conditions.length === 0) {
          statement.Resource.push(curMethod.resourceArn);
        } else {
          const conditionalStatement = getEmptyStatement(effect);
          conditionalStatement.Resource.push(curMethod.resourceArn);
          conditionalStatement.Condition = curMethod.conditions;
          statements.push(conditionalStatement);
        }
      }

      if (statement.Resource !== null && statement.Resource.length > 0) {
        statements.push(statement);
      }
    }

    return statements;
  };

  return {
    constructor: AuthPolicy,

    /**
         * Adds an allow '*' statement to the policy.
         *
         * @method allowAllMethods
         */
    allowAllMethods() {
      addMethod.call(this, 'allow', '*', '*', null);
    },

    /**
         * Adds a deny '*' statement to the policy.
         *
         * @method denyAllMethods
         */
    denyAllMethods() {
      addMethod.call(this, 'deny', '*', '*', null);
    },

    /**
         * Adds an API Gateway method (Http verb + Resource path) to the list of allowed
         * methods for the policy
         *
         * @method allowMethod
         * @param {String} The HTTP verb for the method, this should ideally come from the
         *                 AuthPolicy.HttpVerb object to avoid spelling mistakes
         * @param {string} The resource path. For example '/pets'
         * @return {void}
         */
    allowMethod(verb, resource) {
      addMethod.call(this, 'allow', verb, resource, null);
    },

    /**
         * Adds an API Gateway method (Http verb + Resource path) to the list of denied
         * methods for the policy
         *
         * @method denyMethod
         * @param {String} The HTTP verb for the method, this should ideally come from the
         *                 AuthPolicy.HttpVerb object to avoid spelling mistakes
         * @param {string} The resource path. For example '/pets'
         * @return {void}
         */
    denyMethod(verb, resource) {
      addMethod.call(this, 'deny', verb, resource, null);
    },

    /**
         * Adds an API Gateway method (Http verb + Resource path) to the list of allowed
         * methods and includes a condition for the policy statement. More on AWS policy
         * conditions here: http://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements.html#Condition
         *
         * @method allowMethodWithConditions
         * @param {String} The HTTP verb for the method, this should ideally come from the
         *                 AuthPolicy.HttpVerb object to avoid spelling mistakes
         * @param {string} The resource path. For example '/pets'
         * @param {Object} The conditions object in the format specified by the AWS docs
         * @return {void}
         */
    allowMethodWithConditions(verb, resource, conditions) {
      addMethod.call(this, 'allow', verb, resource, conditions);
    },

    /**
         * Adds an API Gateway method (Http verb + Resource path) to the list of denied
         * methods and includes a condition for the policy statement. More on AWS policy
         * conditions here: http://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements.html#Condition
         *
         * @method denyMethodWithConditions
         * @param {String} The HTTP verb for the method, this should ideally come from the
         *                 AuthPolicy.HttpVerb object to avoid spelling mistakes
         * @param {string} The resource path. For example '/pets'
         * @param {Object} The conditions object in the format specified by the AWS docs
         * @return {void}
         */
    denyMethodWithConditions(verb, resource, conditions) {
      addMethod.call(this, 'deny', verb, resource, conditions);
    },

    /**
         * Generates the policy document based on the internal lists of allowed and denied
         * conditions. This will generate a policy with two main statements for the effect:
         * one statement for Allow and one statement for Deny.
         * Methods that includes conditions will have their own statement in the policy.
         *
         * @method build
         * @return {Object} The policy object that can be serialized to JSON.
         */
    build() {
      if (
        (!this.allowMethods || this.allowMethods.length === 0) &&
        (!this.denyMethods || this.denyMethods.length === 0)
      ) {
        throw new Error('No statements defined for the policy');
      }

      const policy = {};
      policy.principalId = this.principalId;
      const doc = {};
      doc.Version = this.version;
      doc.Statement = [];

      doc.Statement = doc.Statement.concat(
        getStatementsForEffect.call(this, 'Allow', this.allowMethods)
      );
      doc.Statement = doc.Statement.concat(
        getStatementsForEffect.call(this, 'Deny', this.denyMethods)
      );

      policy.policyDocument = doc;

      return policy;
    }
  };
})();
