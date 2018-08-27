/* jshint esversion: 6 */

const favouriteOrderModel = require('../models/favouritedOrders');
const ordermodel = require('../models/order');
const productModel = require('../models/product');
// var config = require('../../../config.'+process.env.NODE_ENV);
const mongoose = require('mongoose');
const shipmentTrackingModel = require('../models/shipmentTracking');
const countryHelper = require('./country');
const bluebirdPromise = require('bluebird');
const commonHelper = require('./common');
// var orderOrchestration = require('../models/orderOrchestration');
const jsTypeChecker = require('javascript-type-checker');
const validator = require('../lib/validatorAsync');
const notificationLib = require('../lib/notification');
const akUtils = require('../lib/utility');
const tagHelper = require('../helpers/tags');
const attributeHelper = require('../helpers/attribute');
const orderStatusMap = require('../mappings/orderStatus.json');
const orderStatusLabelMap = require('../mappings/orderStatusLabel.json');
const shipmentStatusLabelMap = require('../mappings/shipmentStatusLabel.json');
const orderOrchestrationHelper = require('../helpers/orderOrchestration');
const locationHelper = require('./core/location');
const shipmentModel = require('../models/shipment');
const itemOrchestrationHelper = require('../helpers/itemOrchestration');
const shipmentHelper = require('./shipment');
const itemStatusArr = require('../mappings/itemStatus.json');
const orderStatusArr = require('../mappings/orderStatus.json');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');
const productTrackingModel = require('../models/productTracking');

const typemap = {
  isWatched: 'number',
  isException: 'number'
};
const addressType = ['toAddress'];
const orderService = function() {};

orderService.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};

orderService.prototype.getOrdersForMobile = function(searchParams, otherParams, history = false) {
  searchParams = clientHandler.addClientFilterToConditions(searchParams);
  const uId = (currentUserHandler.getCurrentUser() || {}).uuid;

  // TODO: remove consumer.id condition
  searchParams.$or = [{ 'consumer.id': uId }, { 'consumer.uuid': uId }];
  if (history) {
    searchParams.etd = { $lt: new Date() };
  } else {
    searchParams.etd = { $gte: new Date() };
  }
  searchParams.orderStatus = {
    $nin: [orderStatusMap.Draft, orderStatusMap.Canceled]
  };
  akUtils.log(otherParams);
  return (
    ordermodel
      .find(searchParams)
      .sort(otherParams.sort)
      .skip(otherParams.pageParams.offset)
      // .limit(otherParams.pageParams.limit)
      .collation({
        locale: 'en_US',
        caseLevel: false
      })
      .exec()
      .then(result =>
        this.getUserFavourites(currentUserHandler.getCurrentUser().uuid).then(favouriteList => {
          const list = [];
          if (result) {
            for (const i in result) {
              if (result.hasOwnProperty(i)) {
                const data = result[i];
                let formattedResponse = {};
                formattedResponse.id = data._id;
                formattedResponse.caseId = data.code;
                formattedResponse.attributes = data.attributes;

                formattedResponse.surgeryDate = data.etd;

                formattedResponse.color = '#A86C0B';
                formattedResponse.caseStatus = data.orderStatus;
                formattedResponse = Object.assign(
                  {},
                  formattedResponse,
                  data.addresses.reduce((result, address) => {
                    result[address.addressType] = address.location.name;
                    return result;
                  }, {})
                );

                if (
                  typeof formattedResponse.attributes !== 'undefined' &&
                  formattedResponse.attributes !== null
                ) {
                  formattedResponse = commonHelper.moveSystemAttributesToGlobal(
                    formattedResponse,
                    typemap
                  );
                }
                // akUtils.log(data)
                formattedResponse.h1 = formattedResponse.surgeon || '';
                // TODO: remove orderData.createdOn
                formattedResponse.h2 = akUtils.convertDateToTimezone({
                  dateToConvert: data.orderStatusUpdatedOn,
                  timeZone: (currentUserHandler.getCurrentUser() || {}).timezone,
                  formatType: 'dt'
                });

                formattedResponse.l1 = formattedResponse.surgery || '';
                formattedResponse.l2 = formattedResponse.toAddress || '';
                formattedResponse.l4 = akUtils.objectKeyByValue(
                  orderStatusLabelMap,
                  data.orderStatus
                );
                formattedResponse.isWatched =
                  favouriteList.find(elem => String(elem.orderId) === String(data._id)) ===
                  undefined
                    ? 0
                    : 1;
                formattedResponse.l3 = '';
                formattedResponse.count = 0;
                formattedResponse.isReported = 0;
                formattedResponse.isCompleted = 0;
                formattedResponse.h3 = akUtils.convertDateToTimezone({
                  dateToConvert: data.etd,
                  timeZone: (currentUserHandler.getCurrentUser() || {}).timezone,
                  formatType: 'dt'
                });

                delete formattedResponse.surgeon;
                delete formattedResponse.surgery;
                delete formattedResponse.toAddress;
                delete formattedResponse.attributes;
                list.push(formattedResponse);
              }
            }
          }
          return bluebirdPromise.map(list, element => {
            let condition = { 'products.orderDetails.id': mongoose.Types.ObjectId(element.id) };
            condition = clientHandler.addClientFilterToConditions(condition);
            return shipmentModel
              .find(condition)
              .then(sdatalist =>
                bluebirdPromise.map(sdatalist, sdata =>
                  shipmentTrackingModel
                    .findOne({
                      'shipment.id': mongoose.Types.ObjectId(sdata._id)
                    })
                    .sort({ lastTracked: -1 })
                    .then(data => {
                      if (data) {
                        sdata.tracking = data;
                      } else {
                        sdata.tracking = {};
                      }
                      return sdata;
                    })
                )
              )
              .then(shipment => {
                shipment.forEach(ship => {
                  element.isReported = element.isReported || ship.issue ? 1 : 0;
                  const currentLocationData = ship.tracking.currentLocation || {};
                  element.l3 = commonHelper.getCurrentLocationString(currentLocationData);
                });
                return element;
              });
          });
        })
      )
      .then(result => {
        if (result.length === 0) {
          return bluebirdPromise.reject();
        }
        return bluebirdPromise.resolve(result);
      })
  );
};

orderService.prototype.getOrderForMobileById = function(orderId) {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return bluebirdPromise.reject();
  }
  let conditions = { _id: mongoose.Types.ObjectId(orderId) };
  conditions = clientHandler.addClientFilterToConditions(conditions);
  const uId = (currentUserHandler.getCurrentUser() || {}).uuid;

  conditions.orderStatus = {
    $nin: [orderStatusMap.Draft, orderStatusMap.Canceled]
  };
  let cond = { 'products.orderDetails.id': mongoose.Types.ObjectId(orderId) };
  cond = clientHandler.addClientFilterToConditions(cond);
  return bluebirdPromise
    .all([
      ordermodel
        .aggregate()
        .match(conditions)
        .exec(),

      shipmentModel.find(cond).then(sdatalist =>
        bluebirdPromise.map(sdatalist, sdata =>
          shipmentTrackingModel
            .findOne({
              'shipment.id': mongoose.Types.ObjectId(sdata._id)
            })
            .sort({ lastTracked: -1 })
            .then(data => {
              if (data) {
                sdata.tracking = data;
              } else {
                sdata.tracking = {};
              }
              return sdata;
            })
        )
      )
    ])
    .then(resObj => {
      const response = {};
      if (resObj[0].length > 0) {
        let formattedResponse = {};
        const data = resObj[0][0];
        const productsInOrder = data.products;
        const productsShipped = (resObj[1] || [])
          .map(elem => {
            const p = elem.products
              .filter(product => `${(product.orderDetails || {}).id}` === `${data._id}`)
              .map(elem => `${elem.id}`);
            return p;
          })
          .reduce((a, b) => (a || []).concat(b || []), []);

        const notShipped = productsInOrder.filter(
          product => (productsShipped || []).indexOf(`${product.id}`) < 0
        );
        formattedResponse.attributes = data.attributes; // ?
        formattedResponse = Object.assign(
          {},
          formattedResponse,
          data.addresses.reduce((result, address) => {
            result[address.addressType] = address.location;
            return result;
          }, {})
        );
        if (
          typeof formattedResponse.attributes !== 'undefined' &&
          formattedResponse.attributes !== null
        ) {
          formattedResponse = commonHelper.moveSystemAttributesToGlobal(formattedResponse);
        }
        return bluebirdPromise
          .all([
            locationHelper.getById(formattedResponse.toAddress.id).then(data =>
              countryHelper.getDialCodeFromShortCode(data.phonecode).then(dialcode => {
                data.dialCode = dialcode;
                return data;
              })
            )
          ])
          .then(locationData => {
            const toLocationData = [];
            toLocationData.push(locationData[0].name);
            toLocationData.push(locationData[0].address);
            toLocationData.push(locationData[0].city);
            toLocationData.push(locationData[0].state);
            toLocationData.push(locationData[0].country);
            formattedResponse.id = data._id;
            formattedResponse.caseId = data.code;
            formattedResponse.surgeryDate = data.etd;

            formattedResponse.color = '#A86C0B'; // ?
            formattedResponse.isCompleted = 0; // ?
            formattedResponse.isAssigned = 1;
            if (
              ((data.consumer || {}).id || (data.consumer || {}).uuid) !==
              currentUserHandler.getCurrentUser().uuid
            ) {
              formattedResponse.isAssigned = 0;
            }
            formattedResponse.caseStatus = data.orderStatus;

            formattedResponse.l1 = akUtils.emptyValue(formattedResponse.surgeon);
            formattedResponse.l2 = akUtils.emptyValue(formattedResponse.surgery);
            formattedResponse.l3 = toLocationData.join(', ');
            formattedResponse.l4 = '';
            if (locationData[0].phone) {
              formattedResponse.l4 = `+${locationData[0].dialCode}${locationData[0].phone}` || '';
            }
            formattedResponse.l5 = `+${locationData[0].dialCode}${locationData[0].fax}` || '';

            formattedResponse.l7 = akUtils.convertDateToTimezone({
              dateToConvert: formattedResponse.surgeryDate || '',
              timeZone: (currentUserHandler.getCurrentUser() || {}).timezone,
              formatType: 'dt'
            });
            formattedResponse.l6 = akUtils.convertDateToTimezone({
              dateToConvert: formattedResponse.expectedCompletionDate || '',
              timeZone: (currentUserHandler.getCurrentUser() || {}).timezone,
              formatType: 'dt'
            });

            delete formattedResponse.surgeon;
            delete formattedResponse.surgery;
            delete formattedResponse.toAddress;
            response.caseDetails = formattedResponse;
            response.shipments = [];

            resObj[1].forEach(shipment => {
              formattedResponse.isReported = formattedResponse.isReported || shipment.issue ? 1 : 0;
              const shipStatus = akUtils.objectKeyByValue(
                shipmentStatusLabelMap,
                shipment.shipmentStatus
              );

              const fResponse = {};
              fResponse.shipmentId = shipment._id;
              fResponse.shipmentNo = shipment.code;
              fResponse.isReported = shipment.issue ? 1 : 0;
              fResponse.surgeryDate = data.etd; // ?
              fResponse.isAssigned = 0; // ?
              fResponse.l1 = shipment.code;
              fResponse.l2 = shipStatus;
              const currentLocationData = shipment.tracking.currentLocation || {};

              fResponse.l3 = commonHelper.getCurrentLocationString(currentLocationData);

              let tmpDate1 = shipment.etd;
              let tmpDate2 = shipment.createdOn;

              switch (shipment.shipmentStatus) {
                case 10:
                  tmpDate1 = shipment.etd;
                  tmpDate2 = shipment.createdOn;
                  break;
                case 20:
                  tmpDate1 = shipment.etd;
                  tmpDate2 = shipment.scheduledPickupDate;
                  break;
                case 25:
                case 30:
                case 40:
                case 45:
                  tmpDate1 = shipment.etd;
                  tmpDate2 = shipment.shipDate;
                  break;
                case 50:
                case 60:
                  tmpDate1 = shipment.deliveryDate;
                  tmpDate2 = shipment.shipDate;
                  break;
                case 70:
                  tmpDate1 = shipment.etd;
                  tmpDate2 = shipment.createdOn;
                  break;
                default:
                  tmpDate1 = shipment.etd;
                  tmpDate2 = shipment.createdOn;
                  break;
              }

              fResponse.l4 = akUtils.convertDateToTimezone({
                dateToConvert: tmpDate1 || '',
                timeZone: (currentUserHandler.getCurrentUser() || {}).timezone,
                formatType: 'dt'
              });
              fResponse.l5 = akUtils.convertDateToTimezone({
                dateToConvert: tmpDate2 || '',
                timeZone: (currentUserHandler.getCurrentUser() || {}).timezone,
                formatType: 'dt'
              });

              fResponse.issueId = shipment.issue || '';
              fResponse.color = '#A86C0B'; // not in use anymore
              fResponse.shipStatus = shipment.shipmentStatus;
              fResponse.items = [];
              shipment.products.forEach(item => {
                if (orderId !== `${item.orderDetails.id}`) {
                  return;
                }
                const temp = {};
                temp.skuId = item.id;
                temp.itemId = item.id;
                temp.l1 = item.code;
                temp.l2 = item.name;
                temp.l3 = '';
                temp.l4 = '';
                temp.l5 = 1; // ?
                temp.isMissing = 0; // ? fill from missing flow
                fResponse.items.push(temp);
              });
              fResponse.map = { url: `${process.env.shipmentMapPrefix}${shipment.id}` };
              response.shipments.push(fResponse);
            });
            if ((notShipped || []).length) {
              const fResponse = {};
              fResponse.shipmentNo = 'Unshipped Products';
              fResponse.isReported = 0;
              fResponse.surgeryDate = data.etd;
              fResponse.isAssigned = 0;
              akUtils.log(data.orderStatus, 'data.orderStatus');
              fResponse.l1 = 'Unshipped';
              if (data.orderStatus === orderStatusArr.Closed) {
                fResponse.l1 = 'Closed';
              }
              fResponse.l2 = '';
              fResponse.l3 = '';
              fResponse.l4 = akUtils.convertDateToTimezone({
                dateToConvert: formattedResponse.surgeryDate || '',
                timeZone: (currentUserHandler.getCurrentUser() || {}).timezone,
                formatType: 'dt'
              });
              fResponse.l5 = akUtils.convertDateToTimezone({
                dateToConvert: data.orderedDate || '',
                timeZone: (currentUserHandler.getCurrentUser() || {}).timezone,
                formatType: 'dt'
              }); // ? add order date
              fResponse.issueId = '';
              fResponse.color = '#A86C0B';
              fResponse.shipStatus = 0;
              fResponse.items = [];
              notShipped.forEach(item => {
                const temp = {};
                temp.skuId = item.id;
                temp.itemId = item.id;
                temp.l1 = item.code;
                temp.l2 = item.name;
                temp.l3 = '';
                temp.l4 = '';
                temp.l5 = 1;
                temp.isMissing = 0;
                fResponse.items.push(temp);
              });
              fResponse.map = { url: '' };
              response.shipments.push(fResponse);
            }
            return bluebirdPromise.resolve(response);
          });
      }
      return bluebirdPromise.reject();

      return bluebirdPromise.resolve(response);
    });
};
orderService.prototype.getById = function(orderId) {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return bluebirdPromise.reject();
  }
  let conditions = { _id: mongoose.Types.ObjectId(orderId) };
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return bluebirdPromise
    .all([ordermodel.findOne(conditions).exec(), this.getShipmentsForOrder(orderId)])
    .then(resultObj => {
      if (Object.getOwnPropertyNames(resultObj[0]).length === 0) {
        return bluebirdPromise.reject();
      }
      const response = this.formatResponse(resultObj[0]);
      response.shipments = resultObj[1];
      return bluebirdPromise.resolve(response);
    })
    .catch(err => {
      akUtils.log(err);
    });
  // return ordermodel.aggregate()
  //   .match(conditions)
  //   .exec()
  //   .then((result) => {
  //     if (result.length > 0) {
  //       let response = this.formatResponse(result[0]);
  //     }
  //     else {
  //       return bluebirdPromise.reject();
  //     }
  //   });
};

orderService.prototype.getByCode = function(code = '', excludedObjId = null) {
  let conditions;
  if (excludedObjId !== null) {
    conditions = { code, _id: { $ne: mongoose.Types.ObjectId(excludedObjId) } };
  } else {
    conditions = { code };
  }
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return ordermodel
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

orderService.prototype.count = function({ searchParams, projectParams }) {
  searchParams = clientHandler.addClientFilterToConditions(searchParams);

  return ordermodel
    .aggregate([projectParams])
    .match(searchParams)
    .exec()
    .then(result => result.length);
};
orderService.prototype.formatResponseForMobile = function(data, isDropdown = false) {
  let formattedResponse = {};
  if (!isDropdown) {
    formattedResponse.id = data._id;
    formattedResponse.caseId = data.code;
    formattedResponse.status = data.status;

    formattedResponse.orderedDate = data.orderedDate;
    formattedResponse.surgeryDate = data.etd;
    formattedResponse.expectedCompletionDate = data.expectedCompletionDate;

    formattedResponse.consumer = data.consumer;
    formattedResponse.color = '#A86C0B';
    formattedResponse.l4 = 'Open';
    formattedResponse.caseStatus = data.orderStatus;
    formattedResponse.updatedOn = data.updatedOn;
    if (data.updatedBy) {
      formattedResponse.updatedBy = `${((data || {}).updatedBy || '').firstName} ${((data || {})
        .updatedBy || ''
      ).lastName}`;
    }
    formattedResponse = Object.assign(
      {},
      formattedResponse,
      data.addresses.reduce((result, address) => {
        result[address.addressType] = address.location.name;
        return result;
      }, {})
    );
    formattedResponse.attributes = data.attributes;

    formattedResponse.client = data.client;
    formattedResponse.tags = data.tags;

    if (
      typeof formattedResponse.attributes !== 'undefined' &&
      formattedResponse.attributes !== null
    ) {
      formattedResponse = commonHelper.moveSystemAttributesToGlobal(formattedResponse);
    }
    formattedResponse.h1 = formattedResponse.surgeon;
    formattedResponse.l1 = formattedResponse.surgery;
    formattedResponse.l2 = formattedResponse.toAddress;
    formattedResponse.l2 = formattedResponse.toAddress;
    formattedResponse.h2 = formattedResponse.surgeryDate;
    formattedResponse.h3 = formattedResponse.expectedCompletionDate;
    formattedResponse.l6 = formattedResponse.surgeryDate;
    formattedResponse.l7 = formattedResponse.expectedCompletionDate;

    delete formattedResponse.surgeon;
    delete formattedResponse.surgery;
    delete formattedResponse.toAddress;
    delete formattedResponse.expectedCompletionDate;
    return formattedResponse;
  }
  formattedResponse.id = data._id;
  formattedResponse.code = data.code;
  return formattedResponse;
};
orderService.prototype.formatResponse = function(data, isDropdown = false) {
  let formattedResponse = {};
  if (!isDropdown) {
    formattedResponse.id = data._id;
    formattedResponse.code = data.code;
    formattedResponse.status = data.status;

    formattedResponse.orderedDate = data.orderedDate;
    formattedResponse.etd = data.etd;
    formattedResponse.expectedCompletionDate = data.expectedCompletionDate;

    formattedResponse.consumer = data.consumer;
    formattedResponse.orderStatus = data.orderStatus;

    formattedResponse.orderStatusLabel =
      akUtils.objectKeyByValue(orderStatusLabelMap, data.orderStatus) || '';

    formattedResponse.updatedOn = data.updatedOn;
    if (data.updatedBy) {
      formattedResponse.updatedBy = `${((data || {}).updatedBy || '').firstName} ${((data || {})
        .updatedBy || ''
      ).lastName}`;
    }
    formattedResponse.isMissing = false;
    formattedResponse.isReported = false;
    (data.products || []).forEach(product => {
      if (mongoose.Types.ObjectId.isValid(((product || {}).issue || {}).id)) {
        formattedResponse.isReported = true;
      }
    });

    formattedResponse.issues =
      (data.products || []).map(product => product.issue).filter(item => item) || [];
    formattedResponse.products = (data.products || []).map(product => {
      product.isReported = false;
      if (mongoose.Types.ObjectId.isValid(((product || []).issue || {}).id)) {
        formattedResponse.isReported = true;
        product.isReported = true;
      }
      return product;
    });
    formattedResponse.issues = Array.from(
      new Set((formattedResponse.issues || []).map(JSON.stringify))
    ).map(JSON.parse);
    formattedResponse.addresses = data.addresses;
    formattedResponse.attributes = data.attributes;

    const addresses = data.addresses.reduce((a, b) => {
      a[b.addressType] = b.location;
      return a;
    }, {});
    formattedResponse = Object.assign({}, formattedResponse, addresses);

    formattedResponse.client = data.client;
    formattedResponse.tags = data.tags;

    if (
      typeof formattedResponse.attributes !== 'undefined' &&
      formattedResponse.attributes !== null
    ) {
      return commonHelper.moveSystemAttributesToGlobal(formattedResponse);
    }
    return formattedResponse;
  }
  formattedResponse.id = data._id;
  formattedResponse.code = data.code;
  return formattedResponse;
};

orderService.prototype.getColumnMap = function getColumnMap(key) {
  const map = {
    id: '_id',
    code: 'code',
    name: 'name',
    sysDefined: 'sysDefined',
    updatedOn: 'updatedOn',
    updatedBy: 'updatedBy',
    orderedDate: 'orderedDate',
    etd: 'etd',
    salesRep: 'consumer.firstName',
    orderStatusUpdatedOn: 'orderStatusUpdatedOn',
    toAddress: 'addresses.location.name'
  };

  if (key) {
    return map[key] || key;
  }
  return map;
};

orderService.prototype.get = function({ projectParams, searchParams, otherParams }) {
  searchParams = clientHandler.addClientFilterToConditions(searchParams);
  return ordermodel
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
        for (const i in result) {
          if (result.hasOwnProperty(i)) {
            list.push(this.formatResponse(result[i], otherParams.isDropdown));
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

orderService.prototype.getProjectParams = function(event) {
  const project = {};
  project.$addFields = {
    consumerForSearch: { $concat: ['$consumer.firstName', ' ', '$consumer.lastName'] }
  };
  return project;
};

orderService.prototype.getFilterParams = function(event) {
  const filters = {};
  filters.$and = [];
  if (!event.queryStringParameters) {
    return filters;
  }
  if (event.queryStringParameters && event.queryStringParameters.filter) {
    // filters._all = event.queryStringParameters.filter;

    filters.$or = [
      { 'product.name': new RegExp(event.queryStringParameters.filter, 'i') },
      { code: new RegExp(event.queryStringParameters.filter, 'i') },
      { status: new RegExp(event.queryStringParameters.filter, 'i') },
      { orderStatus: new RegExp(event.queryStringParameters.filter) },
      { consumerForSearch: new RegExp(event.queryStringParameters.filter, 'i') },
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
      {
        addresses: {
          $elemMatch: {
            addressType: addressType[0],
            'location.name': new RegExp(event.queryStringParameters.filter, 'i')
          }
        }
      }
    ];
    filters.$or.push({ orderStatus: akUtils.getOrderStatus(event.queryStringParameters.filter) });
  }

  if (event.queryStringParameters.id) {
    filters._id = mongoose.Types.ObjectId(event.queryStringParameters.id);
  }
  if (event.queryStringParameters.orderNo) {
    filters.code = new RegExp(event.queryStringParameters.orderNo, 'i');
  }
  if (event.queryStringParameters.orderStatus) {
    if (orderStatusMap[event.queryStringParameters.orderStatus]) {
      filters.orderStatus = parseInt(orderStatusMap[event.queryStringParameters.orderStatus], 10);
    } else {
      filters.orderStatus = parseInt(event.queryStringParameters.orderStatus, 10);
    }
  }
  if (event.queryStringParameters.consumer) {
    filters['consumer.uuid'] = event.queryStringParameters.consumer;
  }
  if (event.queryStringParameters.surgeon) {
    filters.$and.push({
      attributes: {
        $elemMatch: { name: 'surgeon', value: new RegExp(event.queryStringParameters.surgeon, 'i') }
      }
    });
  }
  if (event.queryStringParameters.surgery) {
    filters.$and.push({
      attributes: {
        $elemMatch: { name: 'surgery', value: new RegExp(event.queryStringParameters.surgery, 'i') }
      }
    });
  }
  if (event.queryStringParameters.toAddress) {
    filters.addresses = {
      $elemMatch: {
        addressType: addressType[0],
        'location.name': new RegExp(event.queryStringParameters.toAddress, 'i')
      }
    };
  }

  if (event.queryStringParameters.surgeryDate) {
    const dates = event.queryStringParameters.surgeryDate.split('--');
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
  if (event.queryStringParameters.orderedDate) {
    const dates = event.queryStringParameters.orderedDate.split('--');
    const arr = [];
    if (dates[0]) {
      arr.push({
        orderedDate: {
          $gte: new Date(dates[0])
        }
      });
    }
    if (dates[1]) {
      arr.push({
        orderedDate: {
          $lte: new Date(dates[1])
        }
      });
    }
    if (arr.length) {
      filters.$and = filters.$and.concat(arr);
    }
  }
  if (event.queryStringParameters.status === '1') {
    filters.status = 1;
  } else if (event.queryStringParameters.status === '0') {
    filters.status = 0;
  }
  if (event.queryStringParameters.dd === '1') {
    filters.status = 1;
  }
  filters.$and.length ? '' : delete filters.$and;
  return filters;
};

orderService.prototype.getExtraParams = function(event) {
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
        params.sort[col] = sortOrder || 1;
      }
    }, this);
  } else {
    params.sort.updatedOn = -1;
  }

  return params;
};

orderService.prototype.isDuplicateCode = function(code = '', excludedObjId = null) {
  let conditions;
  if (excludedObjId !== null && mongoose.Types.ObjectId.isValid(excludedObjId)) {
    conditions = { code, _id: { $ne: mongoose.Types.ObjectId(excludedObjId) } };
  } else {
    conditions = { code };
  }
  return ordermodel
    .findOne(conditions)
    .exec()
    .then(result => {
      if (result) {
        return bluebirdPromise.resolve(['Code already exists']);
      }
      return bluebirdPromise.resolve([]);
    })
    .catch(err => bluebirdPromise.reject(err));
};

/**
 * Performs save-specific validations before performing common validations.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
orderService.prototype.validateRequest = function(event) {
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
orderService.prototype.validateUpdate = function(event) {
  let basicErrors;
  return this.commonValidations(event)
    .catch(errors => errors)
    .then(errorsIfAny => {
      basicErrors = errorsIfAny || {};
      return bluebirdPromise.all([
        bluebirdPromise.all([
          validator.checkSame('orders', 'code', event.body.code, event.pathParameters.id)
        ])
      ]);
    })
    .then(result => {
      const mapping = {
        code: { index: 0, fieldName: 'Order#' }
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

/**
 * Performs common validations in both update and save.
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
orderService.prototype.commonValidations = function(event) {
  return bluebirdPromise
    .all([
      bluebirdPromise.all([
        validator.required(event.body.code),
        validator.stringLength(0, validator.CODE_MAX_LENGTH, event.body.code),
        validator.notDuplicate('orders', 'code', event.body.code, event.pathParameters.id)
      ]),
      bluebirdPromise.all([validator.valueAllowed([0, 1], event.body.status)]),
      bluebirdPromise.all([
        validator.required(event.body.orderedDate),
        validator.type('string', event.body.orderedDate)
      ]),
      bluebirdPromise.all([
        validator.required(event.body.addresses),
        validator.type('array', event.body.addresses),
        validator.duplicateArrayElements('addressType', event.body.addresses),
        validator.duplicateArrayElements(
          null,
          (event.body.addresses || []).map(item => item.location.id)
        ),
        validator.arrayOfType('object', event.body.addresses),
        validator.valueAllowed(addressType, event.body.addresses, 'addressType'),
        validator.requiredValues(addressType, event.body.addresses, 'addressType')
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
        validator.type('array', event.body.products),
        validator.arrayOfType('object', event.body.products),
        validator.requiredKeyinObject(event.body.products, 'id'),
        validator.duplicateArrayElements('id', event.body.products),
        validator.validatePopulatableLists(
          'products',
          (event.body.products || []).map(item => item.id),
          event.pathParameters.id
        ),
        this.validateProductAddition(event, event.pathParameters.id)
      ]),
      bluebirdPromise.all([
        validator.type('string', event.body.etd),
        validator.validateTimeDiff(new Date(), event.body.etd, 120)
      ]),
      bluebirdPromise.all([
        validator.type('object', event.body.consumer),
        validator.requiredKeyinObject(event.body.consumer, 'uuid')
      ])
    ])
    .then(result => {
      const validatorErrorsMap = {
        code: { index: 0, fieldName: 'Order#' },
        status: { index: 1, fieldName: 'Status' },
        orderedDate: { index: 2, fieldName: 'Ordered Date' },
        addresses: { index: 3, fieldName: 'To address' },
        tags: { index: 4, fieldName: 'Tags' },
        attributes: { index: 5, fieldName: 'Attributes' },
        products: { index: 6, fieldName: 'Products' },
        etd: { index: 7, fieldName: 'Surgery Date--Current Time' },
        consumer: { index: 8, fieldName: 'Sales Representative' }
      };

      const errors = akUtils.mapAndGetValidationErrors(result, validatorErrorsMap);
      if (event.body.orderStatus !== orderStatusMap.Draft || event.body.action !== 'draft') {
        return this.specificValidations(event)
          .then(() => {
            if (errors) {
              return bluebirdPromise.reject(errors);
            }
            return bluebirdPromise.resolve();
          })
          .catch(error => {
            Object.getOwnPropertyNames(error).forEach(e => {
              if (!error[e].status) {
                errors[e] = error[e];
              }
            });
            // errors = Object.assign({}, (errors || {}), error);
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
orderService.prototype.specificValidations = function(event) {
  return bluebirdPromise
    .all([
      bluebirdPromise.all([validator.required(event.body.etd)]),
      bluebirdPromise.all([validator.required(event.body.products, { multiple: 1 })]),
      bluebirdPromise.all([
        validator.type('object', event.body.consumer),
        validator.requiredKeyinObject(event.body.consumer, 'uuid')
      ])
    ])
    .then(result => {
      const validatorErrorsMap = {
        etd: { index: 0, fieldName: 'Surgery Date' },
        products: { index: 1, fieldName: 'Products' },
        consumer: { index: 2, fieldName: 'Sales Representative' }
      };

      const errors = akUtils.mapAndGetValidationErrors(result, validatorErrorsMap);
      if (errors) {
        return bluebirdPromise.reject(errors);
      }
      return bluebirdPromise.resolve();
    });
};
orderService.prototype.populateIds = function(event) {
  const tasks = [
    tagHelper.getForPopulation(event.body.tags),
    attributeHelper.getForPopulation(event.body.attributes),
    commonHelper.populateSystemAttributes('orderSysDefinedAttrs', event),
    commonHelper.getLocationListFromIds(event.body.addresses)
  ];
  if ((event.body.products || []).length) {
    tasks.push(commonHelper.getProductListFromIds(event.body.products));
  }

  return bluebirdPromise
    .all(tasks)
    .then(populations => {
      event.body.tags = populations[0];
      event.body.attributes = [...populations[1], ...populations[2]];
      event.body.addresses = populations[3];
      if ((event.body.products || []).length) {
        event.body.products = populations[4];
      }
      return bluebirdPromise.resolve(event);
    })
    .catch(err => bluebirdPromise.reject(err));
};

/**
 * Save an order
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of save operation.
 * 
 */
orderService.prototype.save = function save(event) {
  const self = this;
  const orderData = event.body;
  let vOrderObj = null;
  let orderObj = new ordermodel(); // create a new instance of the  model
  orderObj.code = orderData.code;
  orderObj.name = orderData.code;
  orderObj.status = orderData.status ? orderData.status : 1;

  // set order status here
  orderObj.orderStatus = orderData.orderStatus ? orderData.orderStatus : orderStatusArr.Draft;

  // set item initial status here
  if (orderData.products) {
    orderData.products.forEach((st, index) => {
      orderData.products[index].deliveryStatus = itemStatusArr.Open;
    });
  }

  orderObj.orderStatusUpdatedOn = Date.now();
  orderObj.orderedDate = orderData.orderedDate;

  if (
    orderData.etd !== null &&
    typeof orderData.etd !== 'undefined' &&
    orderData.etd.trim() !== ''
  ) {
    orderObj.etd = orderData.etd;
  }
  if (
    orderData.expectedCompletionDate !== null &&
    typeof orderData.expectedCompletionDate !== 'undefined' &&
    orderData.expectedCompletionDate.trim() !== ''
  ) {
    orderObj.expectedCompletionDate = orderData.expectedCompletionDate;
  }

  orderObj.consumer = orderData.consumer;
  orderObj.updatedOn = Date.now();
  orderObj.updatedBy = currentUserHandler.getCurrentUser();
  orderObj.client = clientHandler.getClient();

  orderObj.addresses = orderData.addresses;
  orderObj.products = orderData.products;
  orderObj.attributes = orderData.attributes;

  orderObj.tags = orderData.tags;
  orderObj.createdOn = Date.now();
  orderObj.createdBy = currentUserHandler.getCurrentUser();
  // return bluebirdPromise.resolve(orderObj);
  return orderObj
    .save()
    .then(orderObj => {
      const favouriteOrderObj = new favouriteOrderModel();
      favouriteOrderObj.orderId = orderObj._id;
      favouriteOrderObj.favouritedBy = [];
      favouriteOrderObj.client = clientHandler.getClient();
      return favouriteOrderObj.save().then(res => orderObj);
    })
    .then(orderObj =>
      // save order orchestration here
      self.addOrderOrchestrations(orderObj).then(() => orderObj)
    )
    .then(orderObj => {
      vOrderObj = orderObj;
      // save order product orchestration here
      const promises = vOrderObj.products.map(row =>
        self.setItemOrchestration(row.id, itemStatusArr.Open, 'order', vOrderObj._id)
      );
      return bluebirdPromise.all(promises).then(() => bluebirdPromise.resolve(orderObj));
    })
    .then(orderObj => {
      if (orderObj.orderStatus === orderStatusMap.Draft) {
        return orderObj;
      }
      return self.internalShipment({ order: orderObj });
    })
    .then(() => {
      orderObj = vOrderObj;
      if (orderObj.orderStatus === orderStatusMap.Draft || !(orderObj.consumer || {}).uuid) {
        return bluebirdPromise.resolve(orderObj);
      }
      const params = {
        orderId: `${orderObj._id}`,
        orderCode: orderObj.code,
        consumer: orderObj.consumer
      };
      const recieverData = {
        sendType: 'user',
        appType: 'salesRep',
        namedUserId: orderObj.consumer.email
      };
      return notificationLib
        .saveNotification('OrderCreation', params, recieverData, orderObj.consumer)
        .then(() => orderObj);
    })
    .then(orderObj => bluebirdPromise.resolve(orderObj));
};

/**
 * Update a order
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Promise to represent the result of update operation.
 * 
 */
orderService.prototype.update = function update(event) {
  const orderData = event.body;
  const action = orderData.action;
  const orderId = event.pathParameters.id;
  let oldOrderObj;
  let newOrderObject;
  const self = this;
  let updatedOrderObj;

  let condition = {
    _id: orderId
  };
  const newItems = [];
  condition = clientHandler.addClientFilterToConditions(condition);
  return ordermodel
    .findOne(condition)
    .then(orderObj => {
      if (orderObj === null) {
        return false;
      }
      oldOrderObj = JSON.parse(JSON.stringify(orderObj));
      const orderUpdateObj = {};

      orderUpdateObj.status = orderData.status ? orderData.status : 1;

      // set order status here
      if (action !== 'edit') {
        // don't change status
        if (orderData.orderStatus) {
          orderUpdateObj.orderStatus = orderData.orderStatus;
        }
      }
      if ((orderData.products || []).length) {
        orderData.products.forEach((st, index) => {
          const fproduct = (orderObj.products || []).filter(row => {
            // don't update item status. get from db
            if (row.id.equals(orderData.products[index].id)) {
              return row;
            }
          });
          if (fproduct.length) {
            orderData.products[index].deliveryStatus = fproduct[0].deliveryStatus;
          } else {
            newItems.push(orderData.products[index]);
            orderData.products[index].deliveryStatus = itemStatusArr.Open;
          }
        });
      }
      orderUpdateObj.products = orderData.products;

      if (
        orderData.etd !== null &&
        typeof orderData.etd !== 'undefined' &&
        orderData.etd.trim() !== ''
      ) {
        orderUpdateObj.etd = orderData.etd;
      }
      if (
        orderData.expectedCompletionDate !== null &&
        typeof orderData.expectedCompletionDate !== 'undefined' &&
        orderData.expectedCompletionDate.trim() !== ''
      ) {
        orderUpdateObj.expectedCompletionDate = orderData.expectedCompletionDate;
      }

      orderUpdateObj.consumer = orderData.consumer;
      orderUpdateObj.updatedOn = Date.now();
      orderUpdateObj.updatedBy = currentUserHandler.getCurrentUser();
      orderUpdateObj.client = clientHandler.getClient();
      orderUpdateObj.addresses = orderData.addresses;
      orderUpdateObj.attributes = orderData.attributes;

      // to do update only new
      // if ( orderObj.orderStatus === orderStatusArr.Open || orderObj.orderStatus === orderStatusArr.Scheduled  ) {

      // }
      // orderObj.products = orderData.products;
      orderUpdateObj.tags = orderData.tags;

      // return orderObj.save();
      const updateParams = {
        $set: orderUpdateObj,
        $inc: { __v: 1 }
      };
      return ordermodel
        .findOneAndUpdate({ _id: orderId }, updateParams, {
          upsert: false,
          new: true
        })
        .exec();
    })
    .then(orderObj => {
      updatedOrderObj = orderObj;
      newOrderObject = JSON.parse(JSON.stringify(orderObj));
      // save order new product(s) orchestration here
      if (newItems.length) {
        const promises = newItems.map(row =>
          self.setItemOrchestration(row.id, itemStatusArr.Open, 'order', orderId)
        );
        return bluebirdPromise.all(promises);
      }
      return bluebirdPromise.resolve(newOrderObject);
    })
    .then(() => {
      // newOrderObject = JSON.parse(JSON.stringify(orderObj));
      if (action === 'edit') {
        return bluebirdPromise.resolve(newOrderObject);
      }
      // capture order status
      return orderOrchestrationHelper.update({
        orderId: newOrderObject._id,
        orderStatus: newOrderObject.orderStatus,
        actionTime: new Date()
      });
    })
    .then(() => {
      if (newOrderObject.orderStatus === orderStatusMap.Open) {
        return self.internalShipment({ order: updatedOrderObj });
      }
      return newOrderObject;
    })
    .then(result => {
      if (
        newOrderObject.orderStatus === orderStatusMap.Draft ||
        !(newOrderObject.consumer || {}).uuid
      ) {
        return bluebirdPromise.resolve(result);
      } else if (
        oldOrderObj.orderStatus === orderStatusMap.Draft ||
        !(oldOrderObj.consumer || {}).uuid
      ) {
        const params = {
          orderId: `${newOrderObject._id}`,
          orderCode: newOrderObject.code,
          consumer: newOrderObject.consumer
        };
        const recieverData = {
          sendType: 'user',
          appType: 'salesRep',
          namedUserId: newOrderObject.consumer.email
        };
        return notificationLib.saveNotification(
          'OrderCreation',
          params,
          recieverData,
          newOrderObject.consumer
        );
      }
      if ((newOrderObject.consumer || {}).uuid !== (oldOrderObj.consumer || {}).uuid) {
        const params = {
          orderId: `${newOrderObject._id}`,
          orderCode: newOrderObject.code,
          oldConsumer: oldOrderObj.consumer,
          newConsumer: newOrderObject.consumer
        };
        const oldRecieverData = {
          sendType: 'user',
          appType: 'salesRep',
          namedUserId: oldOrderObj.consumer.email
        };
        const newRecieverData = {
          sendType: 'user',
          appType: 'salesRep',
          namedUserId: newOrderObject.consumer.email
        };
        return bluebirdPromise.all([
          notificationLib.saveNotification(
            'OrderAssignedFromSalesRep',
            params,
            oldRecieverData,
            oldOrderObj.consumer
          ),
          notificationLib.saveNotification(
            'OrderAssignedToSalesRep',
            params,
            newRecieverData,
            newOrderObject.consumer
          )
        ]);
      } else if (`${newOrderObject.etd}` !== `${oldOrderObj.etd}`) {
        const params = {
          orderId: `${newOrderObject._id}`,
          orderCode: newOrderObject.code,
          oldSurgeryDate: oldOrderObj.etd,
          newSurgeryDate: newOrderObject.etd,
          consumer: newOrderObject.consumer
        };
        const recieverData = {
          sendType: 'user',
          appType: 'salesRep',
          namedUserId: newOrderObject.consumer.email
        };
        return notificationLib.saveNotification(
          'SurgeryDateChange',
          params,
          recieverData,
          newOrderObject.consumer
        );
      }
    })
    .then(() => bluebirdPromise.resolve(newOrderObject));
};

orderService.prototype.validateProductAddition = function validateProductAddition(
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

  const timediff = require('timediff');
  const products = event.body.products;

  const timeGap = 120;
  const keyTocheckon = 'etd';
  const newObjectTime = event.body[keyTocheckon];
  const list = [];
  const searchParams = {};
  if (excludedObjId !== null) {
    searchParams._id = { $ne: mongoose.Types.ObjectId(excludedObjId) };
  }

  const project = { _id: 1, code: 1, etd: 1, expectedCompletionDate: 1, orderedDate: 1 };
  return bluebirdPromise
    .each(products, product => {
      project.products = {
        $filter: {
          input: '$products',
          as: 'product',
          cond: { $eq: ['$$product.id', mongoose.Types.ObjectId(product.id)] }
        }
      };

      searchParams['products.id'] = mongoose.Types.ObjectId(product.id);
      searchParams.orderStatus = { $nin: [orderStatusMap.Draft] };

      return ordermodel
        .aggregate()
        .match(searchParams)
        .project(project)
        .exec()
        .then(result => {
          if (result) {
            for (const i in result) {
              if (result.length > 0) {
                const resultObjectTime = result[i][keyTocheckon];
                const rn_td = timediff(newObjectTime, resultObjectTime, 'm').minutes;
                const nr_td = timediff(resultObjectTime, newObjectTime, 'm').minutes;
                // var productId = result[i].products[0].code;
                const productName = result[i].products[0].name;
                const orderCode = result[i].code;

                if (rn_td <= timeGap && timeGap >= nr_td) {
                  const tz = currentUserHandler.getCurrentUser().timezone;

                  const time = akUtils.convertDateToTimezone({
                    dateToConvert: resultObjectTime,
                    timeZone: tz,
                    formatType: 'dt'
                  });
                  list.push(
                    `Product: ${productName} cannot be assigned to this order as it is already assigned into Order# ${orderCode} having Surgery Date:  ${time}. Please select the Surgery Date having a gap of at least ${timeGap} minutes.`
                  );
                }
              }
            }
          }
        });
    })
    .then(() => {
      let result = {
        status: true,
        validatorErrors: {}
      };

      if (list.length > 0) {
        result = {
          status: false,
          validatorErrors: {
            eCode: 'ak-productAddition',
            allowedValues: 'asff',
            data: list
          }
        };
      }
      return bluebirdPromise.resolve(result);
    });
};

orderService.prototype.getProducts = function getProducts(searchParams, otherParams) {
  const filters = {};
  filters.orderStatus = {
    $nin: [
      orderStatusMap.Draft,
      orderStatusMap.Delivered,
      orderStatusMap.Canceled,
      orderStatusMap.Submitted,
      orderStatusMap.Closed
    ]
  };
  searchParams = Object.assign({}, searchParams, filters);
  searchParams = clientHandler.addClientFilterToConditions(searchParams);
  const project = {
    _id: 1,
    code: 1,
    name: 1,
    addresses: 1,
    'products.id': 1,
    'products.code': 1,
    'products.name': 1,
    'products.things': 1
  };

  return ordermodel
    .aggregate()
    .match(searchParams)
    .sort(otherParams.sort)
    .project(project)
    .collation({
      locale: 'en_US',
      caseLevel: false
    })
    .exec()
    .then(result => {
      const list = [];
      if (result) {
        const products = result
          .map(order => order.products.map(product => product.id))
          .reduce((a, b) => a.concat(b));
        return productTrackingModel
          .find({ 'product.id': { $in: products } })
          .exec()
          .then(productLocations => {
            const pl = productLocations.reduce((initial, current) => {
              initial[`${current.product.id}`] = current.currentLocation;
              return initial;
            }, {});
            result.forEach(order => {
              order = commonHelper.deepCloneObject(order);
              order.products = order.products.map(product => {
                product.currentLocation = pl[`${product.id}`];
                return product;
              });
              list.push(this.formatResponse(order, otherParams.isDropdown));
            });
            return list;
          });
      }
    })
    .then(result => {
      if ((result || []).length === 0) {
        return bluebirdPromise.reject();
      }
      return bluebirdPromise.resolve(result);
    })
    .catch(err => {
      akUtils.log(err);
    });
};

orderService.prototype.getProductDetailForMobile = function getProducts(event) {
  const orderId = event.queryStringParameters.caseNo;
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return bluebirdPromise.reject('Invalid OrderId');
  }
  const prodId = event.queryStringParameters.skuId;
  if (!mongoose.Types.ObjectId.isValid(prodId)) {
    return bluebirdPromise.reject('Invalid prodId');
  }
  let filters = {};
  filters.products = {};
  filters = { 'products.id': mongoose.Types.ObjectId(prodId) };
  filters._id = mongoose.Types.ObjectId(orderId);
  filters = clientHandler.addClientFilterToConditions(filters);
  return ordermodel
    .findOne(filters)
    .exec()
    .then(result => {
      if (!result || Object.getOwnPropertyNames(result) === 0) {
        return bluebirdPromise.resolve({});
      }
      const fResponse = {};
      const data = result;
      const product = data.products.filter(product => `${product.id}` === prodId);

      fResponse.caseId = data._id;
      fResponse.skuId = (product[0] || {}).id;
      fResponse.l1 = '';
      fResponse.l2 = '';
      fResponse.l3 = '';
      fResponse.l4 = ((data.addresses.filter(address => address.addressType === 'toAddress')[0] ||
        []
      ).location || {}
      ).name;
      fResponse.l5 = '';
      fResponse.attributes = [
        {
          key: 'SKU',
          value: (product[0] || {}).code
        }
      ];
      return bluebirdPromise.resolve(fResponse);
    })
    .catch(err => {
      akUtils.log(err);
    });
};

orderService.prototype.isDuplicate = function(field, value = '', excludedObjId = null) {
  let conditions = {};
  conditions[field] = value;
  if (excludedObjId !== null && mongoose.Types.ObjectId.isValid(excludedObjId)) {
    conditions._id = { $ne: mongoose.Types.ObjectId(excludedObjId) };
  }
  conditions = clientHandler.addClientFilterToConditions(conditions);

  return ordermodel
    .findOne(conditions)
    .exec()
    .then(result => {
      if (result) {
        return bluebirdPromise.resolve();
      }
      return bluebirdPromise.reject();
    });
};

orderService.prototype.validateFavouriteRequest = function(event) {
  return bluebirdPromise
    .all([
      bluebirdPromise.all([
        validator.required(event.body.caseNo),
        validator.type('string', event.body.caseNo),
        validator.stringLength(0, validator.CODE_MAX_LENGTH, event.body.caseNo)
      ]),
      bluebirdPromise.all([
        validator.type('number', event.body.isWatch),
        validator.valueAllowed([0, 1], event.body.isWatch)
      ])
    ])
    .then(result => {
      const validatorErrorsMap = {
        caseNo: { index: 0, fieldName: '[caseNo]' },
        isWatch: { index: 1, fieldName: '[isWatch]' }
      };

      const errors = akUtils.mapAndGetValidationErrors(result, validatorErrorsMap);
      if (!jsTypeChecker.isEmptyObject(errors)) {
        return bluebirdPromise.reject(errors);
      }
      return bluebirdPromise.resolve();
    });
};

orderService.prototype.favourite = function(event) {
  let conditions = {};
  // akUtils.log(event)
  conditions.orderId = mongoose.Types.ObjectId(event.body.caseNo);
  conditions = clientHandler.addClientFilterToConditions(conditions);
  // conditions['attributes.name'] = "isWatched";
  const updateParams = {};
  if (event.body.isWatch === 1) {
    updateParams.$push = {
      favouritedBy: currentUserHandler.getCurrentUser().uuid
    };
  } else {
    updateParams.$pull = {
      favouritedBy: currentUserHandler.getCurrentUser().uuid
    };
  }
  return favouriteOrderModel.findOneAndUpdate(conditions, updateParams, {
    upsert: false,
    new: true
  });
};

orderService.prototype.getUserFavourites = function(userUuid) {
  let conditions = {};
  conditions.favouritedBy = userUuid;
  conditions = clientHandler.addClientFilterToConditions(conditions);
  return favouriteOrderModel.find(conditions);
};

orderService.prototype.setOrderShipped = function(orderId, shipTime) {
  const itemStatus = require('../mappings/itemStatus.json');
  const orderStatus = require('../mappings/orderStatus.json');

  let condition = {
    _id: orderId
  };
  condition = clientHandler.addClientFilterToConditions(condition);
  return ordermodel
    .findOne(condition)
    .then(orderObj => {
      if (orderObj === null) {
        return false;
      }

      const sproducts = orderObj.products.filter(row => {
        if (
          row.deliveryStatus === itemStatus.SoftShipped ||
          row.deliveryStatus === itemStatus.Shipped
        ) {
          return row;
        }
      });

      if (sproducts.length === orderObj.products.length) {
        orderObj.orderStatus = orderStatus.Shipped;
      } else {
        orderObj.orderStatus = orderStatus.PartialShipped;
      }
      return orderObj.save();
    })
    .then(orderObj =>
      orderOrchestrationHelper.update({
        orderId: orderObj._id,
        orderStatus: orderObj.orderStatus,
        actionTime: shipTime
      })
    );
};

orderService.prototype.setOrderDelivered = function(orderId, deliveryTime) {
  const itemStatus = require('../mappings/itemStatus.json');
  const orderStatus = require('../mappings/orderStatus.json');

  let condition = {
    _id: orderId
  };
  condition = clientHandler.addClientFilterToConditions(condition);
  return ordermodel
    .findOne(condition)
    .then(orderObj => {
      if (orderObj === null) {
        return false;
      }

      const sproducts = orderObj.products.filter(row => {
        if (
          row.deliveryStatus === itemStatus.Delivered ||
          row.deliveryStatus === itemStatus.SoftDelivered
        ) {
          return row;
        }
      });

      if (sproducts.length === orderObj.products.length) {
        orderObj.orderStatus = orderStatus.Delivered;
      } else {
        orderObj.orderStatus = orderStatus.PartialDelivered;
      }
      return orderObj.save();
    })
    .then(orderObj =>
      orderOrchestrationHelper.update({
        orderId: orderObj._id,
        orderStatus: orderObj.orderStatus,
        actionTime: deliveryTime
      })
    );
};

orderService.prototype.searchOrdersAndProductsForMobile = function(event) {
  // const shipmentHelper = require('./shipment');
  const query = event.queryStringParameters.query;
  // console.log(query);
  const orderStatusToMatch = akUtils.getOrderStatus(query);
  const uId = (currentUserHandler.getCurrentUser() || {}).uuid;

  const orderSearchConditions = {
    orderStatus: {
      $nin: [orderStatusMap.Draft, orderStatusMap.Canceled]
    },
    $or: [
      {
        code: new RegExp(query, 'i')
      },
      {
        name: new RegExp(query, 'i')
      },
      {
        'consumer.firstName': new RegExp(query, 'i')
      },
      {
        'consumer.email': new RegExp(query, 'i')
      },
      {
        'consumer.lastName': new RegExp(query, 'i')
      },
      {
        'products.name': new RegExp(query, 'i')
      },
      {
        'products.code': new RegExp(query, 'i')
      },
      {
        'addresses.location.name': new RegExp(query, 'i')
      },
      {
        'addresses.location.code': new RegExp(query, 'i')
      },
      {
        attributes: {
          $elemMatch: {
            name: 'surgery',
            value: new RegExp(query, 'i')
          }
        }
      },
      {
        attributes: {
          $elemMatch: {
            name: 'surgeon',
            value: new RegExp(query, 'i')
          }
        }
      }
      // {
      //   'attributes': {
      //     $elemMatch: {
      //       name: 'patient',
      //       value: new RegExp(query, "i")
      //     }
      //   }
      // }
    ]
  };

  akUtils.log(orderStatusToMatch);
  akUtils.log(`+++${query}+++`);
  if (orderStatusToMatch) {
    orderSearchConditions.$or.push({
      orderStatus: orderStatusToMatch
    });
  }

  const orderSearchParams = {
    $and: []
  };
  for (const i in orderSearchConditions) {
    if (orderSearchConditions.hasOwnProperty(i)) {
      const paramObj = {};
      paramObj[i] = orderSearchConditions[i];
      orderSearchParams.$and.push(paramObj);
    }
  }
  orderSearchParams.$or = [{ 'consumer.id': uId }, { 'consumer.uuid': uId }];
  const productSearchConditions = {
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
    ]
  };
  akUtils.log(orderSearchParams.$and[0].orderStatus);
  akUtils.log(productSearchConditions);
  // return productTrackingModel.find(productLocationSearchParams).then((result) => {
  return bluebirdPromise
    .all([
      ordermodel.find(orderSearchConditions),
      productModel
        .aggregate()
        .lookup({
          from: 'producttrackings',
          localField: '_id',
          foreignField: 'product.id',
          as: 'currentLocation'
        })
        .lookup({
          from: 'orders',
          localField: '_id',
          foreignField: 'products.id',
          as: 'orders'
        })
        .match(productSearchConditions)
        .exec()
    ])
    .catch(akUtils.log)
    .then(result => {
      result = result.map(item => item || []);
      const casesResult = result[0];
      const productResult = result[1];
      return this.getUserFavourites(currentUserHandler.getCurrentUser().uuid)
        .then(favouriteList => {
          const list = [];
          for (const data of casesResult) {
            let formattedResponse = {};
            formattedResponse.id = data._id;
            formattedResponse.caseId = data.code;
            formattedResponse.attributes = data.attributes;

            formattedResponse.surgeryDate = data.etd;

            formattedResponse.type = 0;
            formattedResponse.caseStatus = data.orderStatus;
            formattedResponse = Object.assign(
              {},
              formattedResponse,
              data.addresses.reduce((result, address) => {
                result[address.addressType] = address.location.name;
                return result;
              }, {})
            );

            if (
              typeof formattedResponse.attributes !== 'undefined' &&
              formattedResponse.attributes !== null
            ) {
              formattedResponse = commonHelper.moveSystemAttributesToGlobal(
                formattedResponse,
                typemap
              );
            }
            formattedResponse.h1 = formattedResponse.surgeon || '';
            formattedResponse.h2 = '';
            formattedResponse.h3 = akUtils.convertDateToTimezone({
              dateToConvert: formattedResponse.surgeryDate || '',
              timeZone: (currentUserHandler.getCurrentUser() || {}).timezone,
              formatType: 'dt'
            });
            formattedResponse.l1 = formattedResponse.surgery || '';
            formattedResponse.l2 = formattedResponse.toAddress || '';
            formattedResponse.l3 = '';
            formattedResponse.l4 = akUtils.objectKeyByValue(orderStatusLabelMap, data.orderStatus);
            formattedResponse.isWatched =
              favouriteList.find(elem => String(elem.orderId) === String(data._id)) === undefined
                ? 0
                : 1;
            formattedResponse.isReported = 0;
            formattedResponse.isCaseAssociated = 0;
            formattedResponse.params = {
              caseId: formattedResponse.caseId,
              id: formattedResponse.id
            };
            delete formattedResponse.surgeon;
            delete formattedResponse.surgery;
            delete formattedResponse.toAddress;
            delete formattedResponse.attributes;
            delete formattedResponse.patient;
            delete formattedResponse.notes;
            list.push(formattedResponse);
          }

          return bluebirdPromise.map(list, element => {
            let condition = { 'products.orderDetails.id': mongoose.Types.ObjectId(element.id) };
            condition = clientHandler.addClientFilterToConditions(condition);
            return shipmentModel
              .find(condition)
              .then(sdatalist =>
                bluebirdPromise.map(sdatalist, sdata =>
                  shipmentTrackingModel
                    .findOne({
                      'shipment.id': mongoose.Types.ObjectId(sdata._id)
                    })
                    .sort({ lastTracked: -1 })
                    .then(data => {
                      if (data) {
                        sdata.tracking = data;
                      } else {
                        sdata.tracking = {};
                      }
                      return sdata;
                    })
                )
              )
              .then(shipment => {
                // shipment = shipment[0] || {}
                // process.exit(1)
                // formattedResponse.isReported = formattedResponse.isReported || shipment.issue ? 1 : 0;
                shipment.forEach(ship => {
                  element.isReported = element.isReported || ship.issue ? 1 : 0;
                  const currentLocationData = ship.tracking.currentLocation || {};
                  element.l3 = commonHelper.getCurrentLocationString(currentLocationData);
                });
                element.h2 = akUtils.convertDateToTimezone({
                  dateToConvert: Math.max.apply(null, shipment.map(item => item.etd)) || '' || '',
                  timeZone: (currentUserHandler.getCurrentUser() || {}).timezone,
                  formatType: 'dt'
                });
                return element;
              });
          });
        })
        .then(casesFormattedList =>
          this.getOrdersOfProducts(productResult).then(result => ({
            casesFormattedList,
            productResult: result
          }))
        )
        .then(({ casesFormattedList, productResult }) => {
          const list = [];
          for (const data of productResult) {
            data.order = data.order || {};
            let formattedResponse = {};
            formattedResponse.id = data._id;
            formattedResponse.attributes = data.attributes;
            formattedResponse.isCaseAssociated = (data.orders || []).length === 0 ? 0 : 1;
            formattedResponse.caseId = data.order._id || '';
            formattedResponse.surgeryDate = akUtils.convertDateToTimezone({
              dateToConvert: data.order.etd || '',
              timeZone: (currentUserHandler.getCurrentUser() || {}).timezone,
              formatType: 'dt'
            });
            formattedResponse.isReported = 0;
            formattedResponse.type = 1;
            formattedResponse.h1 = data.code;
            formattedResponse.h2 = data.name;
            formattedResponse.h3 = data.code;
            formattedResponse.l1 = `${(`${(data.order.consumer || {}).firstName || ''} ${(data.order
              .consumer || {}
            ).lastName}` || ''
            ).trim()}(${(data.order || {}).code})`;
            formattedResponse.l2 = (data.order.consumer || {}).mobileNo || '';
            const currentLocationData = ((data.currentLocation || [])[0] || {}).currentLocation;
            formattedResponse.l3 = commonHelper.getCurrentLocationString(currentLocationData);
            formattedResponse.l4 = 0;
            formattedResponse = commonHelper.moveSystemAttributesToGlobal(
              formattedResponse,
              typemap
            );
            formattedResponse.params = {
              caseId: formattedResponse.caseId,
              skuId: formattedResponse.id,
              caseNo: data.order.code,
              id: formattedResponse.id
            };
            delete formattedResponse.price;
            delete formattedResponse.orders;
            // delete formattedResponse.currentLocation;
            delete formattedResponse.url;
            delete formattedResponse.videoUrl;
            delete formattedResponse.description;
            delete formattedResponse.attributes;
            list.push(formattedResponse);
          }
          return [...casesFormattedList, ...list];
        });
    })
    .catch(akUtils.log);
  // });
};

orderService.prototype.addOrderOrchestrations = function(orderObj) {
  const statuses = Object.keys(orderStatusMap).map(key => orderStatusMap[key]);
  let done, actionTime;
  const promises = statuses.map(status => {
    if (status === orderObj.orderStatus) {
      done = 1;
      actionTime = new Date();
    } else {
      done = 0;
      actionTime = null;
    }
    return orderOrchestrationHelper.save({
      orderId: orderObj._id,
      orderStatus: status,
      done,
      actionTime
    });
  });

  return bluebirdPromise.all(promises);
};

orderService.prototype.getOrdersOfProducts = function(productData, unwind = true) {
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
        if (orderCount === 0) {
          let newData = {};
          newData.order = null;
          newData = Object.assign({}, newData, result[i]._doc || result[i]);
          unwindedData.push(newData);
        } else {
          for (let j = 0; j < orderCount; j++) {
            let newData = {};
            // newData = data;
            newData.order = orders[j];
            newData = Object.assign({}, newData, result[i]._doc || result[i]);
            unwindedData.push(newData);
          }
        }
      }
      return unwindedData;
    });
};

orderService.prototype.cancelOrder = function(orderId) {
  const itemStatusMap = require('../mappings/itemStatus.json');

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return bluebirdPromise.reject(['Invalid Order']);
  }
  const self = this;

  let condition = {
    _id: orderId
  };
  condition = clientHandler.addClientFilterToConditions(condition);

  let vOrderObj = null;
  return ordermodel
    .findOne(condition)
    .then(orderObj => {
      const orderUpdateObj = {};
      orderUpdateObj.products = orderObj.products.map(row => {
        row.deliveryStatus = itemStatusMap.Canceled;
        return row;
      });

      orderUpdateObj.orderStatus = orderStatusMap.Canceled;

      orderUpdateObj.canceledDate = new Date();

      orderUpdateObj.updatedOn = Date.now();
      orderUpdateObj.updatedBy = currentUserHandler.getCurrentUser();
      orderUpdateObj.client = clientHandler.getClient();

      const updateParams = {
        $set: orderUpdateObj,
        $inc: { __v: 1 }
      };
      return ordermodel
        .findOneAndUpdate({ _id: orderId }, updateParams, {
          upsert: false,
          new: true
        })
        .exec();
    })
    .then(orderObj => {
      vOrderObj = orderObj;
      const promises = vOrderObj.products.map(row =>
        self.setItemOrchestration(row.id, itemStatusMap.Canceled, 'order', orderId)
      );
      return bluebirdPromise.all(promises);
    })
    .then(() =>
      orderOrchestrationHelper.update({
        orderId: vOrderObj._id,
        orderStatus: orderStatusMap.Canceled,
        actionTime: new Date()
      })
    )
    .then(() => {
      // TODO Impacts on shipment
      // cancel order shipments if applicable
      let shipCondition = { 'products.orderDetails.id': mongoose.Types.ObjectId(orderId) };
      shipCondition = clientHandler.addClientFilterToConditions(shipCondition);
      return shipmentModel
        .find(shipCondition)
        .then(sdatalist => bluebirdPromise.map(sdatalist, sdata => sdata._id))
        .then(shipments => {
          const cancelShipPromises = [];
          shipments.forEach(shipId => {
            cancelShipPromises.push(shipmentHelper.cancelOrderShipment(shipId, orderId));
          });
          return bluebirdPromise.all(cancelShipPromises);
        })
        .then(() => bluebirdPromise.resolve());
    });
};

/**
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
orderService.prototype.validateCancel = function(orderId) {
  const errors = [];
  let conditions = {};
  conditions = { _id: mongoose.Types.ObjectId(orderId) };
  return ordermodel
    .findOne(conditions)
    .exec()
    .then(orderObj => {
      // if found
      if (orderObj.orderStatus === orderStatusMap.Canceled) {
        errors.push({ code: 2641, message: 'Order is already cancelled.' });
      }

      if (errors.length === 0) {
        return bluebirdPromise.resolve();
      }
      return bluebirdPromise.reject(errors);
    })
    .catch(() => {
      // case when order not found or some error occurred
      if (errors.length === 0) {
        return bluebirdPromise.reject({ code: 2642, message: 'Invalid order.' });
      }
      return bluebirdPromise.reject(errors);
    });
};

/**
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
orderService.prototype.getShipmentsForOrder = function(orderId) {
  let conditions = {};
  conditions = { 'products.orderDetails.id': mongoose.Types.ObjectId(orderId) };
  conditions = clientHandler.addClientFilterToConditions(conditions);

  return shipmentModel
    .find(conditions)
    .exec()
    .then(shipments => {
      // if found
      if ((shipments || []).length === 0) {
        return [];
      }
      return shipments.map(ship => ({
        shipmentId: ship._id,
        shipmentNo: ship.code,
        isReported: (ship.issue || '') !== '',
        shipStatus: ship.shipmentStatus,
        issueId: ship.issue || '',
        products: ship.products || ''
      }));
    })
    .catch(() =>
      // case when order not found or some error occurred
      bluebirdPromise.resolve([])
    );
};

orderService.prototype.internalShipment = function internalShipment({ order }) {
  akUtils.log('-------------Internal Shipment--------------');
  const orderObj = commonHelper.deepCloneObject(order);
  orderObj.id = orderObj._id;
  let orderProducts = orderObj.products;

  const toAddress = orderObj.addresses.reduce((a, b) => {
    a[b.addressType] = b.location;
    return a;
  }, {}).toAddress;

  return productTrackingModel
    .find({ 'product.id': { $in: orderProducts.map(item => item.id) } })
    .exec()
    .then(products => {
      const sameLoc = products
        .filter(product => `${product.currentLocation.id}` === `${toAddress.id}`)
        .map(product => {
          const temp = orderProducts.filter(p => `${p.id}` === `${product.product.id}`)[0];
          akUtils.log('+++++++location of products++++++');
          akUtils.log(temp.currentLocation);
          temp.deliveryStatus = itemStatusArr.Delivered;
          temp.orderDetails = orderObj;
          return temp;
        });
      akUtils.log('+++++++Products with same location++++++');
      akUtils.log(sameLoc);
      akUtils.log('+++++++To Location of order++++++');
      akUtils.log(toAddress);
      const sameLocProdIdlist = sameLoc.map(item => item.id);

      orderProducts = orderProducts.map(product => {
        if (sameLocProdIdlist.indexOf(product.id) > -1) {
          product.deliveryStatus = itemStatusArr.Delivered;
        }
        return product;
      });
      if (sameLoc.length === 0) {
        return order;
      }
      const shipment = {
        body: {
          code: `internal_shipping_${orderObj.code}`,
          status: 1,
          etd: `${new Date()}`,
          addresses: [
            {
              addressType: 'shipFromAddress',
              location: toAddress
            },
            {
              addressType: 'shipToAddress',
              location: toAddress
            }
          ],
          products: sameLoc
        }
      };
      akUtils.log('+++++++Event for internal shipment creation++++++');
      akUtils.log(shipment);
      return shipmentHelper
        .save(shipment, true)
        .then(shipment => {
          akUtils.log('shipment');
          akUtils.log(shipment);
          const deliveredProducts = orderProducts.filter(
            item => item.deliveryStatus === itemStatusArr.Delivered
          );

          if (deliveredProducts.length === orderProducts.length) {
            order.orderStatus = orderStatusMap.Delivered;
          } else if (deliveredProducts.length > 0) {
            order.orderStatus = orderStatusMap.PartialDelivered;
          }

          return order
            .save()
            .then(updatedOrder =>
              orderOrchestrationHelper
                .update({
                  orderId: updatedOrder._id,
                  orderStatus: updatedOrder.orderStatus,
                  actionTime: new Date()
                })
                .then(() => updatedOrder)
            )
            .then(updatedOrder =>
              shipmentHelper
                .deliveryReport(shipment)
                .then(res => {
                  if (typeof res.Payload !== typeof {} && res.Payload !== '') {
                    res.Payload = JSON.parse(res.Payload || {});
                  }
                  shipment.deliveryDetails.pdfUrl = res.Payload.url || '';
                  return shipment.save().then(() => updatedOrder);
                })
                .catch(err => {
                  akUtils.log('++++ DELIVERY REPORT FAIL++++');
                  akUtils.log(err);
                  return shipment;
                })
            );
        })
        .then(updatedOrder => {
          // save order product orchestration here
          const promises = updatedOrder.products
            .filter(item => item.deliveryStatus === itemStatusArr.Delivered)
            .map(row =>
              shipmentHelper.setItemOrchestration(
                row.id,
                itemStatusArr.Delivered,
                'order',
                updatedOrder._id
              )
            );
          return bluebirdPromise.all(promises).then(() => bluebirdPromise.resolve(updatedOrder));
        });
    });
};

orderService.prototype.setItemOrchestration = function(
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
      actionTime: new Date()
    });
  }
  return false;
};

/**
 * 
 * @param {Object} event Lambda Event
 * @return {Promise} Resolved promise with populated event if successful. Rejected promise with validation errors otherwise.
 * 
 */
orderService.prototype.validateClose = function(orderId) {
  const errors = [];
  let conditions = {};
  conditions = { _id: mongoose.Types.ObjectId(orderId) };
  return ordermodel
    .findOne(conditions)
    .exec()
    .then(orderObj => {
      // if found
      if (orderObj.orderStatus === orderStatusMap.Closed) {
        errors.push({ code: 2651, message: 'Order is already closed.' });
      }

      if (errors.length === 0) {
        return bluebirdPromise.resolve();
      }
      return bluebirdPromise.reject(errors);
    })
    .catch(() => {
      // case when order not found or some error occurred
      if (errors.length === 0) {
        return bluebirdPromise.reject({ code: 2642, message: 'Invalid order.' });
      }
      return bluebirdPromise.reject(errors);
    });
};

orderService.prototype.closeOrder = function(orderId) {
  const itemStatusMap = require('../mappings/itemStatus.json');
  const self = this;
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return bluebirdPromise.reject(['Invalid Order']);
  }

  let condition = {
    _id: orderId
  };
  condition = clientHandler.addClientFilterToConditions(condition);

  let vOrderObj = null;
  return ordermodel
    .findOne(condition)
    .then(orderObj => {
      const orderUpdateObj = {};
      orderUpdateObj.products = orderObj.products.map(row => {
        row.deliveryStatus = itemStatusMap.Closed;
        return row;
      });

      orderUpdateObj.orderStatus = orderStatusMap.Closed;

      orderUpdateObj.updatedOn = Date.now();
      orderUpdateObj.updatedBy = currentUserHandler.getCurrentUser();
      orderUpdateObj.client = clientHandler.getClient();

      const updateParams = {
        $set: orderUpdateObj,
        $inc: { __v: 1 }
      };
      return ordermodel
        .findOneAndUpdate({ _id: orderId }, updateParams, {
          upsert: false,
          new: true
        })
        .exec();
    })
    .then(orderObj => {
      vOrderObj = orderObj;
      const promises = vOrderObj.products.map(row =>
        self.setItemOrchestration(row.id, itemStatusMap.Closed, 'order', orderId)
      );
      return bluebirdPromise.all(promises);
    })
    .then(() =>
      orderOrchestrationHelper.update({
        orderId: vOrderObj._id,
        orderStatus: orderStatusMap.Closed,
        actionTime: new Date()
      })
    )
    .then(() => {
      // TODO Impacts on shipment
      // close order shipments if applicable
      const shipHelper = require('./shipment');
      let shipCondition = { 'products.orderDetails.id': mongoose.Types.ObjectId(orderId) };
      shipCondition = clientHandler.addClientFilterToConditions(shipCondition);
      return shipmentModel
        .find(shipCondition)
        .then(sdatalist => bluebirdPromise.map(sdatalist, sdata => sdata._id))
        .then(shipments => {
          const closeShipPromises = [];
          shipments.forEach(shipId => {
            closeShipPromises.push(shipHelper.closeOrderShipment(shipId, orderId));
          });
          return bluebirdPromise.all(closeShipPromises);
        })
        .then(() => bluebirdPromise.resolve());
    });
};

module.exports = new orderService();
