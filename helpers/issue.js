const issuemodel = require('../models/issue');
const notificationLib = require('../lib/notification');
const tagHelper = require('../helpers/tags');
const shipmentHelper = require('./shipment');
const orderHelper = require('./order');
const validator = require('../lib/validatorAsync');
const akUtils = require('../lib/utility');
const jsTypeChecker = require('javascript-type-checker');
const mongoose = require('mongoose');
const bluebirdPromise = require('bluebird');
const commonHelper = require('./common');
const moment = require('moment');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');

const issueDependent = {
  things: 'issues.id',
  'product.1': 'trackingDetails.currentLocation.address.id',
  'product.2': 'issues.id',
  kollection: 'items.id',
  location: 'issues.id'
};

// const search = require('../services/search');

const issueService = function() {};

/**
 * Set client of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
issueService.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

/**
 * Set headers of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
issueService.prototype.setHeaders = function(headers) {
  this.headers = headers;
};

/**
 * Set headers of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
issueService.prototype.setConfigs = function() {
  return require('./configuration')
    .getConfigurations()
    .then(configs => {
      this.configs = configs;
    });
};
/**
 * Query the database to fetch issues on the basis of search parameters and other parameters
 * 
 * @param {Object} searchParams search filters
 * @param {Object} otherParams pagination, sorting etc other params.
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
issueService.prototype.get = function(searchParams, otherParams) {
  const project = {};
  if (searchParams['comments.items.order']) {
    project.shipment = 1;
    // project.comments = 1;
    project.comments = {
      $filter: {
        input: {
          $map: {
            input: '$comments',
            as: 'comment',
            in: {
              items: {
                $filter: {
                  input: '$$comment.items',
                  as: 'item',
                  cond: {
                    '$$item.order': {
                      $eq: mongoose.Types.ObjectId(searchParams['comments.items.order'])
                    }
                  }
                }
              }
            }
          }
        },
        as: 'comment',
        cond: { $ne: ['$$comment.items', []] }
      }
    };
  }
  const response = {};
  return (
    issuemodel
      .aggregate()
      .match(searchParams)
      // .project(project)
      .exec()
      .then(result => {
        const sHelper = require('./shipment');
        return sHelper.getById(searchParams['shipment.id']).then(shipment => {
          if (!(result || []).length) {
            const caseDetails = {
              isReported: 1,
              isCompleted: 0,
              l1: shipment.code || '',
              l3: ((shipment.trackingDetails || {}).currentLocation || {}).name || '',
              l2: shipment.shipmentStatus || '',
              color: '#008000',
              l4: shipment.etd || ''
            };
            let products = shipment.products;
            if (searchParams['comments.items.order']) {
              products = products.filter(
                product =>
                  `${product.orderDetails.id}` === `${searchParams['comments.items.order']}`
              );
            }
            let items = products.map(item => ({
              skuId: item.id || '',
              itemId: item.id || '',
              l1: item.code || '',
              l2: item.name || ''
            }));
            items = Array.from(new Set((items || []).map(JSON.stringify))).map(JSON.parse);
            response.caseDetails = caseDetails;
            response.items = items;
            response.comments = [];
            return response;
          }
          result = result[0];

          if (searchParams['comments.items.order']) {
            result.comments = result.comments.filter(
              comment =>
                comment.items
                  .map(item => `${item.order}`)
                  .indexOf(`${searchParams['comments.items.order']}`) >= 0
            );
          }
          const caseDetails = {
            isReported: 1,
            isCompleted: 0,
            l1: result.shipment.code || '',
            l3: ((result.shipment.trackingDetails || {}).currentLocation || {}).name || '',
            l2: result.shipment.shipmentStatus || '',
            color: '#008000',
            l4: akUtils.convertDateToTimezone({
              dateToConvert: result.shipment.etd || '',
              timeZone: (currentUserHandler.getCurrentUser() || {}).timezone,
              formatType: 'dt'
            })
          };
          let products = shipment.products;
          if (searchParams['comments.items.order']) {
            products = products.filter(
              product => `${product.orderDetails.id}` === `${searchParams['comments.items.order']}`
            );
          }
          let items = products.map(item => ({
            skuId: item.id || '',
            itemId: item.id || '',
            l1: item.code || '',
            l2: item.name || ''
          }));
          items = Array.from(new Set((items || []).map(JSON.stringify))).map(JSON.parse);
          // let items = result.comments.map((comment) => {
          //   return comment.items.map((item) => {
          //     return {
          //       'skuId': item.id || '',
          //       'itemId': item.id || '',
          //       'l1': item.code || '',
          //       'l2': item.name || ''
          //     };
          //   });
          // }).reduce((a, b) => {
          //   return a.concat(b);
          // });
          // items = Array.from(new Set(items.map(JSON.stringify))).map(JSON.parse);
          const comments = [];
          const commentDates = Array.from(
            new Set(
              result.comments.map(comment =>
                akUtils.convertDateToTimezone({
                  dateToConvert: comment.reportedOn || '',
                  timeZone: (currentUserHandler.getCurrentUser() || {}).timezone,
                  formatType: 'd'
                })
              )
            )
          );
          commentDates.forEach(date => {
            const temp = {};
            temp.commentDate = date;
            temp.issueComments = result.comments
              .filter(
                comment =>
                  date ===
                  akUtils.convertDateToTimezone({
                    dateToConvert: comment.reportedOn || '',
                    timeZone: (currentUserHandler.getCurrentUser() || {}).timezone,
                    formatType: 'd'
                  })
              )
              .map(comment => ({
                  l1: akUtils.convertDateToTimezone({
                    dateToConvert: comment.reportedOn || '',
                    timeZone: (currentUserHandler.getCurrentUser() || {}).timezone,
                    formatType: 'dt'
                  }),
                  l2: comment.data,
                  l3: `${(comment.reporter || {}).firstName || ''} ${(comment.reporter || {})
                    .lastName || ''}`.trim(),
                  l4: akUtils.convertDateToTimezone({
                    dateToConvert: comment.reportedOn || '',
                    timeZone: (currentUserHandler.getCurrentUser() || {}).timezone,
                    formatType: 'd'
                  }),
                  l5: akUtils.convertDateToTimezone({
                    dateToConvert: comment.reportedOn || '',
                    timeZone: (currentUserHandler.getCurrentUser() || {}).timezone,
                    formatType: 'ta'
                  }),
                  userProfilePicUrl: '',
                  rtype: 3,
                  issueImages: comment.images.map(image => ({
                    full: image.url,
                    thumb: image.url
                  })),
                  items: comment.items.map(item => ({
                    skuId: item.id || '',
                    itemId: item.id || '',
                    l1: item.code || '',
                    l2: item.name || ''
                  }))
                }))
              .reverse();
            comments.push(temp);
          });

          response.caseDetails = caseDetails;
          response.items = items;
          response.comments = comments.reverse();
          return response;
        });
      })
      .catch(err => {
        // console.log(err);
      })
  );
};

/**
 * Fetch a particular issue by providing its ID
 * 
 * @param {String} issueId ID of the issue to Fetch
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
issueService.prototype.getById = function(issueId = 'default', platform = 'mobile') {
  if (!mongoose.Types.ObjectId.isValid(issueId)) {
    return bluebirdPromise.reject();
  }
  // if (!forSearch) {
  //   return search.searchById('issues', issueId + '');
  // } else {
  let conditions = {
    _id: mongoose.Types.ObjectId(issueId)
  };
  conditions = clientHandler.addClientFilterToConditions(conditions);

  return issuemodel
    .find(conditions)
    .exec()
    .then(result => {
      if (result.length > 0) {
        if (platform === 'web') {
          return bluebirdPromise.resolve(this.formatWebResponse(result[0]));
        } else if (platform === 'internal') {
          return bluebirdPromise.resolve(result[0]);
        }
        return bluebirdPromise.resolve(this.formatResponse(result[0]));
      }
      return bluebirdPromise.reject();
    });
  // }
};
/**
 * Fetch a particular issue by providing its ID
 * 
 * @param {String} issueId ID of the issue to Fetch
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
issueService.prototype.getIssueByOrderId = function({
  caseId = 'default',
  shippingId = 'default'
}) {
  if (!mongoose.Types.ObjectId.isValid(caseId)) {
    return bluebirdPromise.reject();
  }
  if (!mongoose.Types.ObjectId.isValid(shippingId)) {
    return bluebirdPromise.reject();
  }
  // if (!forSearch) {
  //   return search.searchById('issues', issueId + '');
  // } else {
  let conditions = {
    'shipment.id': mongoose.Types.ObjectId(shippingId),
    'comments.items.order': mongoose.Types.ObjectId(caseId)
  };
  conditions = clientHandler.addClientFilterToConditions(conditions);

  return issuemodel
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
 * Fetch a particular issue by providing its Code
 * 
 * @param {String} code Code of the issue to Fetch
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
issueService.prototype.getByCode = function(code = '') {
  let conditions = {
    code
  };
  conditions = clientHandler.addClientFilterToConditions(conditions);

  return issuemodel
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
 * Count issues on the basis of some search conditions.
 * 
 * @param {Object} searchParams Search Conditions
 * @return {Promise<Number>} Number of matching issues.
 * 
 */
issueService.prototype.count = function(searchParams = {}) {
  return issuemodel.count(searchParams).exec();
};

/**
 * Performs response from DB operations to return as API response.
 * 
 * @param {Object} data Database operation result.
 * @param {Boolean} isDropdown Whether the APi is requesting a dropdown.
 * @return {Promise} formattedResponse Formatted Response
 * 
 */
issueService.prototype.formatResponse = function(data, isDropdown = false) {
  const formattedResponse = {};
  if (!isDropdown) {
    formattedResponse.id = data._id;
    formattedResponse.code = data.code;
    formattedResponse.name = data.name;
    formattedResponse.sysDefined = data.sysDefined;
    formattedResponse.status = data.status;
    formattedResponse.updatedOn = data.updatedOn;
    formattedResponse.updatedBy = `${((data || {}).updatedBy || '').firstName} ${((data || {})
      .updatedBy || ''
    ).lastName}`;
    formattedResponse.client = data.client;
    formattedResponse.tags = data.tags;
    // commonHelper.formatDate(data.updatedOn, this.headers, 'dt')
    // .then((date) => {
    //   formattedResponse.updatedOn = date;
    return formattedResponse;
    // });
  }
  formattedResponse.id = data._id;
  formattedResponse.name = data.name;
  return formattedResponse;
};

/**
 * Map keys for sorting.
 * 
 * @param {String} key
 * @return {String} 
 * 
 */
issueService.prototype.getColumnMap = function getColumnMap(key) {
  const map = {
    id: '_id',
    code: 'code',
    name: 'name',
    sysDefined: 'sysDefined',
    updatedOn: 'updatedOn',
    updatedBy: 'updatedBy'
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
issueService.prototype.getFilterParams = function(event) {
  let filters = {};
  filters = clientHandler.addClientFilterToConditions(filters);
  if (event.queryStringParameters && event.queryStringParameters.filter) {
    // filters._all = event.queryStringParameters.filter;
    filters.$or = [
      {
        name: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        code: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'updatedBy.firstName': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        'updatedBy.lastName': new RegExp(event.queryStringParameters.filter, 'i')
      }
    ];
  }

  if (event.queryStringParameters.id) {
    filters._id = mongoose.Types.ObjectId(event.queryStringParameters.id);
  }

  if (mongoose.Types.ObjectId.isValid(event.queryStringParameters.caseNo)) {
    filters['comments.items.order'] = mongoose.Types.ObjectId(event.queryStringParameters.caseNo);
  }
  if (mongoose.Types.ObjectId.isValid(event.queryStringParameters.shippingNo)) {
    filters['shipment.id'] = mongoose.Types.ObjectId(event.queryStringParameters.shippingNo);
  }

  if (event.queryStringParameters.code) {
    filters.code = new RegExp(event.queryStringParameters.code, 'i');
  }

  if (event.queryStringParameters.name) {
    filters.name = new RegExp(event.queryStringParameters.name, 'i');
  }

  if (event.queryStringParameters.status) {
    filters.status = parseInt(event.queryStringParameters.status, 10);
  }

  if (event.queryStringParameters.updatedOnFrom || event.queryStringParameters.updatedOnTo) {
    filters.updatedOn = {};
  }

  if (event.queryStringParameters.updatedOnFrom) {
    filters.updatedOn.$gte = new Date(event.queryStringParameters.updatedOnFrom);
  }

  if (event.queryStringParameters.updatedOnTo) {
    filters.updatedOn.$lte = akUtils.formatToDateFilter(
      new Date(event.queryStringParameters.updatedOnTo)
    );
  }

  // if (request.queryStringParameters.status === '1' || request.queryStringParameters.status === '0') filters.status = request.queryStringParameters.status === '1';
  if (event.queryStringParameters.dd === '1') {
    filters.status = 1;
    filters.sysDefined = 0;
  }

  return filters;
};

/**
 * Generate the extra parameters for the GET operation like sorting, pagination etc.
 * 
 * @param {Object} request Lambda Event
 * @return {Object} extraParams
 * 
 */
issueService.prototype.getExtraParams = function(event) {
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
    params.sort.updatedOn = -1;
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
issueService.prototype.commonValidations = function(event) {
  // // console.log(event);
  return bluebirdPromise
    .all([
      bluebirdPromise.all([validator.required(event.body.shippingNo)]),
      bluebirdPromise.all([validator.required(event.body.skuIds)]),
      bluebirdPromise.all([validator.required(event.body.comment)])
    ])
    .then(result => {
      const validatorErrorsMap = {
        shippingNo: {
          index: 0,
          fieldName: 'shippingNo'
        },
        skuIds: {
          index: 1,
          fieldName: 'skuIds'
        },
        comment: {
          index: 2,
          fieldName: 'comment'
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
issueService.prototype.validateUpdate = function(event) {
  let basicErrors;
  return this.commonValidations(event)
    .catch(errors => errors)
    .then(errorsIfAny => {
      basicErrors = errorsIfAny || {};
      return bluebirdPromise.all([
        bluebirdPromise.all([
          validator.elementExists('issues', event.pathParameters.id),
          validator.notSysDefined('issues', event.pathParameters.id),
          validator.deactivationCheck('issues', event.body.status, event.pathParameters.id)
        ]),
        bluebirdPromise.all([
          validator.checkSame('issues', 'code', event.body.code, event.pathParameters.id)
        ])
      ]);
    })
    .then(result => {
      const mapping = {
        global: {
          index: 0,
          fieldName: 'Issue'
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
          akUtils.getObjectValues(akUtils.sortErrorsObject(combinedErrors, 'issues'))
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
issueService.prototype.isDuplicateCode = function(code = '', excludedObjId = null) {
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

  return issuemodel
    .findOne(conditions)
    .exec()
    .then(result => {
      if (result) {
        return bluebirdPromise.resolve();
      }
      return bluebirdPromise.reject();
    });
};

issueService.prototype.isDuplicate = function(field, value = '', excludedObjId = null) {
  let conditions = {};
  conditions[field] = value;
  if (excludedObjId !== null && mongoose.Types.ObjectId.isValid(excludedObjId)) {
    conditions._id = {
      $ne: mongoose.Types.ObjectId(excludedObjId)
    };
  }
  conditions = clientHandler.addClientFilterToConditions(conditions);

  return issuemodel
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
issueService.prototype.validateRequest = function(event) {
  return this.commonValidations(event)
    .then(() => {})
    .catch(errors => {
      if (!jsTypeChecker.isEmptyObject(errors)) {
        return bluebirdPromise.reject(
          akUtils.getObjectValues(akUtils.sortErrorsObject(errors, 'issues'))
        );
      }
      return bluebirdPromise.resolve();
    });
};

/**
 * Save an issue
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of save operation.
 * 
 */
issueService.prototype.save = function save(event) {
  let newIssue = false;
  const shipmentHelper1 = require('../helpers/shipment');
  const shipmentmodel = require('../models/shipment');
  let conditions = { 'shipment.id': mongoose.Types.ObjectId(event.body.shippingNo) };
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return bluebirdPromise
    .all([shipmentHelper1.getById(event.body.shippingNo)])
    .then(populatedData => {
      const issueObj = {}; // create a new instance of the  model

      const comments = {};
      comments.data = event.body.comment;
      if (typeof event.body.skuIds === 'string') {
        event.body.skuIds = event.body.skuIds.split(',');
      }
      comments.items = event.body.skuIds
        .map(prod => {
          const temp = {};
          temp.id = prod;
          const product =
            (populatedData[0].products.filter(elem => `${elem.id}` === `${prod}`) || [])[0] || {};

          temp.code = product.code;
          temp.name = product.name;

          temp.order = (product.orderDetails || {}).id;
          if (!temp.order) {
            return undefined;
          }
          return temp;
        })
        .filter(elem => elem);
      comments.images = event.body.images || [];
      comments.reporter = currentUserHandler.getCurrentUser();
      comments.reportedOn = new Date();
      const updateParams = {};
      return issuemodel
        .findOne(conditions)
        .exec()
        .then(res => {
          if (!res) {
            newIssue = true;
            issueObj.shipment = populatedData[0];
            issueObj.status = 1;
            issueObj.issueStatus = 1;
            issueObj.issueType = '';
            issueObj.createdOn = Date.now();

            issueObj.createdBy = currentUserHandler.getCurrentUser();
            issueObj.assignee = {};
            issueObj.comments = [comments];
            issueObj.updatedOn = Date.now();
            issueObj.updatedBy = currentUserHandler.getCurrentUser();
            issueObj.client = clientHandler.getClient();
            updateParams.$set = issueObj;
            updateParams.$setOnInsert = { __v: 1 };
          } else {
            updateParams.$push = { comments };
            updateParams.$inc = { __v: 1 };
          }
          return issuemodel
            .findOneAndUpdate(conditions, updateParams, {
              upsert: true,
              new: true
            })
            .exec()
            .then(result => {
              const date = new Date();
              const user = currentUserHandler.getCurrentUser();
              const shipmentUpdateObj = { 'products.$.issue': result._id };
              return bluebirdPromise
                .map(comments.items, item => {
                  const orderModel = require('../models/order');
                  const orderUpdateObj = {
                    'products.$.issue': {
                      id: result._id,
                      shipmentId: mongoose.Types.ObjectId(event.body.shippingNo),
                      shipmentCode: result.shipment.code
                    }
                  };
                  // console.log(`order---${item.order}`);
                  return bluebirdPromise.all([
                    orderModel.update(
                      {
                        _id: mongoose.Types.ObjectId(item.order),
                        'products.id': mongoose.Types.ObjectId(item.id)
                      },
                      { $set: orderUpdateObj },
                      { multi: true }
                    ),

                    shipmentmodel.update(
                      {
                        _id: mongoose.Types.ObjectId(event.body.shippingNo),
                        'products.id': mongoose.Types.ObjectId(item.id)
                      },
                      { $set: shipmentUpdateObj }
                    )
                  ]);
                })
                .then(() => {
                  if (newIssue) {
                    return notificationLib.sendIssueCreatedNotification(result._id);
                  }
                  return notificationLib.sendIssueRespondedNotification(result._id);
                })
                .then(() => ({
                  issueId: result._id,
                  isReported: 1,
                  l1: date,
                  l2: comments.data,
                  l3: `${user.firstName || ''} ${user.lastName || ''}`,
                  l4: date.getDate(),
                  l5: date.getTime(),
                  userProfilePicUrl: '',
                  rtype: 2,
                  issueImages: (comments.images || []).map(elem => ({
                    full: elem.url,
                    thumb: elem.url
                  })),
                  items: comments.items
                }));
            });
        });
    })
    .catch(err => {
      // console.log(err);
    });
};

/**
 * Update an issue
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of update operation.
 * 
 */
issueService.prototype.update = function(event) {
  return bluebirdPromise.all([tagHelper.getForPopulation(event.body.tags)]).then(populatedData => {
    let conditions = {
      _id: event.pathParameters.id
    };
    conditions = clientHandler.addClientFilterToConditions(conditions);
    const issueUpdateObj = {};
    issueUpdateObj.code = event.body.code;
    issueUpdateObj.name = event.body.name;
    issueUpdateObj.status = event.body.status;
    issueUpdateObj.client = clientHandler.getClient();
    issueUpdateObj.tags = populatedData[0];
    issueUpdateObj.updatedOn = Date.now();
    issueUpdateObj.updatedBy = currentUserHandler.getCurrentUser();
    issueUpdateObj.sysDefined = 0; // event.body.sysDefined;

    const updateParams = {
      $set: issueUpdateObj,
      $inc: {
        __v: 1
      }
    };

    return issuemodel
      .findOneAndUpdate(conditions, updateParams, {
        upsert: false,
        new: true
      })
      .exec();
  });
};

issueService.prototype.getForPopulation = function(idValuePair, allowSysDefined = false) {
  idValuePair = idValuePair || [];
  const idValueMap = {};
  for (let i = 0; i < idValuePair.length; i++) {
    idValueMap[idValuePair[i].id] = idValuePair[i].value;
  }
  const idList = idValuePair.map(pair => mongoose.Types.ObjectId(pair.id));
  let conditions = {
    _id: {
      $in: idList
    },
    status: 1,
    sysDefined: 0
  };
  if (allowSysDefined) {
    conditions.sysDefined = 1;
  }
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return issuemodel
    .find(conditions)
    .exec()
    .then(result =>
      result.sort((a, b) => idList.indexOf(a._id) - idList.indexOf(b._id)).map(result => ({
        id: result._id,
        name: result.name,
        status: result.status,
        sysDefined: result.sysDefined,
        value: idValueMap[String(result._id)] || ''
      }))
    );
};

issueService.prototype.validatePopulatable = function(idList) {
  const isPopulatable = idList.reduce(
    (isValid, id) => isValid && mongoose.Types.ObjectId.isValid(id),
    true
  );
  if (!isPopulatable) {
    return bluebirdPromise.resolve(false);
  }
  idList = idList.map(id => mongoose.Types.ObjectId(id));

  let conditions = {
    _id: {
      $in: idList
    },
    status: 1,
    sysDefined: 0
  };
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return issuemodel
    .count(conditions)
    .exec()
    .then(count => {
      if (count === idList.length) {
        return bluebirdPromise.resolve(true);
      }
      return bluebirdPromise.resolve(false);
    });
};

issueService.prototype.validateInactive = function(issueid = '') {
  const modelpath = '../models/';

  const keys = Object.keys(issueDependent);
  // console.log(keys);
  return bluebirdPromise
    .map(keys, key => {
      // console.log(`in 1${key}`);
      const model = require(modelpath + key.split('.')[0]);
      const condition = issueDependent[key];
      const dict = {};
      dict[condition] = issueid;
      // console.log(JSON.stringify(dict));
      return model
        .findOne(dict)
        .exec()
        .then(result => {
          if (result) {
            // console.log(`in 2 wwwqwqwq${JSON.stringify(result)}`);
            return result;
          }
          // console.log('in 3 eeeeee');
          return result;
        });
    })
    .then(result => {
      // console.log(result.length);
      for (let i = 0; i < result.length; i++) {
        if (result[i] === null) {
          result.splice(i, 1);
          i--;
        }
      }
      // console.log(result);
      if (result.length > 0) {
        return bluebirdPromise.resolve(true);
      }
      return bluebirdPromise.resolve(false);
    });
};

/**
 * Performs response from DB operations to return as API response.
 * 
 * @param {Object} data Database operation result.
 * @return {Promise} formattedResponse Formatted Response
 * 
 */
issueService.prototype.formatWebResponse = function(data) {
  const formattedResponse = data.comments
    .map(commentObj => ({
      author: commentObj.reporter || '',
      comment: commentObj.data || '',
      commentCreationDate: commentObj.reportedOn || '',
      items: commentObj.items || {},
      images: commentObj.images || {}
    }))
    .reverse();
  return formattedResponse;
};

module.exports = new issueService();
