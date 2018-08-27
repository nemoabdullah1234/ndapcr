/* jshint esversion: 6 */

const unwind = require('mongo-unwind');
const notificationLib = require('../lib/notification');
const countryHelper = require('./country');

const shipmentmodel = require('../models/shipment');
const ordermodel = require('../models/order');
const shipStatusMap = require('../mappings/shipmentStatus.json');
// var shipmentOrchestrationModel = require('../models/shipmentOrchestration');
const mongoose = require('mongoose');
const bluebirdPromise = require('bluebird');
const commonHelper = require('./common');
const validator = require('../lib/validatorAsync');
const akUtils = require('../lib/utility');
const timediff = require('timediff');
const tagHelper = require('../helpers/tags');
const attributeHelper = require('../helpers/attribute');
const thingsHelper = require('../helpers/things');
const jsTypeChecker = require('javascript-type-checker');
const shipmentOrchestrationHelper = require('../helpers/shipmentOrchestration');
const itemStatusArr = require('../mappings/itemStatus.json');
const shipmentStatusArr = require('../mappings/shipmentStatus.json');
// const orderStatusLabelMap = require('../mappings/orderStatusLabel.json');
const shipmentStatusLabelMap = require('../mappings/shipmentStatusLabel.json');
const locationHelper = require('./core/location');
// const orderHelper = require('./order');
// const itemOrchestrationModel = require('../models/itemOrchestration');
const productModel = require('../models/product');
const productHelper = require('../helpers/product');
const shipmentTrackingModel = require('../models/shipmentTracking');
const itemOrchestrationHelper = require('../helpers/itemOrchestration');
const locationmodel = require('../models/location');
const EmailTemplate = require('email-templates').EmailTemplate;
const LambdaLib = require('../lib/aws/lambda');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');
const itemStatusLabel = require('../mappings/itemStatusLabel.json');
const issueHelper = require('../helpers/issue');
const productTrackingModel = require('../models/productTracking');

const lambda = new LambdaLib();

const addressType = ['shipFromAddress', 'shipToAddress'];
const shipmentService = function() {};

shipmentService.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

shipmentService.prototype.get = function({ searchParams, otherParams, projectParams }) {
  searchParams = clientHandler.addClientFilterToConditions(searchParams);
  return shipmentmodel
    .aggregate([projectParams])
    .match(searchParams)
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

shipmentService.prototype.getById = function(shipmentId) {
  if (!mongoose.Types.ObjectId.isValid(shipmentId)) {
    return bluebirdPromise.reject();
  }
  let conditions = {
    _id: mongoose.Types.ObjectId(shipmentId)
  };
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return shipmentmodel
    .findOne(conditions)
    .exec()
    .then(result => {
      if (result) {
        result = JSON.parse(JSON.stringify(result));
        return shipmentTrackingModel
          .findOne({
            'shipment.id': mongoose.Types.ObjectId(shipmentId)
          })
          .sort({
            lastTracked: -1
          })
          .then(shipLocObj => {
            if (shipLocObj) {
              result.currentLocation = shipLocObj.currentLocation;
            }
            return bluebirdPromise.resolve(this.formatResponse(result));
          });
      }
      return bluebirdPromise.reject();
    });
};

shipmentService.prototype.getByCode = function(code = '', excludedObjId = null) {
  let conditions;
  if (excludedObjId !== null) {
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
  return shipmentmodel
    .aggregate()
    .match(conditions)
    .exec()
    .then(result => {
      if (result.length > 0) {
        return bluebirdPromise.resolve(this.formatResponse(result[0]));
      }
      return bluebirdPromise.reject();
    });
};

shipmentService.prototype.count = function({ searchParams, projectParams }) {
  searchParams = clientHandler.addClientFilterToConditions(searchParams);
  return shipmentmodel
    .aggregate([projectParams])
    .match(searchParams)
    .exec()
    .then(result => result.length);
};

shipmentService.prototype.formatResponse = function(data, isDropdown = false) {
  const formattedResponse = {};
  data = commonHelper.deepCloneObject(data);
  if (!isDropdown) {
    // //akUtils.log(data)
    formattedResponse.id = data._id;
    formattedResponse.code = data.code;
    formattedResponse.status = data.status;
    formattedResponse.carrierUser = data.carrierUser;

    formattedResponse.isReported = data.issue ? 1 : 0;

    formattedResponse.etd = data.etd || '';
    formattedResponse.scheduledPickupDate = data.scheduledPickupDate;
    formattedResponse.deliverByDate = data.deliverByDate;
    formattedResponse.shipDate = data.shipDate;
    formattedResponse.deliveryDate = data.deliveryDate;
    formattedResponse.shipmentStatus = data.shipmentStatus;

    formattedResponse.shipmentStatus = data.shipmentStatus;

    formattedResponse.shipmentStatusLabel =
      akUtils.objectKeyByValue(shipmentStatusLabelMap, data.shipmentStatus) || '';

    formattedResponse.updatedOn = data.updatedOn;
    if (data.updatedBy) {
      formattedResponse.updatedBy = `${((data || {}).updatedBy || '').firstName} ${((data || {})
        .updatedBy || ''
      ).lastName}`;
    }
    // formattedResponse.products = data.products;
    formattedResponse.addresses = data.addresses;
    formattedResponse.issue = data.issue;

    formattedResponse.products = data.products.map(product => {
      product.isReported = false;
      if (mongoose.Types.ObjectId.isValid(product || []).issue) {
        // formattedResponse.isReported = true;
        product.isReported = true;
      }

      return product;
    });
    formattedResponse.deliveryDetails = data.deliveryDetails;
    formattedResponse.attributes = data.attributes;
    formattedResponse.client = data.client;
    formattedResponse.tags = data.tags;
    formattedResponse.createdOn = data.createdOn;
    formattedResponse.createdBy = data.createdBy;

    if (data.currentLocation) {
      // ////akUtils.log(data.currentLocation)
      data.currentLocation = commonHelper.moveSystemAttributesToGlobal(
        data.currentLocation,
        {},
        'address'
      );
      // ////akUtils.log(data.currentLocation)

      formattedResponse.currentLocation = {
        id: data.currentLocation.id,
        name: data.currentLocation.name,
        coordinates: {
          latitude: data.currentLocation.pointCoordinates.coordinates[1],
          longitude: data.currentLocation.pointCoordinates.coordinates[0]
        },
        zones: data.currentLocation.zones || '',
        address: data.currentLocation.address || '',
        city: data.currentLocation.city || '',
        state: data.currentLocation.state || '',
        country: data.currentLocation.country || ''
      };
    }
    return formattedResponse;
  }
  formattedResponse.id = data._id;
  formattedResponse.code = data.code;
  return formattedResponse;
};

shipmentService.prototype.formatResponseForMobile = function(data, isDropdown = false) {
  const formattedResponse = {};
  if (!isDropdown) {
    formattedResponse.id = data._id;
    formattedResponse.code = data.code;
    formattedResponse.status = data.status;
    formattedResponse.carrierUser = data.carrierUser;

    formattedResponse.etd = data.etd;
    formattedResponse.scheduledPickupDate = data.scheduledPickupDate;
    formattedResponse.deliverByDate = data.deliverByDate;
    formattedResponse.shipmentStatus = data.shipmentStatus;

    formattedResponse.shipDate = data.shipDate;
    formattedResponse.deliveryDate = data.deliveryDate;

    formattedResponse.updatedOn = data.updatedOn;
    if (data.updatedBy) {
      formattedResponse.updatedBy = `${((data || {}).updatedBy || '').firstName} ${((data || {})
        .updatedBy || ''
      ).lastName}`;
    }
    formattedResponse.products = data.products;
    formattedResponse.addresses = data.addresses;
    formattedResponse.createdOn = data.createdOn;
    formattedResponse.createdBy = data.createdBy;
    formattedResponse.deliveryDetails = data.deliveryDetails;
    formattedResponse.trackingDetails = data.trackingDetails;
    formattedResponse.attributes = data.attributes;
    formattedResponse.client = data.client;
    formattedResponse.tags = data.tags;

    return formattedResponse;
  }
  formattedResponse.id = data._id;
  formattedResponse.code = data.code;
  return formattedResponse;
};

shipmentService.prototype.getColumnMap = function getColumnMap(key) {
  const map = {
    id: '_id',
    code: 'code',
    createdOn: 'createdOn',
    pickupDate: 'scheduledPickupDate',
    etd: 'etd',
    carrierUserName: 'carrierUser.firstName'
    // toAddress: 'toAddress',
    // sysDefined: 'sysDefined',
    // updatedOn: 'updatedOn',
    // updatedBy: 'updatedBy'
  };

  if (key) {
    return map[key] || key;
  }
  return map;
};
shipmentService.prototype.getProjectParams = function(event) {
  const project = {};
  project.$addFields = {
    consumerForSearch: {
      $concat: ['$carrierUser.firstName', ' ', '$carrierUser.lastName']
    }
  };
  return project;
};

shipmentService.prototype.getFilterParams = function(event) {
  const filters = {};
  filters.$and = [];
  if (!event.queryStringParameters) {
    return filters;
  }
  if (event.queryStringParameters && event.queryStringParameters.filter) {
    // filters._all = event.queryStringParameters.filter;

    filters.$or = [
      {
        'product.name': new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        code: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        status: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        // shipmentStatus: new RegExp(event.queryStringParameters.filter)
        shipmentStatus: akUtils.getShipmentStatus(event.queryStringParameters.filter)
      },
      {
        consumerForSearch: new RegExp(event.queryStringParameters.filter, 'i')
      },
      {
        attributes: {
          $elemMatch: {
            name: 'surgeon',
            value: new RegExp(event.queryStringParameters.filter, 'i')
          }
        }
      },
      {
        attributes: {
          $elemMatch: {
            name: 'surgery',
            value: new RegExp(event.queryStringParameters.filter, 'i')
          }
        }
      },
      // {
      //   addresses: {
      //     $elemMatch: {
      //       'location.name': new RegExp(event.queryStringParameters.filter, 'i')
      //     }
      //   }
      // },
      {
        addresses: {
          $elemMatch: {
            addressType: 'shipToAddress',
            'location.name': new RegExp(event.queryStringParameters.filter, 'i')
          }
        }
      }
    ];
  }
  if (event.queryStringParameters.id) {
    filters.$and.push({
      _id: mongoose.Types.ObjectId(event.queryStringParameters.id)
    });
  }
  if (event.queryStringParameters.shipmentNo) {
    filters.$and.push({
      code: new RegExp(event.queryStringParameters.shipmentNo, 'i')
    });
  }

  if (event.queryStringParameters.shipToAddress) {
    filters.$and.push({
      addresses: {
        $elemMatch: {
          addressType: 'shipToAddress',
          'location.name': new RegExp(event.queryStringParameters.shipToAddress, 'i')
        }
      }
    });
  }
  if (event.queryStringParameters.shipFromAddress) {
    filters.$and.push({
      addresses: {
        $elemMatch: {
          addressType: 'shipFromAddress',
          'location.name': new RegExp(event.queryStringParameters.shipFromAddress, 'i')
        }
      }
    });
  }

  if (event.queryStringParameters.product) {
    filters.$and.push({
      products: {
        $elemMatch: {
          name: new RegExp(event.queryStringParameters.product, 'i')
        }
      }
    });
  }

  if (event.queryStringParameters.shipmentStatus) {
    if (shipmentStatusArr[event.queryStringParameters.shipmentStatus]) {
      filters.$and.push({
        shipmentStatus: parseInt(shipmentStatusArr[event.queryStringParameters.shipmentStatus], 10)
      });
    } else {
      filters.$and.push({
        shipmentStatus: parseInt(event.queryStringParameters.shipmentStatus, 10)
      });
    }
  }
  if (event.queryStringParameters.carrier) {
    filters.$and.push({
      'carrierUser.uuid': new RegExp(event.queryStringParameters.carrier, 'i')
    });
  }

  if (event.queryStringParameters.etd) {
    const dates = event.queryStringParameters.etd.split('--');
    const arr = [];
    if (dates[0]) {
      arr.push({
        etd: {
          $gte: new Date(dates[0])
        }
      });
    }
    if (dates[1]) {
      arr.push({
        etd: {
          $lte: new Date(dates[1])
        }
      });
    }
    if (arr.length) {
      filters.$and = filters.$and.concat(arr);
    }
  }
  if (event.queryStringParameters.pickupDate) {
    const dates = event.queryStringParameters.pickupDate.split('--');
    const arr = [];
    if (dates[0]) {
      arr.push({
        scheduledPickupDate: {
          $gte: new Date(dates[0])
        }
      });
    }
    if (dates[1]) {
      arr.push({
        scheduledPickupDate: {
          $lte: new Date(dates[1])
        }
      });
    }
    if (arr.length) {
      filters.$and = filters.$and.concat(arr);
    }
  }
  if (event.queryStringParameters.createdOn) {
    const dates = event.queryStringParameters.createdOn.split('--');
    const arr = [];
    if (dates[0]) {
      arr.push({
        createdOn: {
          $gte: new Date(dates[0])
        }
      });
    }
    if (dates[1]) {
      arr.push({
        createdOn: {
          $lte: new Date(dates[1])
        }
      });
    }
    if (arr.length) {
      filters.$and = filters.$and.concat(arr);
    }
  }
  if (event.queryStringParameters.status === '1') {
    filters.$and.push({
      status: 1
    });
  } else if (event.queryStringParameters.status === '0') {
    filters.$and.push({
      status: 0
    });
  }
  if (event.queryStringParameters.dd === '1') {
    filters.$and.push({
      status: 1
    });
  }
  if (event.queryStringParameters.date) {
    const dateConditions = [];
    const queryDate = event.queryStringParameters.date;
    const queryDateObj = akUtils.addDaysToDate(queryDate, 0);
    const nextDateObj = akUtils.addDaysToDate(queryDate, 1);
    if (!akUtils.isFutureDate(queryDate)) {
      dateConditions.push({
        shipmentStatus: shipStatusMap.Scheduled,
        scheduledPickupDate: {
          $lt: nextDateObj
        }
      });

      dateConditions.push({
        shipmentStatus: shipStatusMap.Shipped,
        scheduledPickupDate: {
          $lt: nextDateObj
        }
      });

      dateConditions.push({
        shipmentStatus: shipStatusMap.PartialShipped,
        scheduledPickupDate: {
          $lt: nextDateObj
        }
      });

      dateConditions.push({
        shipmentStatus: shipStatusMap.SoftShipped,
        scheduledPickupDate: {
          $lt: nextDateObj
        }
      });
    } else {
      dateConditions.push({
        shipmentStatus: shipStatusMap.Scheduled,
        scheduledPickupDate: {
          $gte: queryDateObj,
          $lt: nextDateObj
        }
      });

      dateConditions.push({
        shipmentStatus: shipStatusMap.Shipped,
        scheduledPickupDate: {
          $gte: queryDateObj,
          $lt: nextDateObj
        }
      });

      dateConditions.push({
        shipmentStatus: shipStatusMap.PartialShipped,
        scheduledPickupDate: {
          $gte: queryDateObj,
          $lt: nextDateObj
        }
      });

      dateConditions.push({
        shipmentStatus: shipStatusMap.SoftShipped,
        scheduledPickupDate: {
          $gte: queryDateObj,
          $lt: nextDateObj
        }
      });
    }

    dateConditions.push({
      shipmentStatus: shipStatusMap.SoftDelivered,
      deliveryDate: {
        $gte: queryDateObj,
        $lt: nextDateObj
      }
    });

    dateConditions.push({
      shipmentStatus: shipStatusMap.PartialDelivered,
      deliveryDate: {
        $gte: queryDateObj,
        $lt: nextDateObj
      }
    });

    dateConditions.push({
      shipmentStatus: shipStatusMap.Delivered,
      deliveryDate: {
        $gte: queryDateObj,
        $lt: nextDateObj
      }
    });
    filters.$and.push({
      $or: dateConditions
    });
  }
  filters.$and.length ? '' : delete filters.$and;

  akUtils.log(filters);
  return filters;
};

shipmentService.prototype.getExtraParams = function(event) {
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
      // let sortOrder = 1;
      col = col.trim();
      const isValidColumn = this.getColumnMap(col) || this.getColumnMap(col.replace('-', ''));
      if (isValidColumn) {
        let sortOrder;
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

shipmentService.prototype.isDuplicateCode = function(code = '', excludedObjId = null) {
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
  return shipmentmodel
    .findOne(conditions)
    .exec()
    .then(result => {
      if (result) {
        return bluebirdPromise.resolve();
      }
      return bluebirdPromise.reject();
    });
};

// shipmentService.prototype.validateRequest = function(event) {

//   let combinedErrors = [];
//   return this.validateBasics(event).catch((errors) => {
//     combinedErrors = combinedErrors.concat(errors);
//     return;
//   }).then(()=>{
//     return this.validateAndPopulateIds(event);
//   }).catch((errors) => {
//     combinedErrors = combinedErrors.concat(errors);
//     return;
//   }).then((event) => {
//     if(combinedErrors.length === 0) {
//       return event;
//     }
//     else {
//       return bluebirdPromise.reject(combinedErrors);
//     }
//   });
// };

shipmentService.prototype.validateUpdate = function(event) {
  let combinedErrors = [];
  return this.getById(event.pathParameters.id).then(res => {
    if (event.body.code && res.code !== event.body.code) {
      combinedErrors.push({
        code: 2502,
        message: 'Code cannot be modified.'
      });
    }
    if (event.body.shipmentStatus && event.body.shipmentStatus === res.shipmentStatus) {
      delete event.body.shipmentStatus;
    }
    return this.validateBasics(event)
      .catch(errors => {
        combinedErrors = combinedErrors.concat(errors);
      })
      .then(() => this.validateAndPopulateIds(event))
      .catch(errors => {
        combinedErrors = combinedErrors.concat(errors);
      })
      .then(event => {
        if (combinedErrors.length === 0) {
          return event;
        }
        return bluebirdPromise.reject(combinedErrors);
      });
  });
};

shipmentService.prototype.validateAndPopulateIds = function(event) {
  const commonHelper = require('./common');
  const errors = [];
  let tagNameList = [];
  let attributesList = [];
  let deliveryDetailsAttributes = [];
  if (event.body.tags !== undefined && event.body.tags !== null) {
    tagNameList = commonHelper.deepCloneObject(event.body.tags);
  }
  if (event.body.attributes !== undefined && event.body.attributes !== null) {
    attributesList = commonHelper.deepCloneObject(event.body.attributes);
  }
  if (
    event.body.deliveryDetails !== undefined &&
    event.body.deliveryDetails !== null &&
    event.body.deliveryDetails.attributes !== undefined &&
    event.body.deliveryDetails.attributes !== null
  ) {
    deliveryDetailsAttributes = commonHelper.deepCloneObject(event.body.deliveryDetails.attributes);
    event.body.deliveryDetails.attributes = [];
  }
  event.body.tags = [];
  event.body.attributes = [];

  return (
    commonHelper
      .getTagListFromNames(tagNameList, event)
      .then(list => {
        event.body.tags = list;
      })
      .catch(() => {})
      .then(() => commonHelper.getAttributeListFromIds(attributesList, event))
      .then(list => {
        event.body.attributes = list;
      })
      .catch(() => {
        errors.push({
          code: 2107,
          message: 'One or more attributes does not exist.'
        });
      })
      .then(() => commonHelper.getAttributeListFromIds(deliveryDetailsAttributes, event))
      .then(list => {
        if (event.body.deliveryDetails !== undefined && event.body.deliveryDetails !== null) {
          event.body.deliveryDetails.attributes = list;
        }
      })
      .catch(() => {
        errors.push({
          code: 2107,
          message: 'One or more delivery details attributes does not exist.'
        });
      })
      // .then(()=>{
      //   return commonHelper.validateAndGetSystemAttributes('productSysDefinedAttrs',event,typemap);
      //  })
      //  then((list)=> {
      //     event.body.attributes = event.body.attributes.concat(list);
      //     return;
      // }).catch((errorList)=> {
      //     errors = errors.concat(errorList);
      //     return;
      // })
      .then(() => commonHelper.getLocationListFromIds(event.body.addresses))
      .then(list => {
        event.body.addresses = list;
      })
      .catch(() => {
        errors.push({
          code: 2108,
          message: 'One or more locations do not exist.'
        });
      })
      .then(() =>
        commonHelper.getProductListFromIds(event.body.products, event.body.shipmentStatus)
      )
      .then(list => this.validateProductAddition(list, event, event.pathParameters.id))
      .catch(err => {
        errors.push({
          code: 2109,
          message: err
        });
      })
      .then(list => {
        event.body.products = list;
      })
      .catch(err => {
        // ////akUtils.log(err);
        errors.push({
          code: 2109,
          message: err
        });
      })
      .then(() => {
        // ////akUtils.log(errors.length);
        if (errors.length !== 0) {
          return bluebirdPromise.reject(errors);
        }
        return bluebirdPromise.resolve(event);
      })
  );
};

/**
 * Performs save-specific validations before performing common validations.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
shipmentService.prototype.validateRequest = function(event) {
  return this.commonValidations(event)
    .then(() => {})
    .catch(errors => {
      if (!jsTypeChecker.isEmptyObject(errors)) {
        return bluebirdPromise.reject(
          akUtils.getObjectValues(akUtils.sortErrorsObject(errors, 'orders'))
        );
      }
      return this.populateIds(event);
    });
};

/**
 * Performs update-specific validations before performing common validations.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
shipmentService.prototype.validateUpdate = function(event) {
  let basicErrors;
  return this.commonValidations(event)
    .catch(errors => errors)
    .then(errorsIfAny => {
      basicErrors = errorsIfAny || {};
      return bluebirdPromise.all([
        bluebirdPromise.all([
          validator.checkSame('shipments', 'code', event.body.code, event.pathParameters.id)
        ])
      ]);
    })
    .then(result => {
      const mapping = {
        code: {
          index: 0,
          fieldName: 'Shipment#'
        }
      };
      const validationResult = akUtils.mapAndGetValidationErrors(result, mapping);
      const combinedErrors = Object.assign({}, basicErrors, validationResult);
      if (!jsTypeChecker.isEmptyObject(combinedErrors)) {
        return bluebirdPromise.reject(
          akUtils.getObjectValues(akUtils.sortErrorsObject(combinedErrors, 'products'))
        );
      }
      return this.populateIds(event);
    })
    .catch(errors => bluebirdPromise.reject(errors));
};

// shipmentService.prototype.validateBasics = function(event) {
//   let errors = [];

//   if ((typeof event.body.code === 'undefined' || event.body.code.trim() === '') && !event.pathParameters.id) {
//     errors.push({ code: 2001, message: 'Code is mandatory' });
//   }

//    if (!event.body.etd || event.body.etd === null) {
//     errors.push({ code: 2007, message: 'Estimated Time of Delivery is mandatory' });
//   }
//   if (event.body.status !== 0 && event.body.status !== 1) {
//     errors.push({ code: 2003, message: 'Invalid Status' });
//   }
//   if(!event.body.addresses || event.body.addresses.length === 0) {
//     errors.push({ code: 2004, message: 'No Address Specified' });
//   }
//   if (event.body.products  && event.body.products.length === 0) {
//     errors.push({ code: 2109, message: 'Atleast One Product must be added' });
//   }
//   if (event.body.shipmentStatus  && event.body.shipmentStatus > 2) {
//     errors.push({ code: 2110, message: 'Shipment Status cannot greater than 2(scheduled)' });
//   }

//   // Address related validations
//   var addressTypesList = [];
//   event.body.addresses.forEach((address) => {
//     if(addressType.indexOf(address.addressType) < 0) {
//       errors.push({ code: 2004, message: 'Wrong Address key ( ' + address.addressType + ' ) Specified' });
//     }
//     else {
//       addressTypesList.push(address.addressType);
//     }
//   });

//   addressType.forEach((addressType) => {
//     if (addressTypesList.indexOf(addressType) < 0) {
//       errors.push({ code: 2004, message: 'Address key ( ' + addressType + ' ) not Specified' });
//     }
//   });

//   // Product related validations
//   event.body.products.forEach((product) => {
//     if(!product.id) {
//       errors.push({ code: 2109, message: 'Product id is compulsory'});
//     }
//     if(!product.orderId) {
//       errors.push({ code: 2109, message: 'Product orderId is compulsory'});
//     }
//   });

//   errors = errors.concat(commonHelper.validateTags(event.body.tags));
//   errors = errors.concat(commonHelper.validateAttributes(event.body.attributes));

//   return bluebirdPromise.resolve().then(() => {
//     if (!event.body.code) {
//       return bluebirdPromise.reject();
//     }
//     else {
//       return this.isDuplicateCode(event.body.code, event.pathParameters.id);
//     }
//   }).then(() => {
//     errors.push({ code: 2005, message: 'Code already exists' });
//   }).catch(() => {
//     return;
//   })
//     .then(() => {
//       if (errors.length !== 0) {
//         return bluebirdPromise.reject(errors);
//       }
//       else {
//         return bluebirdPromise.resolve(event);
//       }
//     });
// };

/**
 * Performs common validations in both update and save.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
shipmentService.prototype.commonValidations = function(event) {
  return bluebirdPromise
    .all([
      bluebirdPromise.all([
        validator.required(event.body.code),
        validator.stringLength(0, validator.CODE_MAX_LENGTH, event.body.code),
        validator.notDuplicate('shipments', 'code', event.body.code, event.pathParameters.id)
      ]),
      bluebirdPromise.all([validator.valueAllowed([0, 1], event.body.status)]),
      bluebirdPromise.all([
        validator.required(event.body.etd),
        validator.type('string', event.body.etd)
      ]),
      bluebirdPromise.all([
        validator.required(event.body.addresses, {
          multiple: 1
        }),
        validator.type('array', event.body.addresses),
        validator.duplicateArrayElements('addressType', event.body.addresses),
        validator.duplicateArrayElements(
          null,
          (event.body.addresses || []).map(item => item.location.id)
        ),
        validator.arrayOfType('object', event.body.addresses),
        validator.valueAllowed(addressType, event.body.addresses, 'addressType'),
        validator.requiredValues(addressType, event.body.addresses, 'addressType', {
          multiple: 1
        })
      ]),
      bluebirdPromise.all([
        validator.required(event.body.products, {
          multiple: 1
        }),
        validator.type('array', event.body.products),
        validator.arrayOfType('object', event.body.products),
        validator.requiredKeyinObject(event.body.products, 'id'),
        validator.requiredKeyinObject(event.body.products, 'orderId'),
        validator.duplicateArrayElements('id', event.body.products),
        validator.validatePopulatableLists(
          'products',
          (event.body.products || []).map(item => item.id),
          event.pathParameters.id
        ),
        this.validateProductAddition(event, event.pathParameters.id)
      ]),
      bluebirdPromise.all([
        validator.type('array', event.body.tags),
        validator.duplicateArrayElements(null, event.body.tags),
        validator.validatePopulatableLists('tags', event.body.tags),
        validator.arrayOfType('string', event.body.tags)
      ]),
      bluebirdPromise.all([
        validator.type('array', event.body.attributes),
        validator.arrayOfType('object', event.body.attributes),
        validator.validatePopulatableLists('attributes', event.body.attributes),
        validator.duplicateArrayElements('id', event.body.attributes)
      ]),
      bluebirdPromise.all([
        // validator.required(event.body.scheduledPickupDate),
        validator.type('string', event.body.scheduledPickupDate),
        validator.validateTimeDiff(event.body.scheduledPickupDate, event.body.etd)
      ])
    ])
    .then(result => {
      const validatorErrorsMap = {
        code: {
          index: 0,
          fieldName: 'Shipment#'
        },
        status: {
          index: 1,
          fieldName: 'Status'
        },
        etd: {
          index: 2,
          fieldName: 'Scheduled Delivery Date'
        },
        addresses: {
          index: 3,
          fieldName: 'From and To addresses'
        },
        products: {
          index: 4,
          fieldName: 'Products'
        },
        tags: {
          index: 5,
          fieldName: 'Tags'
        },
        attributes: {
          index: 6,
          fieldName: 'Attributes'
        },
        scheduledPickupDate: {
          index: 7,
          fieldName: 'Scheduled Pickup Date--Scheduled Delivery Date'
        }
      };
      let errors = akUtils.mapAndGetValidationErrors(result, validatorErrorsMap);
      if (event.body.scheduleStatus === 'Y') {
        // if (event.body.shipmentStatus !== shipmentStatusArr.Open) {
        return this.specificValidations(event)
          .then(() => {
            if (errors) {
              return bluebirdPromise.reject(errors);
            }
            return bluebirdPromise.resolve();
          })
          .catch(error => {
            errors = Object.assign({}, errors || {}, error);
            if (errors) {
              return bluebirdPromise.reject(errors);
            }
            return bluebirdPromise.resolve();
          });
      }
      if (errors) {
        return bluebirdPromise.reject(errors);
      }
      return bluebirdPromise.resolve();
    });
};

/**
 * Performs common validations in both update and save.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
shipmentService.prototype.specificValidations = function(event) {
  return bluebirdPromise
    .all([
      bluebirdPromise.all([
        validator.required(event.body.carrierUser),
        validator.type('object', event.body.carrierUser),
        validator.requiredKeyinObject(event.body.carrierUser, 'uuid')
      ]),
      bluebirdPromise.all([validator.required(event.body.scheduledPickupDate)])
    ])
    .then(result => {
      const validatorErrorsMap = {
        carrierUser: {
          index: 0,
          fieldName: 'Carrier User'
        },
        scheduledPickupDate: {
          index: 1,
          fieldName: 'Scheduled Pickup Date'
        }
      };

      const errors = akUtils.mapAndGetValidationErrors(result, validatorErrorsMap);
      if (errors) {
        return bluebirdPromise.reject(errors);
      }
      return bluebirdPromise.resolve();
    });
};
shipmentService.prototype.populateIds = function(event) {
  return bluebirdPromise
    .all([
      tagHelper.getForPopulation(event.body.tags),
      attributeHelper.getForPopulation(event.body.attributes),
      commonHelper.populateSystemAttributes('shipmentSysDefinedAttrs', event),
      commonHelper.getLocationListFromIds(event.body.addresses),
      commonHelper.getProductListFromIds(event.body.products, event.body.shipmentStatus)
    ])
    .then(populations => {
      event.body.tags = populations[0];
      event.body.attributes = [...populations[1], ...populations[2]];
      event.body.addresses = populations[3];
      event.body.products = populations[4];
      return bluebirdPromise.resolve(event);
    });
};
shipmentService.prototype.isDuplicate = function(field, value = '', excludedObjId = null) {
  let conditions = {};
  conditions[field] = value;
  if (excludedObjId !== null && mongoose.Types.ObjectId.isValid(excludedObjId)) {
    conditions._id = {
      $ne: mongoose.Types.ObjectId(excludedObjId)
    };
  }
  conditions = clientHandler.addClientFilterToConditions(conditions);

  return shipmentmodel
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
 * Save a shipment
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of save operation.
 * 
 */
shipmentService.prototype.save = function(event, internal = false) {
  const self = this;
  const shipmentObj = new shipmentmodel(); // create a new instance of the  model
  shipmentObj.code = event.body.code;
  shipmentObj.name = event.body.code;
  shipmentObj.isInternal = internal;
  shipmentObj.status = event.body.status ? event.body.status : 1;

  // to do validation for valid status
  shipmentObj.shipmentStatus = internal ? shipmentStatusArr.Delivered : shipmentStatusArr.Open;
  shipmentObj.carrierUser = event.body.carrierUser;

  if (
    event.body.etd !== null &&
    typeof event.body.etd !== 'undefined' &&
    event.body.etd.trim() !== ''
  ) {
    shipmentObj.etd = event.body.etd;
  }
  if (
    event.body.deliverByDate !== null &&
    typeof event.body.deliverByDate !== 'undefined' &&
    event.body.deliverByDate.trim() !== ''
  ) {
    shipmentObj.deliverByDate = event.body.deliverByDate;
  }
  if (
    event.body.scheduledPickupDate !== null &&
    typeof event.body.scheduledPickupDate !== 'undefined' &&
    event.body.scheduledPickupDate.trim() !== ''
  ) {
    shipmentObj.scheduledPickupDate = event.body.scheduledPickupDate;
  }
  shipmentObj.createdOn = Date.now();
  shipmentObj.createdBy = currentUserHandler.getCurrentUser();
  shipmentObj.updatedOn = Date.now();
  shipmentObj.updatedBy = currentUserHandler.getCurrentUser();
  shipmentObj.client = clientHandler.getClient();

  shipmentObj.attributes = event.body.attributes;
  shipmentObj.deliveryDetails = event.body.deliveryDetails;
  shipmentObj.addresses = event.body.addresses;
  shipmentObj.products = event.body.products;
  shipmentObj.tags = event.body.tags;

  shipmentObj.trackingDetails = {};
  event.body.addresses.forEach(address => {
    if (address.addressType === addressType[0]) {
      shipmentObj.trackingDetails.currentLocation = address.location;
    }
  });
  if (internal) {
    shipmentObj.deliveryDate = new Date();
  }
  return shipmentObj
    .save()
    .then(shipmentObj =>
      // save orchestration here
      // return shipmentOrchestrationHelper.save({ 'shipmentId': shipmentObj._id, 'shipmentStatus': shipmentObj.shipmentStatus, 'actionTime': new Date() });
      self.addShipmentOrchestrations(shipmentObj, internal)
    )
    .then(() => {
      // save shipment products orchestration here
      const promises = shipmentObj.products.map(pRow =>
        self.setItemOrchestration(pRow.id, pRow.deliveryStatus, 'shipment', shipmentObj._id)
      );
      return bluebirdPromise.all(promises);
    })
    .then(() =>
      // get shipment current location details
      self.getLocationInformation(shipmentObj)
    )
    .then(currentLocation =>
      // Set shipment initial location details in shipment tracking
      self.updateShipmentLocation(shipmentObj, null, currentLocation)
    )
    .then(() =>
      // if (
      //   shipmentObj.shipmentStatus !== shipStatusMap.Open &&
      //   shipmentObj.shipmentStatus !== shipStatusMap.Canceled
      // ) {
      //   if ((shipmentObj.carrierUser || {}).uuid) {
      //     const params = {
      //       shipmentId: `${shipmentObj._id}`,
      //       shipmentCode: shipmentObj.code,
      //       carrier: shipmentObj.carrierUser,
      //       source: 'save'
      //     };

      //     const recieverData = {
      //       sendType: 'user',
      //       appType: 'carrier',
      //       namedUserId: shipmentObj.carrierUser.email
      //     };

      //     return notificationLib
      //       .saveNotification('CarrierAssignment', params, recieverData, newShipObj.carrierUser)
      //       .then(() => shipmentObj);
      //   }
      //   return bluebirdPromise.resolve(shipmentObj);
      // }
      bluebirdPromise.resolve(shipmentObj)
    );
};

/**
 * Update Shipment initial location
 * 
 * @param {Object} shipmentobj Shipment Data
 * @param {Object} pointData Tracking Data null
 * @param {Object} currenLocation Location Object
 * @return {Promise} Promise after saving
 * 
 */
shipmentService.prototype.updateShipmentLocation = function(
  shipmentobj,
  pointData = null,
  currentLocation
) {
  return shipmentTrackingModel
    .findOne({
      'shipment.id': shipmentobj._id
    })
    .then(shipmentTrackingObj => {
      if (shipmentTrackingObj === null) {
        shipmentTrackingObj = new shipmentTrackingModel();
        shipmentTrackingObj.shipment = {
          id: shipmentobj._id,
          code: shipmentobj.code,
          name: shipmentobj.name
        };
      }
      shipmentTrackingObj.pointId = null;
      shipmentTrackingObj.currentLocation = currentLocation;
      shipmentTrackingObj.device = null;
      shipmentTrackingObj.lastTracked = new Date();
      shipmentTrackingObj.lastMoved = new Date();
      return shipmentTrackingObj.save();
    });
};

shipmentService.prototype.getLocationInformation = function(shipmentObj) {
  // let self = this;
  const locationId = shipmentObj.trackingDetails.currentLocation.id;
  const currentLocation = {};
  let conditions = {
    _id: locationId
  };
  conditions.type = 'location';
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return locationmodel.findOne(conditions).then(locationData => {
    if (locationData) {
      currentLocation.pointCoordinates = locationData.pointCoordinates;
      currentLocation.id = locationData.id;
      currentLocation.name = locationData.name;
      currentLocation.code = locationData.code;
      currentLocation.address = locationData.attributes;
      currentLocation.zones = {};
      return bluebirdPromise.resolve(currentLocation);
    }
    return bluebirdPromise.resolve();
  });
};

/**
 * Update a shipment
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of update operation.
 * 
 */
shipmentService.prototype.update = function update(event) {
  // const orderHelper1 = require('./order');
  const shipmentData = event.body;
  const shipmentId = event.pathParameters.id;
  const action = shipmentData.action;

  const self = this;

  let updatedShipmentObj = '';

  let oldShipObj;
  let newShipObj;
  const shippedItems = [];
  let condition = {
    _id: shipmentId
  };
  condition = clientHandler.addClientFilterToConditions(condition);
  return shipmentmodel
    .findOne(condition)
    .then(shipmentObj => {
      if (shipmentObj === null) {
        return false;
      }
      oldShipObj = JSON.parse(JSON.stringify(shipmentObj));
      const shipmentUpdateObj = {};

      shipmentUpdateObj.status = shipmentData.status ? shipmentData.status : 1;
      shipmentUpdateObj.carrierUser = shipmentData.carrierUser;

      // to do validate valid status
      // if (action !== 'edit') { // don't change status
      //   if (shipmentData.shipmentStatus) {
      //     shipmentUpdateObj.shipmentStatus = shipmentData.shipmentStatus;
      //   }
      // }

      if (shipmentData.scheduleStatus === 'Y') {
        shipmentUpdateObj.shipmentStatus = shipmentStatusArr.Scheduled;
      }

      // Don't update items unless shipment is open or scheduled
      if (
        shipmentObj.shipmentStatus === shipmentStatusArr.Open ||
        shipmentObj.shipmentStatus === shipmentStatusArr.Scheduled
      ) {
        // let itemStatus = '';
        // if (shipmentObj.shipmentStatus === shipmentStatusArr.Open) {
        //   itemStatus = itemStatusArr.Open;
        // } else {
        //   itemStatus = itemStatusArr.Scheduled;
        // }
        // shipmentData.products.forEach((row, idx) => {
        //   shipmentData.products[idx].deliveryStatus = itemStatus;
        // });

        shipmentData.products.forEach((st, index) => {
          const fProduct = (shipmentObj.products || []).filter(row => {
            // don't update item status already presetn or unless shipment scheduled. To do whats if same item exist in multiple order
            if (row.id.equals(shipmentData.products[index].id)) {
              return row;
            }
          });

          if (fProduct.length) {
            // already saved items
            if (fProduct[0].deliveryStatus === itemStatusArr.Canceled) {
              // cancelled

              shipmentData.products[index].deliveryStatus = fProduct[0].deliveryStatus;
            } else if (
              shipmentData.scheduleStatus === 'Y' &&
              fProduct[0].deliveryStatus === itemStatusArr.Open
            ) {
              // open + schedule request

              shipmentData.products[index].deliveryStatus = itemStatusArr.Scheduled;
              shippedItems.push(shipmentData.products[index]);
            } else if (fProduct[0].deliveryStatus === itemStatusArr.Scheduled) {
              // scheduled

              shipmentData.products[index].deliveryStatus = fProduct[0].deliveryStatus;
            }
          } else {
            // new items
            if (shipmentData.scheduleStatus === 'Y') {
              shipmentData.products[index].deliveryStatus = itemStatusArr.Scheduled;
            } else {
              shipmentData.products[index].deliveryStatus = itemStatusArr.Open;
            }
            shippedItems.push(shipmentData.products[index]);
          }
        });

        shipmentUpdateObj.products = shipmentData.products;
      }

      shipmentUpdateObj.etd = shipmentData.etd || null;

      shipmentUpdateObj.deliverByDate = shipmentData.deliverByDate || null;

      shipmentUpdateObj.scheduledPickupDate = shipmentData.scheduledPickupDate || null;

      shipmentUpdateObj.updatedOn = Date.now();
      shipmentUpdateObj.updatedBy = currentUserHandler.getCurrentUser();
      shipmentUpdateObj.client = clientHandler.getClient();

      shipmentUpdateObj.attributes = shipmentData.attributes;
      shipmentUpdateObj.deliveryDetails = shipmentData.deliveryDetails;
      shipmentUpdateObj.addresses = shipmentData.addresses;
      shipmentUpdateObj.tags = shipmentData.tags;
      newShipObj = JSON.parse(JSON.stringify(shipmentUpdateObj));

      // return shipmentObj.save();
      const updateParams = {
        $set: shipmentUpdateObj,
        $inc: {
          __v: 1
        }
      };
      return shipmentmodel
        .findOneAndUpdate(
          {
            _id: shipmentId
          },
          updateParams,
          {
            upsert: false,
            new: true
          }
        )
        .exec();
    })
    .then(shipmentObj => {
      updatedShipmentObj = shipmentObj;
      // save shipment products orchestration here
      if (shippedItems.length) {
        const promises = shippedItems.map(pRow =>
          self.setItemOrchestration(
            pRow.id,
            pRow.deliveryStatus,
            'shipment',
            updatedShipmentObj._id
          )
        );
        return bluebirdPromise.all(promises);
      }
      return bluebirdPromise.resolve(updatedShipmentObj);
    })
    .then(() =>
      // if (updatedShipmentObj.shipmentStatus === shipStatusMap.Scheduled) {
      //   // update order products status here
      //   return bluebirdPromise.map(updatedShipmentObj.products, (element) => {
      //     let condition = {
      //       '_id': mongoose.Types.ObjectId(element.orderDetails.id)
      //     };
      //     return ordermodel.findOne(condition).exec()
      //       .then((orderObj) => {
      //         orderObj.products.forEach((st, index) => {
      //           // update item status to scheduled
      //           if (element.id.equals(orderObj.products[index].id)) {
      //             orderObj.products[index].deliveryStatus = itemStatusArr.Scheduled;
      //           }
      //         });
      //         return orderObj.save();
      //       })
      //       .then((orderObj) => {
      //         // order item orchestration
      //         return self.setItemOrchestration(element.id, itemStatusArr.Scheduled, 'order', orderObj._id);
      //       });
      //   });
      // } else {
      //   return bluebirdPromise.resolve(updatedShipmentObj);
      // }
      bluebirdPromise.resolve(updatedShipmentObj)
    )
    .then(() =>
      // if (
      //   newShipObj.shipmentStatus !== shipStatusMap.Open &&
      //   newShipObj.shipmentStatus !== shipStatusMap.Canceled
      // ) {
      //   if (
      //     oldShipObj.shipmentStatus === shipStatusMap.Open ||
      //     oldShipObj.shipmentStatus === shipStatusMap.Canceled ||
      //     ((newShipObj.carrierUser || {}).uuid &&
      //       (oldShipObj.carrierUser || {}).uuid !== (newShipObj.carrierUser || {}).uuid)
      //   ) {
      //     const params = {
      //       shipmentId: event.pathParameters.id,
      //       shipmentCode: oldShipObj.code,
      //       carrier: newShipObj.carrierUser,
      //       source: 'update'
      //     };

      //     const recieverData = {
      //       sendType: 'user',
      //       appType: 'carrier',
      //       namedUserId: newShipObj.carrierUser.email
      //     };

      //     return notificationLib
      //       .saveNotification('CarrierAssignment', params, recieverData, newShipObj.carrierUser)
      //       .then(() => updatedShipmentObj);
      //   }
      //   return bluebirdPromise.resolve(updatedShipmentObj);
      // }
      bluebirdPromise.resolve(updatedShipmentObj)
    )
    .then(() => {
      if (action === 'edit') {
        return bluebirdPromise.resolve(updatedShipmentObj);
      }
      // capture shipment status
      return shipmentOrchestrationHelper.update({
        shipmentId: updatedShipmentObj._id,
        shipmentStatus: updatedShipmentObj.shipmentStatus,
        actionTime: new Date()
      });
    });
};

shipmentService.prototype.validateProductAddition = function validateProductAddition(
  event,
  excludedObjId = null
) {
  if (!event.body.products) {
    return bluebirdPromise.resolve({
      status: true,
      validatorErrors: {}
    });
  }
  if (!event.body.etd) {
    return bluebirdPromise.resolve({
      status: true,
      validatorErrors: {}
    });
  }
  // var moment = require('moment-timezone');
  // const tz = ((event.headers || {}).authorizer || {}).zoneinfo;
  const timediff = require('timediff');
  const etd = event.body.etd;
  const shipToAddress = (event.body.addresses || [])
    .filter(address => address.addressType === addressType[1])
    .map(address => (address.location || {}).id)[0];
  // var spd = event.body.schesduledPickupDate;
  const orderEtdDeliveryGap = 15;
  // const surgerySpdGap = 15;
  const shipmentEtdDeliveryGap = 60;
  const prevOrderEtdDeliveryGap = 60;
  const noOrderAttachedString = 'Following Products do not have order assigned to them: ';
  const noOrderAttached = [];
  const diffToAddressString = 'Following Products have different To Address than this shipment: ';
  let diffToAddress = [];
  const etdIssueString = `Scheduled Delivery Date must have a gap of at least ${prevOrderEtdDeliveryGap} minutes between shipments. Please correct following: `;
  let etdIssue = [];
  const orderEtdIssueString = `Scheduled Delivery Date must be less by at least ${orderEtdDeliveryGap} minutes from surgery Date of following orders:`;
  let orderEtdIssue = [];

  const err = [];
  let searchParams = {};
  searchParams = clientHandler.addClientFilterToConditions(searchParams);
  if (excludedObjId !== null) {
    searchParams._id = {
      $ne: mongoose.Types.ObjectId(excludedObjId)
    };
  }
  return commonHelper
    .getProductListFromIds(event.body.products, event.body.shipmentStatus)
    .then(productList =>
      bluebirdPromise
        .each(productList, product => {
          if (!product.orderDetails) {
            noOrderAttached.push(product.name);
            return;
          }
          if (`${(product.orderDetails.toAddress || {}).id || ''}` !== `${shipToAddress}`) {
            diffToAddress.push({
              product: product.name,
              order: (product.orderDetails || {}).code || '',
              toAddress: (product.orderDetails.toAddress || {}).name || ''
            });
            return;
          }
          let orderEtd = product.orderDetails.etd;

          if (timediff(etd, orderEtd, 'm').minutes < orderEtdDeliveryGap) {
            orderEtd = akUtils.convertDateToTimezone({
              dateToConvert: product.orderDetails.etd,
              timeZone: (currentUserHandler.getCurrentUser() || {}).timezone,
              formatType: 'dt'
            });
            orderEtdIssue.push({
              order: product.orderDetails.code,
              surgeryDate: orderEtd
            });
            return;
          }
          const project = {
            _id: 1,
            code: 1,
            etd: 1
          };
          project.products = {
            $filter: {
              input: '$products',
              as: 'product',
              cond: {
                $eq: ['$$product.id', mongoose.Types.ObjectId(product.id)]
              }
            }
          };
          searchParams['products.id'] = mongoose.Types.ObjectId(product.id);

          return shipmentmodel
            .aggregate()
            .match(searchParams)
            .project(project)
            .exec()
            .then(result => {
              result.forEach(shipment => {
                if (shipment && shipment.products) {
                  const prevShipEtd = shipment.etd;
                  const prevCurrShipEtdDiff = timediff(prevShipEtd, etd, 'm').minutes;
                  const currPrevShipEtdDiff = timediff(etd, prevShipEtd, 'm').minutes;
                  if (
                    prevCurrShipEtdDiff < shipmentEtdDeliveryGap &&
                    shipmentEtdDeliveryGap > currPrevShipEtdDiff
                  ) {
                    const t = akUtils.convertDateToTimezone({
                      dateToConvert: prevShipEtd,
                      timeZone: (currentUserHandler.getCurrentUser() || {}).timezone,
                      formatType: 'dt'
                    });
                    etdIssue.push({
                      eShipment: shipment.code,
                      time: t,
                      product: product.name
                    });
                    // const e = 'Scheduled Delivery Date must have a gap of at least ' + prevOrderEtdDeliveryGap + ' minutes from Shipment# ' + shipment.code + ' having Scheduled Delivery Date: ' + t + ' as product: ' + product.name + ' is already assigned to it';
                    // err.push(e);
                  }
                }
              });
            });
        })
        .then(() => {
          let result = {
            status: true,
            validatorErrors: {}
          };
          if (noOrderAttached.length > 0) {
            const e = `${noOrderAttachedString}<br>${noOrderAttached.join('<br>')}`;
            err.push(e);
          }

          if (etdIssue.length > 0) {
            etdIssue = etdIssue.map(
              issue =>
                `Product: ${issue.product} cannot be assigned to this shipment as it is already assigned into Shipment# ${issue.eShipment} having Scheduled Delivery Date: ${issue.time}. Please select the Scheduled Delivery Date having a gap of at least ${prevOrderEtdDeliveryGap} minutes.`
            );
            const e = `${etdIssue.join('<br>')}`;
            err.push(e);
          }
          if (orderEtdIssue.length > 0) {
            orderEtdIssue = Array.from(new Set(orderEtdIssue.map(JSON.stringify))).map(JSON.parse);
            orderEtdIssue = orderEtdIssue.map(
              issue => `Order#: ${issue.order} Surgery Date: ${issue.surgeryDate}`
            );
            const e = `${orderEtdIssueString}<br>${orderEtdIssue.join('<br>')}`;
            err.push(e);
          }
          if (diffToAddress.length > 0) {
            diffToAddress = diffToAddress.map(
              issue =>
                `Product: ${issue.product} Order: ${issue.order} toAddress: ${issue.toAddress}`
            );
            const e = `${diffToAddressString}<br>${diffToAddress.join('<br>')}`;
            err.push(e);
          }
          if (err.length > 0) {
            result = {
              status: false,
              validatorErrors: {
                eCode: 'ak-productAddition',
                data: err.join('<br>')
              }
            };
          }

          return bluebirdPromise.resolve(result);
        })
        .catch(error => {
          const result = {
            status: false,
            validatorErrors: {
              eCode: 'ak-productAddition',
              data: error
            }
          };
          return bluebirdPromise.resolve(result);
        })
    )
    .catch(error => {
      const result = {
        status: false,
        validatorErrors: {
          eCode: 'ak-productAddition',
          data: error
        }
      };
      return bluebirdPromise.resolve(result);
    });
};

shipmentService.prototype.schedule = function schedule(shipmentList) {
  let newShipObj;
  let oldShipObj;
  let failedShipments = [];
  const self = this;
  // let shipmentList = event.body.shipments;
  return shipmentmodel
    .find({
      _id: {
        $in: shipmentList
      }
    })
    .exec()
    .then(shipments => {
      failedShipments = shipments
        .filter(
          shipment =>
            ((shipment.carrierUser || {}).uuid || '').trim() === '' ||
            shipment.scheduledPickupDate === null ||
            typeof shipment.scheduledPickupDate === 'undefined'
        )
        .map(item => item.code);
      shipments = shipments.filter(
        shipment =>
          ((shipment.carrierUser || {}).uuid || '').trim() !== '' &&
          shipment.scheduledPickupDate !== null &&
          typeof shipment.scheduledPickupDate !== 'undefined'
      );
      akUtils.log(shipments, 'requiredLog');
      return bluebirdPromise.each(shipments, shipment => {
        oldShipObj = JSON.parse(JSON.stringify(shipment));
        // if already scheduled don't capture action
        let ifAlreadyScheduled = false;
        if (shipment.shipmentStatus === shipmentStatusArr.Scheduled) {
          ifAlreadyScheduled = true;
        }
        // if (shipment.shipmentStatus !== shipmentStatusArr.Open) {
        //   return;
        // }

        let shipmentData = '';

        shipment.client = clientHandler.getClient();

        shipment.shipmentStatus = shipmentStatusArr.Scheduled;
        shipment.products.forEach(product => {
          product.deliveryStatus = itemStatusArr.Scheduled;
        });
        shipment.updatedBy = currentUserHandler.getCurrentUser();
        let conditions = {
          _id: shipment._id
        };
        conditions = clientHandler.addClientFilterToConditions(conditions);
        newShipObj = JSON.parse(JSON.stringify(shipment));
        return shipmentmodel
          .findOneAndUpdate(conditions, shipment, {
            upsert: false,
            new: true
          })
          .exec()
          .then(shipmentObj => {
            shipmentData = shipmentObj;
            // shipment items orchestration
            if (!ifAlreadyScheduled) {
              // fallback
              const promises = shipmentData.products.map(pRow => {
                if (pRow.deliveryStatus !== itemStatusArr.Canceled) {
                  return self.setItemOrchestration(
                    pRow.id,
                    pRow.deliveryStatus,
                    'shipment',
                    shipmentData._id
                  );
                }
              });
              return bluebirdPromise.all(promises);
            }
            return bluebirdPromise.resolve(shipmentData);
          })
          .then(() =>
            // update order products status here
            bluebirdPromise.map(shipmentData.products, element => {
              const condition = {
                _id: mongoose.Types.ObjectId(element.orderDetails.id)
              };
              let scheduleItem = false;
              return ordermodel
                .findOne(condition)
                .exec()
                .then(orderObj => {
                  orderObj.products.forEach((st, index) => {
                    // if (orderObj.products[index].deliveryStatus === itemStatusArr.Scheduled) {
                    //   itemAlreadyScheduled = true;
                    // }
                    // update item status to scheduled
                    if (element.id.equals(orderObj.products[index].id)) {
                      scheduleItem = true;
                      orderObj.products[index].deliveryStatus = itemStatusArr.Scheduled;
                    }
                  });
                  return orderObj.save();
                })
                .then(orderObj => {
                  // order item orchestration
                  if (scheduleItem) {
                    return self.setItemOrchestration(
                      element.id,
                      itemStatusArr.Scheduled,
                      'order',
                      orderObj._id
                    );
                  }
                  return false;
                });
            })
          )
          .then(() => {
            const shipmentObj = shipmentData;
            // if (
            //   oldShipObj.shipmentStatus !== shipStatusMap.Open &&
            //   newShipObj.shipmentStatus !== shipStatusMap.Canceled
            // ) {
            //   if (
            //     (newShipObj.carrierUser || {}).uuid &&
            //     (oldShipObj.carrierUser || {}).uuid !== (newShipObj.carrierUser || {}).uuid
            //   ) {
            //     const params = {
            //       shipmentId: event.pathParameters.id,
            //       shipmentCode: newShipObj.code,
            //       carrier: newShipObj.carrierUser,
            //       source: 'schedule'
            //     };

            //     const recieverData = {
            //       sendType: 'user',
            //       appType: 'carrier',
            //       namedUserId: newShipObj.carrierUser.email
            //     };

            //     return notificationLib
            //       .saveNotification(
            //         'CarrierAssignment',
            //         params,
            //         recieverData,
            //         newShipObj.carrierUser
            //       )
            //       .then(() => shipmentObj);
            //   }
            //   return bluebirdPromise.resolve(shipmentObj);
            // }
            return bluebirdPromise.resolve(shipmentObj);
          })
          .then(shipmentObj => {
            if (!ifAlreadyScheduled) {
              return shipmentOrchestrationHelper
                .update({
                  shipmentId: shipmentObj._id,
                  shipmentStatus: shipmentObj.shipmentStatus,
                  actionTime: new Date()
                })
                .then(() => notificationLib.sendShipmentScheduledNotification(shipmentObj._id));
            }
            return bluebirdPromise.resolve(shipmentObj);
          });
      });
    })
    .then(() => {
      akUtils.log(failedShipments);
      if (failedShipments.length) {
        akUtils.log(failedShipments);
        const err = failedShipments.map(
          ship =>
            `Either the carrier user or pickup date is not set for shipment# ${ship}. Unable to schedule pickup`
        );
        return bluebirdPromise.reject(err);
      }
      return bluebirdPromise.resolve();
    });
};

shipmentService.prototype.getShipmentsofOrder = function({ orderId = '', mobile = false }) {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return bluebirdPromise.reject();
  }
  // //akUtils.log(orderId);
  let condition = {
    'products.orderDetails.id': mongoose.Types.ObjectId(orderId)
  };
  condition = clientHandler.addClientFilterToConditions(condition);
  // let project = { 'products.orderDetails.id' : mongoose.Types.ObjectId(orderId) }
  // let project = {'products':{'orderDetails':{'id':{$eq: mongoose.Types.ObjectId(orderId)}}}};
  return (
    shipmentmodel
      .aggregate()
      .match(condition)
      // .project(project)
      .collation({
        locale: 'en_US',
        caseLevel: false
      })
      .exec()
      .then(result => {
        const list = [];
        if (result) {
          for (let i = 0; i < result.length; i++) {
            if (mobile) {
              list.push(this.formatResponseForMobile(result[i]));
            } else {
              list.push(this.formatResponse(result[i]));
            }
          }
        }
        return list;
      })
      .then(result => {
        if (result.length === 0) {
          return bluebirdPromise.resolve([]);
        }
        return bluebirdPromise.resolve(result);
      })
  );
};

shipmentService.prototype.setShipmentShipped = function(shipmentId, shipTime) {
  const itemStatus = require('../mappings/itemStatus.json');
  const shipmentStatus = require('../mappings/shipmentStatus.json');
  let didStatusChange = false;
  let condition = {
    _id: shipmentId
  };
  condition = clientHandler.addClientFilterToConditions(condition);
  return shipmentmodel
    .findOne(condition)
    .then(shipmentObj => {
      if (shipmentObj === null) {
        return false;
      }

      const sproducts = shipmentObj.products.filter(row => {
        if (row.deliveryStatus === itemStatus.Shipped) {
          return row;
        }
      });
      const oldStatus = shipmentObj.shipmentStatus;
      if (sproducts.length === shipmentObj.products.length) {
        shipmentObj.shipmentStatus = shipmentStatus.Shipped;
      } else {
        shipmentObj.shipmentStatus = shipmentStatus.PartialShipped;
      }
      didStatusChange = oldStatus !== shipmentObj.shipmentStatus;
      shipmentObj.updatedOn = new Date();
      shipmentObj.shipDate = shipTime;

      return shipmentObj.save();
    })
    .then(shipmentObj =>
      shipmentOrchestrationHelper
        .update({
          shipmentId: shipmentObj._id,
          shipmentStatus: shipmentObj.shipmentStatus,
          actionTime: shipTime
        })
        .then(() => {
          if (didStatusChange) {
            if (shipmentObj.shipmentStatus === shipmentStatus.Shipped) {
              return notificationLib.sendShipmentHardShippedNotification(shipmentObj._id);
            }
            return notificationLib.sendShipmentPartialShippedNotification(shipmentObj._id);
          }
        })
    );
};

shipmentService.prototype.setShipmentDelivered = function(
  shipmentId,
  deliveryTime,
  deliveryDetails = null,
  forceDeliver = true,
  isAdminDelivered = 0
) {
  let didStatusChange = false;

  const itemStatus = require('../mappings/itemStatus.json');
  const shipmentStatus = require('../mappings/shipmentStatus.json');
  const self = this;
  let condition = {
    _id: shipmentId
  };
  condition = clientHandler.addClientFilterToConditions(condition);
  return shipmentmodel
    .findOne(condition)
    .then(shipmentObj => {
      if (shipmentObj === null) {
        return false;
      }

      const sproducts = shipmentObj.products.filter(row => {
        if (row.deliveryStatus === itemStatus.Delivered) {
          return row;
        }
      });
      const oldStatus = shipmentObj.shipmentStatus;
      if (sproducts.length === shipmentObj.products.length || forceDeliver === true) {
        shipmentObj.shipmentStatus = shipmentStatus.Delivered;
      } else {
        shipmentObj.shipmentStatus = shipmentStatus.PartialDelivered;
      }
      didStatusChange = oldStatus !== shipmentObj.shipmentStatus;
      shipmentObj.deliveryDate = deliveryTime || new Date();
      shipmentObj.updatedOn = new Date();

      if (deliveryDetails !== null) {
        shipmentObj.deliveryDetails = deliveryDetails;
      }

      shipmentObj.isAdminDelivered = isAdminDelivered;

      return shipmentObj.save();
    })
    .then(shipmentObj =>
      // missing coode here
      self.markMissingItems(shipmentObj).then(() => bluebirdPromise.resolve(shipmentObj))
    )
    .then(shipmentObj =>
      self
        .deliveryReport(shipmentObj)
        .then(res => {
          if (typeof res.Payload !== typeof {} && res.Payload !== '') {
            res.Payload = JSON.parse(res.Payload || {});
          }

          console.log('++++ DELIVERY REPORT Success++++');
          console.log(res.Payload);
          shipmentObj.deliveryDetails.pdfUrl = res.Payload.url || '';
          return shipmentObj.save();
        })
        .catch(err => {
          akUtils.log('++++ DELIVERY REPORT FAIL++++');
          akUtils.log(err);
          return shipmentObj;
        })
    )
    .then(shipmentObj =>
      shipmentOrchestrationHelper
        .update({
          shipmentId: shipmentObj._id,
          shipmentStatus: shipmentObj.shipmentStatus,
          actionTime: deliveryTime
        })
        .then(() => {
          if (didStatusChange) {
            if (shipmentObj.shipmentStatus === shipmentStatus.Delivered) {
              return notificationLib.sendShipmentHardDeliveredNotification(shipmentObj._id);
            }
            return notificationLib.sendShipmentPartialDeliveredNotification(shipmentObj._id);
          }
          return {};
        })
        .then(() => bluebirdPromise.resolve(shipmentObj))
    )
    .catch(err => {
      akUtils.log(err);
    });
};

shipmentService.prototype.markMissingItems = function(params) {
  akUtils.log('************** START *****************');
  // let items = [];
  // params.products.forEach( (product) => {
  //   items.push(product.id);
  // })
  // // console.log(items);

  akUtils.log(`Shipment No : ${params.code}`);

  let isItemsMissing = false;
  const missedItemsLoc = [];
  const missedItems = [];

  const addressesObj = {};
  for (const x of params.addresses) {
    addressesObj[x.addressType] = x;
  }

  const fromLocation = (addressesObj.shipFromAddress || {}).location || {};
  const toLocation = (addressesObj.shipToAddress || {}).location || {};
  const toLocationLatLongObj = { lat: 0, long: 0 };

  if (toLocation.id && params.products.length > 0) {
    // get from location lat long
    return locationHelper
      .getById(toLocation.id)
      .then(locationObj => {
        toLocationLatLongObj.lat = locationObj.coordinates.latitude;
        toLocationLatLongObj.long = locationObj.coordinates.longitude;

        const promises = params.products.map(item => {
          let tolat = 0,
            tolong = 0,
            locId = 0;
          item.id = mongoose.Types.ObjectId(item.id);

          return productTrackingModel
            .findOne({ 'product.id': item.id })
            .exec()
            .then(productLocation => {
              if (productLocation === null) {
                return bluebirdPromise.resolve({});
              }
              // get product current location here
              tolat = productLocation.currentLocation.pointCoordinates.coordinates[1];
              tolong = productLocation.currentLocation.pointCoordinates.coordinates[0];
              locId = productLocation.currentLocation.id;

              const locAddress = commonHelper.getCurrentLocationString(
                productLocation.currentLocation || {}
              );

              akUtils.log(`Delivery Loc name : ${toLocation.name}`);
              akUtils.log('Delivery Loc details start :');
              toLocation.address.map(addr => {
                akUtils.log(`${addr.name} : ${addr.value}`);
              });
              akUtils.log(
                `Delivery Loc latlong : ${toLocationLatLongObj.lat}|${toLocationLatLongObj.long}`
              );
              akUtils.log('Delivery Loc details end');
              akUtils.log(`Product : ${item.name}`);
              akUtils.log(`Product Status : ${item.deliveryStatus}`);
              akUtils.log(`Product latlong: ${tolat}|${tolong}`);

              if (!locationObj.id.equals(locId)) {
                // update SKU missing flag here
                if (item.isMissing !== 1) {
                  isItemsMissing = true;
                  akUtils.log('****************************');
                  akUtils.log('Product Marked Missing');
                  akUtils.log('****************************');
                  missedItems.push(item.id);
                  missedItemsLoc.push(locAddress); // if more than one items missing at same location
                  akUtils.log(`Product Location : ${locAddress}`);

                  // mark shipment and item missing here
                  const shipmentUpdateObj = {};
                  shipmentUpdateObj.products = params.products.map(row => {
                    if (row.id.equals(item.id)) {
                      row.isMissing = 1;
                    }
                    return row;
                  });
                  shipmentUpdateObj.hasMissingItems = 1;
                  shipmentUpdateObj.updatedOn = Date.now();
                  shipmentUpdateObj.updatedBy = currentUserHandler.getCurrentUser();
                  shipmentUpdateObj.client = clientHandler.getClient();

                  const updateParams = {
                    $set: shipmentUpdateObj,
                    $inc: {
                      __v: 1
                    }
                  };
                  return shipmentmodel
                    .findOneAndUpdate(
                      {
                        _id: params.id
                      },
                      updateParams,
                      {
                        upsert: false,
                        new: true
                      }
                    )
                    .exec();
                }
              } else {
                return bluebirdPromise.resolve({});
              }
            });
        });
        return bluebirdPromise.all(promises);
      })
      .then(() => {
        // notification here
        if (isItemsMissing) {
          akUtils.log('************** Notification *****************');
          let comment = '';
          comment = `Product(s) for shipment # ${params.code} are shipped to ${toLocation.name}`;
          if (missedItemsLoc.length > 0) {
            comment += ` but lying at ${missedItemsLoc.join(' | ')}`;
          }
          const issueObj = {};
          issueObj.body = {
            shippingNo: params.id,
            comment,
            skuIds: missedItems.join(',')
          };
          return issueHelper.save(issueObj);
        }
        return bluebirdPromise.resolve({});
      })
      .then(() => {
        akUtils.log('************** END *****************');
        return bluebirdPromise.resolve({});
      });
  }
};
shipmentService.prototype.fetchIssueOfShipment = function(shipment) {
  const issueHelper = require('./issue');
  return issueHelper
    .getById(shipment.issue, 'web')
    .then(res => {
      return bluebirdPromise.resolve(res);
    })
    .catch(() => {
      return bluebirdPromise.resolve([]);
    });
};

shipmentService.prototype.deliveryReport = function(shipmentObj) {
  const templateDirectory = require('path').join(__dirname, '../pdf-templates');
  const cd = akUtils.convertDateToTimezone({
    dateToConvert: shipmentObj.deliveryDate,
    timeZone: (currentUserHandler.getCurrentUser() || {}).timezone,
    formatType: 'dt'
  });

  const fileName = `POD_${shipmentObj.code}.pdf`;
  const a = require('path').join(templateDirectory, 'proofofdelivery');
  const emailTemplateData = new EmailTemplate(a);

  const orderList = shipmentObj.products.map(p => mongoose.Types.ObjectId(p.orderDetails.id));
  return this.fetchIssueOfShipment(shipmentObj).then(issue => {
    return ordermodel
      .find({ _id: { $in: orderList } })
      .exec()
      .then(orders => {
        const notes = (issue || []).map(cmt => {
          const temp = {};
          temp.items = cmt.items.map(itm => itm.name).join(', ');          
          temp.comment = cmt.comment;
          temp.author = `${cmt.author.firstName || ''} ${cmt.author.lastName || ''}`;
          return temp;
        });

        const orderProducts = [];
        orders.forEach(order => {
          order = commonHelper.moveSystemAttributesToGlobal(commonHelper.deepCloneObject(order));
          const temp = {};
          temp.code = order.code;
          temp.surgeon = order.surgeon;
          temp.surgery = order.surgery;
          temp.etd = akUtils.convertDateToTimezone({
            dateToConvert: order.etd,
            timeZone: (currentUserHandler.getCurrentUser() || {}).timezone,
            formatType: 'dt'
          });
          temp.products = shipmentObj.products
            .filter(product => `${product.orderDetails.id}` === `${order._id}`)
            .map(product => {
              product = commonHelper.deepCloneObject(product);
              product.deliveryStatusLabel = akUtils.objectKeyByValue(
                itemStatusLabel,
                product.deliveryStatus
              );
              return product;
            });
          orderProducts.push(temp);
        });

        const addresses = (shipmentObj.addresses || []).reduce((a, b) => {
          const temp = {};
          temp.name = (b.location || {}).name || '';
          const loc = ((b.location || {}).address || []).reduce((initial, current) => {
            initial[current.name] = current.value;
            return initial;
          }, {});

          a[b.addressType] = Object.assign({}, temp, loc);
          return a;
        }, {});

        // console.log(orderProducts);
        const phoneCode = (addresses.shipToAddress || {}).phonecode || '';
        return countryHelper.getDialCodeFromShortCode(phoneCode).then(pc => {
          let data = {
            phone: `+${pc} ${(addresses.shipToAddress || {}).phone || ''}`,
            fax: 'fax',
            logo: process.env.companyLogo,
            shippingDetails_name: (addresses.shipToAddress || {}).name || '',
            shippingDetails_address: (addresses.shipToAddress || {}).address || '',
            shippingDetails_city: (addresses.shipToAddress || {}).city || '',
            shippingDetails_state: (addresses.shipToAddress || {}).state || '',
            shippingDetails_pincode: (addresses.shipToAddress || {}).zipcode || '',
            shippingDetails_deliveredBy: akUtils.convertDateToTimezone({
              dateToConvert: shipmentObj.etd,
              timeZone: (currentUserHandler.getCurrentUser() || {}).timezone,
              formatType: 'dt'
            }),
            shippingDetails_deliveryDate: cd,
            shippingDetails_products: shipmentObj.products,
            orderProducts,
            doctorName: 'doctorName',
            caseNo: shipmentObj.products.map(product => product.orderDetails.code).join(','),
            surgeryDate: 'surgeryDate',
            shipmentNo: shipmentObj.code,
            consumerName: `${(shipmentObj.carrierUser || {}).firstName ||
              ''} ${(shipmentObj.carrierUser || {}).lastName || ''}`,
            hospitalName: (addresses.shipToAddress || {}).name,
            procedureName: 'procedureName',
            shippingDetails_recipientName:
              (shipmentObj.deliveryDetails || {}).recipientFirstName || '',
            shippingDetails_recipientMobile:
              (shipmentObj.deliveryDetails || {}).recipientMobileCode +
              (shipmentObj.deliveryDetails || {}).recipientMobileNumber,
            signatureImage: ((shipmentObj.deliveryDetails || {}).images || [])[0] || '',
            dueDate: 'dueDate',
            notes:notes
          };
          data = akUtils.cleanFormatResponse(data);
          const promisifiedEmailRender = bluebirdPromise.promisify(
            emailTemplateData.render.bind(emailTemplateData)
          );
          // html to pdf options
          const options = {
            footer: {
              height: '12mm',
              contents: {
                default:
                  ' <div style="height:20px; margin-top:-6.5px; background-color: #434343; width: 96%; margin-left:12px"></div><div style="text-align:center; font-size:10px">Page <span style="color: #444;">{{page}}</span> of <span>{{pages}}</span></div>' // fallback value
              }
            },
            header: {
              height: '24px',
              contents: {
                1: '<div></div>',
                default:
                  '<div style="border-bottom:1px solid #ccc; width: 95.85%; margin-left:12px;font-size:8px">&nbsp;</div><div style="height:18px;width: 95.5%; margin-left:12px;border-left:1px solid #ccc; border-right:1px solid #ccc"></div> '
              }
            }
          };
          return promisifiedEmailRender(data)
            .then(result =>
              lambda.promisifiedExecute({
                functionName: 'ak-htmltopdf-generate',
                payload: {
                  filename: fileName,
                  html: result.html,
                  options
                },
                alias: 'qc'
              })
            )
            .then(res => {
              akUtils.log(res, 'PDF generation response');
              return bluebirdPromise.resolve(res);
            });
        });
      });
  });
};

shipmentService.prototype.getShipmentsForMobile = function(
  searchParams,
  otherParams,
  history = false
) {
  searchParams = clientHandler.addClientFilterToConditions(searchParams);
  const uId = (currentUserHandler.getCurrentUser() || {}).uuid;

  searchParams.$or = [
    {
      'carrierUser.id': uId
    },
    {
      'carrierUser.uuid': uId
    }
  ];
  searchParams.shipmentStatus = {
    $in: [
      shipStatusMap.Scheduled,
      shipStatusMap.PartialShipped,
      shipStatusMap.SoftShipped,
      shipStatusMap.Shipped,
      shipStatusMap.PartialDelivered,
      shipStatusMap.SoftDelivered,
      shipStatusMap.Delivered
    ]
  };
  // //akUtils.log(JSON.stringify(searchParams))
  return shipmentmodel
    .find(searchParams)
    .sort({
      shipmentStatus: 1,
      code: 1
    })
    .exec()
    .then(result =>
      bluebirdPromise.map(result, data => {
        const addressesObj = {};
        for (const x of data.addresses) {
          addressesObj[x.addressType] = x;
        }

        const formattedResponse = {};
        formattedResponse.id = data._id;
        formattedResponse.caseNo = '';
        formattedResponse.shipmentNo = data.code;
        formattedResponse.isReported = data.issue ? 1 : 0;
        formattedResponse.shipStatus = data.shipmentStatus;
        formattedResponse.priority = data.priority || 1;
        const fromLocation = (addressesObj.shipFromAddress || {}).location || {};
        const toLocation = (addressesObj.shipToAddress || {}).location || {};
        formattedResponse.h1 = toLocation.name || '';
        formattedResponse.h2 = fromLocation.name || '';
        formattedResponse.l1 = data.code;
        formattedResponse.l2 =
          akUtils.objectKeyByValue(shipmentStatusLabelMap, data.shipmentStatus) || '';
        switch (data.shipmentStatus) {
          case shipStatusMap.Scheduled:
          case shipStatusMap.PartialShipped:
          case shipStatusMap.SoftShipped:
          case shipStatusMap.Shipped:
            formattedResponse.l3 = akUtils.convertDateToTimezone({
              dateToConvert: data.etd,
              timeZone: currentUserHandler.getCurrentUser().timezone,
              formatType: 'dt'
            });
            break;
          case shipStatusMap.PartialDelivered:
          case shipStatusMap.SoftDelivered:
          case shipStatusMap.Delivered:
            formattedResponse.l3 = akUtils.convertDateToTimezone({
              dateToConvert: data.deliveryDate,
              timeZone: currentUserHandler.getCurrentUser().timezone,
              formatType: 'dt'
            });
            break;
          default:
            formattedResponse.l3 = akUtils.convertDateToTimezone({
              dateToConvert: data.etd,
              timeZone: currentUserHandler.getCurrentUser().timezone,
              formatType: 'dt'
            });
        }
        formattedResponse.map = `${process.env.shipmentMapPrefix}${data._id}`;
        return locationHelper
          .getById(toLocation.id)
          .then(locationObj => {
            formattedResponse.latitude = locationObj.coordinates.latitude;
            formattedResponse.longitude = locationObj.coordinates.longitude;
            return formattedResponse;
          })
          .catch(() => {
            formattedResponse.latitude = 0;
            formattedResponse.longitude = 0;
            return formattedResponse;
          });
      })
    );
};

shipmentService.prototype.getShipmentByIdForMobile = function(id) {
  // TODO: remove consumer.id condition
  // const uId = (currentUserHandler.getCurrentUser() || {}).uuid;
  let conditions = {
    _id: mongoose.Types.ObjectId(id)
  };
  conditions = clientHandler.addClientFilterToConditions(conditions);
  // conditions.$or = [{ 'carrierUser.id': uId }, { 'carrierUser.uuid': uId }];
  conditions.shipmentStatus = {
    $in: [
      shipStatusMap.Scheduled,
      shipStatusMap.PartialShipped,
      shipStatusMap.SoftShipped,
      shipStatusMap.Shipped,
      shipStatusMap.PartialDelivered,
      shipStatusMap.SoftDelivered,
      shipStatusMap.Delivered
    ]
  };

  return shipmentmodel.findOne(conditions).then(data => {
    const addressesObj = {};
    for (const x of data.addresses) {
      addressesObj[x.addressType] = x;
    }

    let formattedResponse = {};
    formattedResponse.id = data._id;
    formattedResponse.caseNo = '';
    formattedResponse.shipmentNo = data.code;
    formattedResponse.isReported = 0;
    formattedResponse.shipStatus = data.shipmentStatus;
    formattedResponse.priority = data.priority || 1;
    const fromLocation = (addressesObj.shipFromAddress || {}).location || {};
    const toLocation = (addressesObj.shipToAddress || {}).location || {};
    formattedResponse.h1 = fromLocation.name || '';
    formattedResponse.h2 = toLocation.name || '';
    formattedResponse.map = `${process.env.shipmentMapPrefix}${data._id}`;
    formattedResponse = commonHelper.moveSystemAttributesToGlobal(formattedResponse);
    formattedResponse.l1 = '';
    formattedResponse.l2 = 'To Location Address';
    formattedResponse.l3 = 'From Location Address';
    formattedResponse.l4 = data.code;
    formattedResponse.l5 =
      akUtils.objectKeyByValue(shipmentStatusLabelMap, data.shipmentStatus) || '';
    formattedResponse.l6 = '';
    formattedResponse.l7 = '';
    if (data.shipmentStatus === shipStatusMap.Delivered) {
      formattedResponse.l6 = `${(data.deliveryDetails || {}).recipientFirstName ||
        ''} ${(data.deliveryDetails || {}).recipientLastName || ''}`.trim();
      formattedResponse.l7 = (data.deliveryDetails || {}).recipientMobileNumber || '';
      formattedResponse.shipmentImages = ((data.deliveryDetails || {}).images || []).map(image => ({
        full: image.url,
        thumb: image.url
      }));
    }
    formattedResponse.l8 = '';
    formattedResponse.l9 = '';
    formattedResponse.l13 = akUtils.convertDateToTimezone({
      dateToConvert: data.scheduledPickupDate,
      timeZone: currentUserHandler.getCurrentUser().timezone,
      formatType: 'dt'
    });
    formattedResponse.items = [];

    switch (data.shipmentStatus) {
      case shipStatusMap.Scheduled:
      case shipStatusMap.PartialShipped:
      case shipStatusMap.SoftShipped:
      case shipStatusMap.Shipped:
        formattedResponse.l12 = akUtils.convertDateToTimezone({
          dateToConvert: data.etd,
          timeZone: currentUserHandler.getCurrentUser().timezone,
          formatType: 'dt'
        });
        break;
      case shipStatusMap.PartialDelivered:
      case shipStatusMap.SoftDelivered:
      case shipStatusMap.Delivered:
        formattedResponse.l12 = akUtils.convertDateToTimezone({
          dateToConvert: data.deliveryDate,
          timeZone: currentUserHandler.getCurrentUser().timezone,
          formatType: 'dt'
        });
        break;
      default:
        formattedResponse.l12 = akUtils.convertDateToTimezone({
          dateToConvert: data.etd,
          timeZone: currentUserHandler.getCurrentUser().timezone,
          formatType: 'dt'
        });
    }
    return bluebirdPromise
      .map(data.products, prod =>
        productHelper.getById(prod.id).then(pdata =>
          bluebirdPromise
            .map(pdata.things, thing => thingsHelper.getById(thing.id))
            .then(thingData => {
              pdata.things = thingData;
              return pdata;
            })
        )
      )
      .then(prodData => {
        formattedResponse.items = prodData.map(prod => {
          const item = {};
          item.skuId = prod.id;
          item.itemId = prod.id;
          item.l1 = prod.code;
          item.l2 = prod.name;
          item.l3 = '';
          item.l4 = '';
          item.l5 = 0;
          item.isMissing = 0;
          item.things = (prod.things || []).map(t => ({
            type: t.type,
            uuid: t.uuid,
            major: t.major,
            minor: t.minor
          }));
          return item;
        });
      })
      .then(() =>
        bluebirdPromise.all([
          locationHelper.getById(fromLocation.id).then(data =>
            countryHelper.getDialCodeFromShortCode(data.phonecode).then(dialcode => {
              data.dialCode = dialcode;
              return data;
            })
          ),
          locationHelper.getById(toLocation.id).then(data =>
            countryHelper.getDialCodeFromShortCode(data.phonecode).then(dialcode => {
              data.dialCode = dialcode;
              return data;
            })
          )
        ])
      )
      .then(locationData => {
        const toLocationData = [];
        let toLocationPhone = '';
        let fromLocationPhone = '';
        const fromLocationInfo = locationData[0];
        const toLocationInfo = locationData[1];
        if (toLocationInfo.phone) {
          toLocationPhone = `+${toLocationInfo.dialCode}${toLocationInfo.phone}` || '';
        }
        if (fromLocationInfo.phone) {
          fromLocationPhone = `+${fromLocationInfo.dialCode}${fromLocationInfo.phone}` || '';
        }

        toLocationData.push(toLocationInfo.name);
        toLocationData.push(toLocationInfo.address);
        toLocationData.push(toLocationInfo.city);
        toLocationData.push(toLocationInfo.state);
        toLocationData.push(toLocationInfo.country);
        // toLocationData.push(locationData[1].address)
        const fromLocationData = [];
        fromLocationData.push(fromLocationInfo.name);
        fromLocationData.push(fromLocationInfo.address);
        fromLocationData.push(fromLocationInfo.city);
        fromLocationData.push(fromLocationInfo.state);
        fromLocationData.push(fromLocationInfo.country);
        formattedResponse.locations = {
          shipFromLocation: {
            id: fromLocationInfo.id || '',
            code: fromLocationInfo.code || '',
            name: fromLocationInfo.name || '',
            address: fromLocationInfo.address || '',
            city: fromLocationInfo.city || '',
            state: fromLocationInfo.state || '',
            country: fromLocationInfo.country || '',
            phone: fromLocationPhone || '',
            coordinates: {
              latitude: fromLocationInfo.coordinates.latitude,
              longitude: fromLocationInfo.coordinates.longitude
            }
          },
          shipToLocation: {
            id: toLocationInfo.id || '',
            code: toLocationInfo.code || '',
            name: toLocationInfo.name || '',
            address: toLocationInfo.address || '',
            city: toLocationInfo.city || '',
            state: toLocationInfo.state || '',
            country: toLocationInfo.country || '',
            phone: toLocationPhone || '',
            coordinates: {
              latitude: toLocationInfo.coordinates.latitude,
              longitude: toLocationInfo.coordinates.longitude
            }
          }
        };
        formattedResponse.l2 = toLocationData.join(', ');
        formattedResponse.l3 = fromLocationData.join(', ');
        formattedResponse.latitude = locationData[1].coordinates.latitude;
        formattedResponse.longitude = locationData[1].coordinates.longitude;
        formattedResponse.l10 = '';
        if (locationData[1].phone) {
          formattedResponse.l10 = `+${locationData[1].dialCode}${locationData[1].phone}` || '';
        }
        formattedResponse.l11 = '';

        return formattedResponse;
      })
      .then(formattedResponse =>
        this.getOrdersForShipment(formattedResponse.id)
          .then(result => {
            const currentTime = new Date();
            result = result.map(item => {
              item.timeTillSurgery = Number(timediff(currentTime, new Date(item.etd), 's'));
              return item;
            });
            result = result.sort((a, b) => a.timeTillSurgery - b.timeTillSurgery);
            return result[0] || {};
          })
          .then(closestOrder => {
            closestOrder = commonHelper.moveSystemAttributesToGlobal(closestOrder);
            formattedResponse.caseNo = closestOrder.code || '';
            formattedResponse.l1 = closestOrder.surgeon || '';
            formattedResponse.l8 = closestOrder.surgery || '';
            formattedResponse.l9 = akUtils.convertDateToTimezone({
              dateToConvert: closestOrder.etd,
              formatType: 'dt',
              timeZone: currentUserHandler.getCurrentUser().timezone
            });
            return formattedResponse;
          })
      );
  });
};

shipmentService.prototype.setShipmentStatus = function(id, status, opts = {}) {
  if (!akUtils.objectKeyByValue(shipStatusMap, Number(status))) {
    return bluebirdPromise.reject(new Error('Invalid Status for Shipment'));
  }

  return this.getById(id).then(() => {
    switch (status) {
      case shipStatusMap.Shipped:
        return this.setShipmentHardShipped(id);
      case shipStatusMap.Delivered:
        let forceDeliver = false;
        // if (opts.isAdminDelivered) {
        //   forceDeliver = true;
        // }
        forceDeliver = true;
        return this.setShipmentHardDelivered(
          id,
          opts.deliveryDetails,
          forceDeliver,
          opts.isAdminDelivered
        );
    }
  });
};

shipmentService.prototype.getOrdersForShipment = function(shipmentId) {
  let conditions = {
    _id: mongoose.Types.ObjectId(shipmentId)
  };
  // console.log(conditions);
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return shipmentmodel
    .aggregate()
    .match(conditions)
    .project({
      orders: '$products.orderDetails'
    })
    .unwind('$orders')
    .group({
      _id: '$_id',
      orders: {
        $addToSet: '$orders'
      }
    })
    .unwind('$orders')
    .lookup({
      from: 'orders',
      localField: 'orders.id',
      foreignField: '_id',
      as: 'orders'
    })
    .group({
      _id: '$_id',
      orders: {
        $addToSet: '$orders'
      }
    })
    .then(result => {
      const orders = (result[0] || {}).orders || [];
      return orders.reduce((finalArray, item) => [...finalArray, ...item], []);
    });
};

shipmentService.prototype.searchShipmentsAndProductsForMobile = function(event) {
  const orderHelper = require('./order');
  const query = event.queryStringParameters.query || '';
  const shipmentStatusToMatch = akUtils.getShipmentStatus(query);
  const orderIdList = new Set();
  const shipIdList = new Set();
  const orderData = {};
  const shipData = {};
  const productShipOrderMap = {};
  const uId = (currentUserHandler.getCurrentUser() || {}).uuid;
  let shipmentItemConditions = {};
  shipmentItemConditions.$or = [
    {
      'carrierUser.id': uId
    },
    {
      'carrierUser.uuid': uId
    }
  ];
  shipmentItemConditions = clientHandler.addClientFilterToConditions(shipmentItemConditions);
  return shipmentmodel
    .find(shipmentItemConditions)
    .then(productsInShipList => {
      for (const prodShipData of productsInShipList) {
        for (const prodData of prodShipData.products) {
          const prodId = `${prodData.id}`;
          productShipOrderMap[prodId] = {};
        }
      }

      for (const prodShipData of productsInShipList) {
        const shipmentId = `${prodShipData._id}`;
        for (const prodData of prodShipData.products) {
          const prodId = `${prodData.id}`;
          const orderId = `${prodData.orderDetails.id}`;
          orderIdList.add(orderId);
          shipIdList.add(shipmentId);
          if (!productShipOrderMap[prodId][shipmentId]) {
            productShipOrderMap[prodId][shipmentId] = {};
          }
          if (!productShipOrderMap[prodId][shipmentId].orders) {
            productShipOrderMap[prodId][shipmentId].orders = [];
          }
          productShipOrderMap[prodId][shipmentId].orders.push(orderId);
        }
      }

      return bluebirdPromise.all([
        bluebirdPromise
          .map(orderIdList, x =>
            orderHelper.getById(x).then(y => {
              orderData[x] = y;
            })
          )
          .then(z => orderData),
        bluebirdPromise
          .map(shipIdList, x =>
            this.getById(x).then(y => {
              shipData[x] = y;
            })
          )
          .then(z => shipData)
      ]);
    })
    .then(populatedProductShipOrderMap => {
      const productsInShipList = Object.getOwnPropertyNames(productShipOrderMap).map(x =>
        mongoose.Types.ObjectId(x)
      );

      let shipmentSearchConditions = {
        'carrierUser.uuid': uId,

        $or: [
          {
            code: new RegExp(query, 'i')
          },
          {
            name: new RegExp(query, 'i')
          },
          {
            'carrierUser.firstName': new RegExp(query, 'i')
          },
          {
            'carrierUser.lastName': new RegExp(query, 'i')
          },
          {
            'carrierUser.email': new RegExp(query, 'i')
          },
          {
            'addresses.location.code': new RegExp(query, 'i')
          },
          {
            'addresses.location.name': new RegExp(query, 'i')
          },
          {
            'products.orderDetails.code': new RegExp(query, 'i')
          },
          {
            'products.code': new RegExp(query, 'i')
          },
          {
            'products.name': new RegExp(query, 'i')
          },
          {
            'deliveryDetails.recipientFirstName': new RegExp(query, 'i')
          },
          {
            'deliveryDetails.recipientLastName': new RegExp(query, 'i')
          },
          {
            'deliveryDetails.recipientMobileNumber': new RegExp(query, 'i')
          }
        ]
      };
      shipmentSearchConditions.shipmentStatus = {
        $in: [
          shipStatusMap.Scheduled,
          shipStatusMap.PartialShipped,
          shipStatusMap.SoftShipped,
          shipStatusMap.Shipped,
          shipStatusMap.PartialDelivered,
          shipStatusMap.SoftDelivered,
          shipStatusMap.Delivered
        ]
      };
      shipmentSearchConditions = clientHandler.addClientFilterToConditions(
        shipmentSearchConditions
      );

      akUtils.log(shipmentStatusToMatch);
      akUtils.log(`+++${query}+++`);
      akUtils.log(shipmentStatusToMatch);
      if (shipmentStatusToMatch) {
        shipmentSearchConditions.$or.push({
          shipmentStatus: shipmentStatusToMatch
        });
      }
      let productSearchConditions = {
        $or: [
          {
            code: new RegExp(query, 'i')
          },
          {
            name: new RegExp(query, 'i')
          },
          {
            'things.name': new RegExp(query, 'i')
          }
        ],
        _id: {
          $in: productsInShipList
        }
      };
      productSearchConditions = clientHandler.addClientFilterToConditions(productSearchConditions);
      return bluebirdPromise
        .all([
          shipmentmodel.find(shipmentSearchConditions),
          productModel
            .aggregate()
            .match(productSearchConditions)
            .lookup({
              from: 'producttrackings',
              localField: '_id',
              foreignField: 'product.id',
              as: 'currentLocation'
            })
        ])
        .then(result => {
          result = result.map(item => item || []);
          const shipmentResult = result[0];
          let productResult = result[1];
          return bluebirdPromise
            .map(shipmentResult, item =>
              this.getOrderWithClosestSurgeryDate(item.id)
                .then(closestOrder => {
                  item.order = closestOrder;
                  return item;
                })
                .then(shipData => {
                  const addressesObj = {};
                  for (const x of shipData.addresses) {
                    addressesObj[x.addressType] = x;
                  }
                  const fromLocation = (addressesObj.shipFromAddress || {}).location || {};
                  const toLocation = (addressesObj.shipToAddress || {}).location || {};
                  return bluebirdPromise
                    .all([
                      locationHelper.getById(fromLocation.id),
                      locationHelper.getById(toLocation.id)
                    ])
                    .then(locationData => {
                      shipData.toLocation = locationData[1];
                      shipData.fromLocation = locationData[0];
                      return shipData;
                    });
                })
                .then(data => {
                  const fResponse = {};
                  fResponse.isReported = data.issue ? 1 : 0;
                  fResponse.h1 = data.toLocation.name;
                  fResponse.h2 = data.fromLocation.name;
                  fResponse.l1 = data.code;
                  fResponse.l2 = akUtils.objectKeyByValue(
                    shipmentStatusLabelMap,
                    data.shipmentStatus
                  );
                  let dateToUse;
                  switch (data.shipmentStatus) {
                    case shipStatusMap.Scheduled:
                    case shipStatusMap.PartialShipped:
                    case shipStatusMap.SoftShipped:
                    case shipStatusMap.Shipped:
                      dateToUse = data.etd;
                      break;
                    case shipStatusMap.PartialDelivered:
                    case shipStatusMap.SoftDelivered:
                    case shipStatusMap.Delivered:
                      dateToUse = data.deliveryDate;
                      break;
                    default:
                      dateToUse = data.etd;
                  }
                  fResponse.l3 = akUtils.convertDateToTimezone({
                    dateToConvert: dateToUse,
                    timeZone: currentUserHandler.getCurrentUser().timezone,
                    formatType: 'dt'
                  });
                  fResponse.shipStatus = data.shipmentStatus;
                  fResponse.priority = 1;
                  fResponse.type = 0;
                  fResponse.map = `${process.env.shipmentMapPrefix}${data._id}`;
                  fResponse.params = {
                    caseNo: data.order.code,
                    shipmentNo: data._id
                  };
                  return fResponse;
                })
            )
            .then(shipmentFormattedData => {
              let itemFormattedData = [];
              productResult = productResult.map(x => {
                x.shipments = Object.getOwnPropertyNames(productShipOrderMap[`${x._id}`]).map(
                  y => shipData[y]
                );
                return x;
              });

              productResult = JSON.parse(JSON.stringify(productResult));

              let productResultUnwinded = productResult
                .map(p => unwind(p, 'shipments'))
                .reduce((result, x) => [...result, ...x], []);

              productResult = productResultUnwinded.map(x => {
                x.orders = productShipOrderMap[`${x._id}`][x.shipments.id].orders.map(
                  y => orderData[y]
                );
                return x;
              });

              productResultUnwinded = productResult
                .map(p => unwind(p, 'orders'))
                .reduce((result, x) => [...result, ...x], []);
              itemFormattedData = productResultUnwinded.map(res => {
                const formattedResponse = {};
                formattedResponse.isCaseAssociated = 1;
                formattedResponse.type = 1;
                formattedResponse.h1 = res.code;
                formattedResponse.h2 = res.name;
                formattedResponse.h3 = res.code;
                formattedResponse.l1 = `${`${(res.orders || {
                  consumer: {
                    firstName: ''
                  }
                }).consumer.firstName} ${(res.orders || {
                  consumer: {
                    lastName: ''
                  }
                }).consumer.lastName}`.trim()}(${res.orders.code}/${res.shipments.code})`;
                formattedResponse.l2 =
                  (res.orders || {
                    consumer: {}
                  }).consumer.mobileNo || '';
                const currentLocationData = (res.currentLocation[0] || {}).currentLocation;

                formattedResponse.l3 = commonHelper.getCurrentLocationString(currentLocationData);
                formattedResponse.params = {
                  caseNo: '',
                  shipmentNo: `${res.shipments.id}`,
                  skuId: `${res._id}`
                };
                return formattedResponse;
              });

              return [...itemFormattedData, ...shipmentFormattedData];
            });
        });
    });
};

shipmentService.prototype.getOrderWithClosestSurgeryDate = function(shipmentId) {
  return this.getOrdersForShipment(shipmentId).then(result => {
    const currentTime = new Date();
    result = result.map(item => {
      item.timeTillSurgery = Number(timediff(currentTime, new Date(item.etd), 's'));
      return item;
    });
    result = result.sort((a, b) => a.timeTillSurgery - b.timeTillSurgery);
    return result[0] || {};
  });
};

shipmentService.prototype.getOrdersOfProducts = function(productData, unwind = true) {
  return bluebirdPromise
    .map(productData, prod => {
      let conditions = {};
      conditions['products.id'] = prod._id;
      conditions = clientHandler.addClientFilterToConditions(conditions);
      return ordermodel
        .find(conditions)
        .exec()
        .then(result => {
          prod.orders = result || [];
          return prod;
        });
    })
    .then(result => {
      if (!unwind) {
        return result;
      }
      const unwindedData = [];
      for (let i = 0; i < result.length; i++) {
        const orders = result[i].orders;
        const orderCount = orders.length;
        for (let j = 0; j < orderCount; j++) {
          let newData = {};
          // newData = data;
          newData.order = orders[j];
          newData = Object.assign({}, newData, result[i]._doc || result[i]);
          unwindedData.push(newData);
        }
      }
      return unwindedData;
    });
};

shipmentService.prototype.cancelShipment = function(shipmentId) {
  const itemStatusMap = require('../mappings/itemStatus.json');
  const shipmentStatusMap = require('../mappings/shipmentStatus.json');

  const self = this;
  if (!mongoose.Types.ObjectId.isValid(shipmentId)) {
    return bluebirdPromise.reject(['Invalid Shipment']);
  }
  // let conditions = { '_id': mongoose.Types.ObjectId(shipmentId) };

  let condition = {
    _id: shipmentId
  };
  condition = clientHandler.addClientFilterToConditions(condition);
  return shipmentmodel
    .findOne(condition)
    .then(shipmentObj => {
      const shipmentUpdateObj = {};
      shipmentUpdateObj.products = shipmentObj.products.map(row => {
        row.deliveryStatus = itemStatusMap.Canceled;
        return row;
      });

      shipmentUpdateObj.shipmentStatus = shipmentStatusMap.Canceled;

      shipmentUpdateObj.canceledDate = new Date();

      shipmentUpdateObj.updatedOn = Date.now();
      shipmentUpdateObj.updatedBy = currentUserHandler.getCurrentUser();
      shipmentUpdateObj.client = clientHandler.getClient();

      // return shipmentObj.save();

      const updateParams = {
        $set: shipmentUpdateObj,
        $inc: {
          __v: 1
        }
      };
      return shipmentmodel
        .findOneAndUpdate(
          {
            _id: shipmentId
          },
          updateParams,
          {
            upsert: false,
            new: true
          }
        )
        .exec();
    })
    .then(shipmentObj => {
      // save shipment products orchestration here
      const promises = shipmentObj.products.map(pRow =>
        self.setItemOrchestration(pRow.id, pRow.deliveryStatus, 'shipment', shipmentId)
      );
      return bluebirdPromise.all(promises);
    })
    .then(() =>
      shipmentOrchestrationHelper.update({
        shipmentId,
        shipmentStatus: shipmentStatusMap.Canceled,
        actionTime: new Date()
      })
    )
    .then(() =>
      // TODO Impacts on Order
      bluebirdPromise.resolve()
    );
};

shipmentService.prototype.validateCancelShipment = function(shipmentId) {
  const errors = [];
  return this.getById(shipmentId)
    .then(shipmentObj => {
      // if found
      if (shipmentObj.shipmentStatus === shipmentStatusArr.Canceled) {
        errors.push({
          code: 2541,
          message: 'Shipment is already cancelled.'
        });
      }

      if (errors.length === 0) {
        return bluebirdPromise.resolve();
      }
      return bluebirdPromise.reject(errors);
    })
    .catch(() => {
      // case when shipment not found
      if (errors.length === 0) {
        return bluebirdPromise.reject({
          code: 2542,
          message: 'Invalid shipment.'
        });
      }
      return bluebirdPromise.reject(errors);
    });
};

shipmentService.prototype.setShipmentHardShipped = function(shipmentId) {
  const self = this;
  const itemStatusMapping = require('../mappings/itemStatus.json');
  let shipmentObject = {};
  return shipmentmodel
    .findOne({
      _id: shipmentId
    })
    .then(shipmentObj => {
      if (shipmentObj === null) {
        return null;
      }
      shipmentObject = shipmentObj;
      shipmentObj.products = shipmentObj.products.map(row => {
        row.deliveryStatus = itemStatusMapping.Shipped;
        return row;
      });

      return shipmentObj.save();
    })
    .then(shipmentObj => {
      const promises = shipmentObj.products.map(pRow =>
        self.setItemOrchestration(pRow.id, pRow.deliveryStatus, 'shipment', shipmentId)
      );
      return bluebirdPromise.all(promises);
    })
    .then(() => self.setShipmentShipped(shipmentId))
    .then(() => {
      const promises = shipmentObject.products.map(pRow =>
        self.setOrderShipTracking(pRow.orderDetails.id, pRow.id)
      );
      return bluebirdPromise.all(promises);
    })
    .catch(err => bluebirdPromise.reject(err));
};

shipmentService.prototype.setItemOrchestration = function(
  productId,
  itemStatus,
  parentType,
  parentId,
  actionTime
) {
  if (itemStatus !== null) {
    if (typeof actionTime === 'undefined') {
      actionTime = new Date();
    }
    return itemOrchestrationHelper.save({
      itemId: productId,
      itemStatus,
      parentType,
      parentId,
      actionTime
    });
  }
  return false;
};

shipmentService.prototype.setOrderShipTracking = function(orderId, productId) {
  const orderHelper1 = require('./order');
  const self = this;
  if (orderId !== null) {
    const itemStatusMapping = require('../mappings/itemStatus.json');
    const orderStatusMapping = require('../mappings/orderStatus.json');
    return ordermodel
      .findOne({
        _id: orderId
      })
      .then(orderObj => {
        if (
          orderObj.orderStatus === orderStatusMapping.Open ||
          orderObj.orderStatus === orderStatusMapping.PartialShipped
        ) {
          orderObj.products = orderObj.products.map(row => {
            if (row.id.toString() === productId.toString()) {
              row.deliveryStatus = itemStatusMapping.Shipped;
              return row;
            }
            return row;
          });

          return orderObj.save();
        }
        return orderObj;
      })
      .then(orderObj => orderHelper1.setOrderShipped(orderObj._id))
      .then(() =>
        // order item orchestration
        self.setItemOrchestration(productId, itemStatusMapping.Shipped, 'order', orderId)
      );
  }
  return false;
};

shipmentService.prototype.setShipmentItemsDelivered = function(shipmentObj) {
  const itemStatusMapping = require('../mappings/itemStatus.json');
  shipmentObj.products = shipmentObj.products.map(row => {
    row.deliveryStatus = itemStatusMapping.Delivered;
    return row;
  });

  return shipmentObj.save();
};

shipmentService.prototype.setShipmentHardDelivered = function(
  shipmentId,
  deliveryDetails,
  forceItemDeliver,
  isAdminDelivered = 0
) {
  const self = this;
  // const itemStatusMapping = require('../mappings/itemStatus.json');
  // let shipmentObject = {};
  return shipmentmodel
    .findOne({
      _id: shipmentId
    })
    .then(shipmentObj => {
      if (shipmentObj === null) {
        return null;
      }

      if (forceItemDeliver === true) {
        return self
          .setShipmentItemsDelivered(shipmentObj)
          .then(() => {
            if (shipmentObj.shipmentStatus !== shipmentStatusArr.Delivered) {
              const promises = shipmentObj.products.map(pRow =>
                self.setItemOrchestration(pRow.id, pRow.deliveryStatus, 'shipment', shipmentId)
              );
              return bluebirdPromise.all(promises);
            }
            return bluebirdPromise.resolve();
          })
          .then(() =>
            self.setShipmentDelivered(shipmentId, '', deliveryDetails, true, isAdminDelivered)
          )
          .then(() => {
            const promises = shipmentObj.products.map(pRow =>
              self.setOrderDeliverTracking(pRow.orderDetails.id, pRow.id)
            );
            return bluebirdPromise.all(promises);
          });
      }
      return self.setShipmentDelivered(shipmentId, '', deliveryDetails, true, isAdminDelivered);
    })
    .catch(() => bluebirdPromise.reject());
};

shipmentService.prototype.setOrderDeliverTracking = function(orderId, productId) {
  const orderHelper1 = require('./order');
  const self = this;
  if (orderId !== null) {
    let orderDelivered = false;
    const itemStatusMapping = require('../mappings/itemStatus.json');
    const orderStatusMapping = require('../mappings/orderStatus.json');
    return ordermodel
      .findOne({
        _id: orderId
      })
      .then(orderObj => {
        if (
          orderObj.orderStatus === orderStatusMapping.Open ||
          orderObj.orderStatus === orderStatusMapping.Shipped ||
          orderObj.orderStatus === orderStatusMapping.PartialShipped ||
          orderObj.orderStatus === orderStatusMapping.PartialDelivered
        ) {
          orderObj.products = orderObj.products.map(row => {
            if (row.id.toString() === productId.toString()) {
              row.deliveryStatus = itemStatusMapping.Delivered;
              return row;
            }
            return row;
          });

          return orderObj.save();
        }
        return orderObj;
      })
      .then(orderObj => {
        if (
          orderObj.orderStatus !== orderStatusMapping.PartialDelivered &&
          orderObj.orderStatus !== orderStatusMapping.Delivered
        ) {
          orderDelivered = true;
          return orderHelper1.setOrderDelivered(orderObj._id);
        }
        return bluebirdPromise.resolve(orderObj);
      })
      .then(() => {
        if (orderDelivered) {
          // order item orchestration
          return self.setItemOrchestration(
            productId,
            itemStatusMapping.Delivered,
            'order',
            orderId
          );
        }
        return bluebirdPromise.resolve();
      });
  }
  return false;
};

shipmentService.prototype.addShipmentOrchestrations = function(shipmentObj, internal = false) {
  const statuses = Object.keys(shipStatusMap).map(key => shipStatusMap[key]);
  let done, actionTime;
  const promises = statuses.map(status => {
    if (status === shipStatusMap.Open) {
      done = 1;
      actionTime = new Date();
    } else if (internal && status === shipStatusMap.Delivered) {
      done = 1;
      actionTime = new Date();
    } else {
      done = 0;
      actionTime = null;
    }
    return shipmentOrchestrationHelper.save({
      shipmentId: shipmentObj._id,
      shipmentStatus: status,
      done,
      actionTime
    });
  });

  return bluebirdPromise.all(promises);
};

shipmentService.prototype.assignCarrier = function({ shipment, carrier }) {
  if (Array.isArray(shipment)) {
    shipment = shipment
      .filter(id => mongoose.Types.ObjectId.isValid(id))
      .map(mongoose.Types.ObjectId);
  } else if (typeof shipment === typeof '' && mongoose.Types.ObjectId.isValid(shipment)) {
    shipment = [mongoose.Types.ObjectId(shipment)];
  } else {
    return bluebirdPromise.reject();
  }

  return bluebirdPromise.map(shipment, id => {
    let oldCarrier;
    let newCarrier;
    let shipData;
    return this.getById(id)
      .then(shipObj => {
        shipData = JSON.parse(JSON.stringify(shipObj));

        oldCarrier = JSON.parse(JSON.stringify(shipObj.carrierUser || {}));
        newCarrier = JSON.parse(JSON.stringify(carrier || {}));
        const updateObj = {};
        updateObj.carrierUser = carrier;
        updateObj.updatedBy = currentUserHandler.getCurrentUser();
        updateObj.updatedOn = new Date();
        return shipmentmodel
          .findOneAndUpdate(
            {
              _id: id
            },
            {
              $set: updateObj
            },
            {
              new: true
            }
          )
          .exec();
      })
      .then(() =>
        // if (
        //   shipData.shipmentStatus !== shipStatusMap.Open &&
        //   shipData.shipmentStatus !== shipStatusMap.Canceled
        // ) {
        //   if (
        //     (shipData.carrierUser || {}).uuid &&
        //     (shipData.carrierUser || {}).uuid !== (newCarrier || {}).uuid
        //   ) {
        //     const params = {
        //       shipmentId: event.pathParameters.id,
        //       shipmentCode: shipData.code,
        //       carrier: newCarrier,
        //       source: 'assignCarrier'
        //     };

        //     const recieverData = {
        //       sendType: 'user',
        //       appType: 'carrier',
        //       namedUserId: newCarrier.email
        //     };

        //     return notificationLib.saveNotification(
        //       'CarrierAssignment',
        //       params,
        //       recieverData,
        //       newCarrier
        //     );
        //   }
        //   return bluebirdPromise.resolve();
        // }
        bluebirdPromise.resolve()
      );
  });
};

shipmentService.prototype.assignPickupDate = function({ shipment, pickupDate }) {
  if (Array.isArray(shipment)) {
    shipment = shipment
      .filter(id => mongoose.Types.ObjectId.isValid(id))
      .map(mongoose.Types.ObjectId);
  } else if (typeof shipment === typeof '' && mongoose.Types.ObjectId.isValid(shipment)) {
    shipment = [mongoose.Types.ObjectId(shipment)];
  } else {
    return bluebirdPromise.reject();
  }

  const updateObj = {};
  updateObj.scheduledPickupDate = pickupDate;
  updateObj.updatedBy = currentUserHandler.getCurrentUser();
  updateObj.updatedOn = new Date();

  const failedShipments = [];
  return bluebirdPromise
    .each(shipment, ship =>
      this.getById(ship).then(result =>
        validator.validateTimeDiff(pickupDate, result.etd).then(res => {
          if (!res.status) {
            failedShipments.push({ code: result.code, etd: result.etd });
            return bluebirdPromise.resolve();
          }
          return shipmentmodel
            .findOneAndUpdate(
              {
                _id: result.id
              },
              updateObj
            )
            .exec();
        })
      )
    )
    .then(() => {
      if (failedShipments.length) {
        const pDate = akUtils.convertDateToTimezone({
          dateToConvert: pickupDate,
          timeZone: (currentUserHandler.getCurrentUser() || {}).timezone,
          formatType: 'dt'
        });
        const err = failedShipments.map(ship => {
          const shipEtd = akUtils.convertDateToTimezone({
            dateToConvert: ship.etd,
            timeZone: (currentUserHandler.getCurrentUser() || {}).timezone,
            formatType: 'dt'
          });
          return `Scheduled Pickup Date: ${pDate} must be less than Scheduled Delivery Date: ${shipEtd} for shipment# ${ship.code}`;
        });
        return bluebirdPromise.reject(err);
      }
      return bluebirdPromise.resolve();
    });
};

shipmentService.prototype.bulkOperation = function({ event }) {
  event.body.shipmentIds = event.body.shipmentIds
    .filter(id => mongoose.Types.ObjectId.isValid(id))
    .map(mongoose.Types.ObjectId);

  switch (event.body.actionType) {
    case 'schedule':
      return this.schedule(event.body.shipmentIds);
    case 'assign carrier':
      return this.assignCarrier({
        shipment: event.body.shipmentIds,
        carrier: event.body.carrier
      });
    case 'assign pickupdate':
      return this.assignPickupDate({
        shipment: event.body.shipmentIds,
        pickupDate: event.body.pickupDate
      });
    case 'cancel':
      return this.cancelShipments(event.body.shipmentIds);
    default:
      return bluebirdPromise.reject();
  }
};

shipmentService.prototype.cancelShipments = function(shipmentList) {
  let failedShipments = [];
  const self = this;
  return shipmentmodel
    .find({
      _id: {
        $in: shipmentList
      }
    })
    .exec()
    .then(shipments => {
      failedShipments = shipments
        .filter(shipment => {
          if (shipment.shipmentStatus === shipmentStatusArr.Canceled) {
            return shipment;
          }
        })
        .map(shipmentObj => shipmentObj.code);

      shipments = shipments.filter(shipment => {
        if (shipment.shipmentStatus !== shipmentStatusArr.Canceled) {
          return shipment;
        }
      });

      return bluebirdPromise.each(shipments, shipment => self.cancelShipment(shipment.id));
    })
    .then(() => {
      akUtils.log(failedShipments);
      if (failedShipments.length) {
        akUtils.log(failedShipments);
        const err = `Unable to cancel these shipments: ${failedShipments.join(',')}`;
        return bluebirdPromise.reject(err);
      }
      return bluebirdPromise.resolve();
    });
};

shipmentService.prototype.cancelOrderShipment = function(shipmentId, orderId) {
  const itemStatusMap = require('../mappings/itemStatus.json');
  const shipmentStatusMap = require('../mappings/shipmentStatus.json');

  const self = this;

  if (!mongoose.Types.ObjectId.isValid(shipmentId)) {
    return bluebirdPromise.reject(['Invalid Shipment']);
  }

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return bluebirdPromise.reject(['Invalid Order']);
  }

  shipmentId = mongoose.Types.ObjectId(shipmentId);
  orderId = mongoose.Types.ObjectId(orderId);

  let condition = {
    _id: shipmentId
  };

  condition = clientHandler.addClientFilterToConditions(condition);
  let vShipmentObj = null;
  let cancelShipment = false;
  return shipmentmodel
    .findOne(condition)
    .then(shipmentObj => {
      // let totalShipmentProducts = shipmentObj.products.length;

      const orderProducts = shipmentObj.products.filter(row => {
        if (row.orderDetails.id.equals(orderId)) {
          return row;
        }
      });

      const shipmentUpdateObj = {};

      if (orderProducts.length === shipmentObj.products.length) {
        cancelShipment = true;
        shipmentUpdateObj.shipmentStatus = shipmentStatusMap.Canceled;
        shipmentUpdateObj.canceledDate = new Date();
      }

      // update order product status cancel
      shipmentUpdateObj.products = shipmentObj.products.map(row => {
        if (row.orderDetails.id.equals(orderId)) {
          row.deliveryStatus = itemStatusMap.Canceled;
        }
        return row;
      });

      shipmentUpdateObj.updatedOn = Date.now();
      shipmentUpdateObj.updatedBy = currentUserHandler.getCurrentUser();
      shipmentUpdateObj.client = clientHandler.getClient();

      const updateParams = {
        $set: shipmentUpdateObj,
        $inc: {
          __v: 1
        }
      };
      return shipmentmodel
        .findOneAndUpdate(
          {
            _id: shipmentId
          },
          updateParams,
          {
            upsert: false,
            new: true
          }
        )
        .exec();
    })
    .then(shipmentObj => {
      // shipment product orchestration
      vShipmentObj = shipmentObj;
      const promises = vShipmentObj.products.map(row => {
        if (row.deliveryStatus === itemStatusMap.Canceled) {
          return self.setItemOrchestration(row.id, row.deliveryStatus, 'shipment', shipmentId);
        }
      });
      return bluebirdPromise.all(promises);
    })
    .then(() => {
      // shipment orchestration
      if (cancelShipment) {
        return shipmentOrchestrationHelper.update({
          shipmentId: vShipmentObj._id,
          shipmentStatus: shipmentStatusMap.Canceled,
          actionTime: new Date()
        });
      }
      return bluebirdPromise.resolve();
    })
    .then(() =>
      // TODO Impacts on Order
      bluebirdPromise.resolve()
    );
};

shipmentService.prototype.closeOrderShipment = function(shipmentId, orderId) {
  const self = this;

  if (!mongoose.Types.ObjectId.isValid(shipmentId)) {
    return bluebirdPromise.reject(['Invalid Shipment']);
  }

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return bluebirdPromise.reject(['Invalid Order']);
  }

  shipmentId = mongoose.Types.ObjectId(shipmentId);
  orderId = mongoose.Types.ObjectId(orderId);

  let condition = {
    _id: shipmentId
  };

  condition = clientHandler.addClientFilterToConditions(condition);
  let vShipmentObj = null;
  let closeShipment = false;
  return shipmentmodel
    .findOne(condition)
    .then(shipmentObj => {
      const orderProducts = shipmentObj.products.filter(row => {
        if (row.orderDetails.id.equals(orderId)) {
          return row;
        }
      });

      const shipmentUpdateObj = {};

      if (orderProducts.length === shipmentObj.products.length) {
        closeShipment = true;
        shipmentUpdateObj.shipmentStatus = shipStatusMap.Closed;
      }

      // update order product status close
      shipmentUpdateObj.products = shipmentObj.products.map(row => {
        if (row.orderDetails.id.equals(orderId)) {
          row.deliveryStatus = itemStatusArr.Closed;
        }
        return row;
      });

      shipmentUpdateObj.updatedOn = Date.now();
      shipmentUpdateObj.updatedBy = currentUserHandler.getCurrentUser();
      shipmentUpdateObj.client = clientHandler.getClient();

      const updateParams = {
        $set: shipmentUpdateObj,
        $inc: {
          __v: 1
        }
      };
      return shipmentmodel
        .findOneAndUpdate(
          {
            _id: shipmentId
          },
          updateParams,
          {
            upsert: false,
            new: true
          }
        )
        .exec();
    })
    .then(shipmentObj => {
      // shipment product orchestration
      vShipmentObj = shipmentObj;
      const promises = vShipmentObj.products.map(row => {
        if (row.deliveryStatus === itemStatusArr.Closed) {
          return self.setItemOrchestration(row.id, row.deliveryStatus, 'shipment', shipmentId);
        }
      });
      return bluebirdPromise.all(promises);
    })
    .then(() => {
      // shipment orchestration
      if (closeShipment) {
        return shipmentOrchestrationHelper.update({
          shipmentId: vShipmentObj._id,
          shipmentStatus: shipStatusMap.Closed,
          actionTime: new Date()
        });
      }
      return bluebirdPromise.resolve();
    })
    .then(() =>
      // TODO Impacts on Order
      bluebirdPromise.resolve()
    );
};

shipmentService.prototype.getDelayedShipments = function() {
  const secondsForDelay = 1 * 60 * 60; // 1 hour

  return shipmentmodel
    .find(
      clientHandler.addClientFilterToConditions({
        shipmentStatus: {
          $nin: [
            shipStatusMap.SoftDelivered,
            shipStatusMap.Delivered,
            shipStatusMap.Canceled,
            shipStatusMap.Closed
          ]
        },
        etd: {
          $lte: akUtils.subtractSecondsFromDate(new Date(), secondsForDelay)
        }
      })
    )
    .exec()
    .then(result => result.map(x => this.formatResponse(x)));
};

shipmentService.prototype.closeShipment = function(shipmentId) {
  const self = this;

  if (!mongoose.Types.ObjectId.isValid(shipmentId)) {
    return bluebirdPromise.reject(['Invalid Shipment']);
  }

  shipmentId = mongoose.Types.ObjectId(shipmentId);
  // orderId = mongoose.Types.ObjectId(orderId);

  let condition = {
    _id: shipmentId
  };

  condition = clientHandler.addClientFilterToConditions(condition);
  let vShipmentObj = null;
  let closeShipment = false;
  return shipmentmodel
    .findOne(condition)
    .then(shipmentObj => {
      // const orderProducts = shipmentObj.products.filter(row => {
      //   if (row.orderDetails.id.equals(orderId)) {
      //     return row;
      //   }
      // });

      const shipmentUpdateObj = {};

      // if (orderProducts.length === shipmentObj.products.length) {
      closeShipment = true;
      shipmentUpdateObj.shipmentStatus = shipStatusMap.Closed;
      // }

      // update order product status close
      shipmentUpdateObj.products = shipmentObj.products.map(row => {
        row.deliveryStatus = itemStatusArr.Closed;
        return row;
      });

      shipmentUpdateObj.updatedOn = Date.now();
      shipmentUpdateObj.updatedBy = currentUserHandler.getCurrentUser();
      shipmentUpdateObj.client = clientHandler.getClient();

      const updateParams = {
        $set: shipmentUpdateObj,
        $inc: {
          __v: 1
        }
      };
      return shipmentmodel
        .findOneAndUpdate(
          {
            _id: shipmentId
          },
          updateParams,
          {
            upsert: false,
            new: true
          }
        )
        .exec();
    })
    .then(shipmentObj => {
      // shipment product orchestration
      vShipmentObj = shipmentObj;
      const promises = vShipmentObj.products.map(row => {
        if (row.deliveryStatus === itemStatusArr.Closed) {
          return self.setItemOrchestration(row.id, row.deliveryStatus, 'shipment', shipmentId);
        }
      });
      return bluebirdPromise.all(promises);
    })
    .then(() => {
      // shipment orchestration
      if (closeShipment) {
        return shipmentOrchestrationHelper.update({
          shipmentId: vShipmentObj._id,
          shipmentStatus: shipStatusMap.Closed,
          actionTime: new Date()
        });
      }
      return bluebirdPromise.resolve();
    })
    .then(() =>
      // TODO Impacts on Order
      bluebirdPromise.resolve()
    );
};
module.exports = new shipmentService();
