const orderOrchestrationHelper = require('./../../helpers/orderOrchestration');
const shipmentOrchestrationHelper = require('./../../helpers/shipmentOrchestration');
const itemOrchestrationHelper = require('./../../helpers/itemOrchestration');
const shipmentmodel = require('./../../models/shipment');
const shipmenthelper = require('./../../helpers/shipment');
const orderhelper = require('./../../helpers/order');
const ordermodel = require('./../../models/order');
const shipmentTrackingModel = require('./../../models/shipmentTracking');
const bluebirdPromise = require('bluebird');
const notificationLib = require('./../../lib/notification');
const shipmentStatusMapping = require('./../../mappings/shipmentStatus.json');
const orderStatusMapping = require('./../../mappings/orderStatus.json');
const itemStatusMapping = require('./../../mappings/itemStatus.json');
const productsmodel = require('./../../models/product');
const locationmodel = require('./../../models/location');
const akUtils = require('./../../lib/utility');
const shipmentTrackingService = require('./shipmentTracking');
const commonTrackingService = require('./common.js');
var shipmentStatusTrackingService = function () {
  
};

/**
 * Get Shipment information from tracking data
 * 
 * @param {Object} pointData
 * @return {Promise} Promise to represent the shipment for tracking data
 * 
 */
shipmentStatusTrackingService.prototype.getShipmentData = function (pointData) {
  
  
    // ASSUMED STATUS 2 : Scheduled, 3 : SoftShipped, 4 : Shipped, 5 : SoftDelivered 
    // Filter TODO : Current TS must be greater than schduled TS
    // Filter TODO : last location must be different than current location OR last lat/lon must be different than current lat/lon
    
    let conditions = {
        'products' : { '$elemMatch' : { 'things' : { '$elemMatch' : {  'code' :  pointData.sensors.code } } } },
        'shipmentStatus' : { '$in' : [ shipmentStatusMapping.Scheduled, shipmentStatusMapping.PartialShipped, shipmentStatusMapping.SoftShipped, shipmentStatusMapping.Shipped, shipmentStatusMapping.PartialDelivered, shipmentStatusMapping.SoftDelivered ] }
    };
    
    const clientHandler = require('./../../lib/clientHandler');
    clientHandler.setClient({ clientId: pointData.clientid, projectId: pointData.projectid });
    conditions = clientHandler.addClientFilterToConditions(conditions);
    
    //akUtils.log(pointData.sensors);
    //akUtils.log(pointData.sensors.code);
    //akUtils.log(conditions);
    return shipmentmodel.find(conditions).then((results) => {
        if(results === null || results.length === 0) {
            akUtils.log('Not trackable shipment found .');
            return [];
        }
        akUtils.log('Trackable shipment found .');
        let shipments = [];
        
        results.forEach((row) => {
            shipments.push({
                '_id' : row._id,
                'code' : row.code,
                'name' : row.name,
                'shipmentStatus' : row.shipmentStatus
            });
        });
        
        return shipments;
    });
};

/**
 * Save Shipment shipped status 
 * 
 * @param {Object} shipmentId shipment Id
 * @param {Object} pointData Tracking Data
 * @return {Promise} Promise after saving
 * 
 */
shipmentStatusTrackingService.prototype.saveShipmentShipStatus = function (shipmentId, pointData) {
  let self = this;
  return commonTrackingService.getSettings().then( (settings) => {
    self.settings = settings;
    // akUtils.log(self.settings);
    // throw new Error();
    
    if(typeof shipmentId === 'undefined') {
      akUtils.log('Invalid shipment id.');
      return {};
    }
    
    return shipmentTrackingModel.findOne({'shipment.id' : shipmentId}).then((shipmentTrackingObj) => {
      akUtils.log(shipmentId);
      //akUtils.log(shipmentTrackingObj.lastTracked.getTime() + '   ' +  new Date(pointData.ts).getTime());
      if(shipmentTrackingObj === null || shipmentTrackingObj.lastTracked.getTime() < new Date(pointData.ts).getTime()) {
        akUtils.log('IN SHIP TIME OK');
        return productsmodel.findOne({
          'things' : { '$elemMatch' : { 'code' : pointData.sensors.code } } 
        }).then((productObj) => {
          if(productObj === null) {
            akUtils.log('No product found.');
            return ;
          }
          
          return shipmentmodel.findOne({
            '_id' : shipmentId
          }).then((shipmentObj) => {
            if(shipmentObj === null) {
              akUtils.log('No valid shipment attached.');
              return;
            }
            if(shipmentObj.shipmentStatus === shipmentStatusMapping.Scheduled || shipmentObj.shipmentStatus === shipmentStatusMapping.PartialShipped || shipmentObj.shipmentStatus === shipmentStatusMapping.SoftShipped || shipmentObj.shipmentStatus === shipmentStatusMapping.Shipped) {
              let shipAddress = {};
              shipmentObj.addresses.forEach( (row) => {
                  if(row.addressType === 'shipFromAddress') {
                      shipAddress = row.location;
                  }
              });
              
              //akUtils.log(pointData.location.coordinates);
              //pointData.location.coordinates = [77.9732121,28.9252825];
              return locationmodel.findOne({
                '_id' : shipAddress.id,
                'perimeter' : { '$geoIntersects':
                  { '$geometry':{ 
                     'type' : 'Point',
                     'coordinates' : [ pointData.location.coordinates[0], pointData.location.coordinates[1] ] }
                  }
                },
              }).then((locationObj) => {
                // Shipment is outside of perimiter
                if(locationObj === null) {
                  akUtils.log("IN LOCATION CHECK")
                  akUtils.log(shipmentId);
                  return self.updateShipmentShipTracking(shipmentId, productObj._id, pointData);
                } else {
                  return false;
                }
              });
            } else {
              return false;
            }
          });
        });
      } else {
        akUtils.log('IN SHIP TIME NOT OK');
        return false;
      }
    });
  });
};

/**
 * Save Shipment ship status 
 * 
 * @param {String} shipmentId shipment id
 * @param {String} productId product id
 * @return {Promise} Promise after saving
 * 
 */
shipmentStatusTrackingService.prototype.updateShipmentShipTracking = function (shipmentId, productId, pointData) {
  akUtils.log('in shipment ship tracking')
  
  
  const shipDate = new Date(Number(pointData.ts));
  let self = this;
  let itemStatus = null;
  let itemOrderObj = null;
  let oldStatus = null
  return shipmentmodel.findOne({
    '_id' : shipmentId
  }).then( (shipmentObj) => {
    if(shipmentObj === null) {
      return null;
    }

    // Save Shipment items soft shipped 
    shipmentObj.products = shipmentObj.products.map((row) => {
      if(row.id.toString() === productId.toString() && row.deliveryStatus === itemStatusMapping.Scheduled ) {
        if(self.settings.isAutoShipMode === true) {
          row.deliveryStatus = itemStatusMapping.Shipped;
        } else {
          row.deliveryStatus = itemStatusMapping.SoftShipped;
        }
        itemStatus = row.deliveryStatus;
        itemOrderObj = row.orderDetails;
        return row;
      } else {
        return row;
      }
    });
    oldStatus = shipmentObj.shipmentStatus;
    // Save Shipment soft shipped 
    if( shipmentObj.shipmentStatus === shipmentStatusMapping.Scheduled || shipmentObj.shipmentStatus === shipmentStatusMapping.PartialShipped ) {
      let sproducts = shipmentObj.products.filter((row) => {
        if(row.deliveryStatus === itemStatusMapping.SoftShipped || row.deliveryStatus === itemStatusMapping.Shipped ) {
          return row;
        }
      });
      akUtils.log('SHIP LEN CHECK');
      if(sproducts.length === shipmentObj.products.length) {
        shipmentObj.shipmentStatus = shipmentStatusMapping.SoftShipped;
      } else {
        // Only if auto shipped if off, Set partial shipped here 
        // other wise from common shipment shipped method 
        if(self.settings.isAutoShipMode !== true) {
          shipmentObj.shipmentStatus = shipmentStatusMapping.PartialShipped;
        }
      }
      
      shipmentObj.shipDate = shipDate;
      return shipmentObj.save();
    } else {
      return null;
    }
  }).then( (shipmentObj) => {
    if(shipmentObj !== null) {
      return bluebirdPromise.all([
        self.setOrderShipTracking(itemOrderObj, shipmentObj, productId, shipDate),
        self.setItemOrchestration(productId, itemStatus, 'shipment', shipmentObj._id, shipDate),
        self.setShipmentOrchestration(shipmentObj._id, shipmentObj.shipmentStatus, shipDate),
        self.setShipmentShipped(shipmentObj._id, shipDate),
      ]).then(() => {
          return self.sendSoftShipNotification(shipmentObj, oldStatus);
      });
    }
  });
};


/**
 * Send soft/partial notification if auto shipment is not enabled
 *
 * @param {Object} orderId order Id
 * @param {Object} shipmentObj shipment Object
 * @param {Object} productId product Id
 * @return {Promise} Promise after saving
 * 
 */
shipmentStatusTrackingService.prototype.sendSoftShipNotification = function(shipmentObj, oldStatus) {
  if (this.settings.isAutoShipMode !== true && oldStatus !== null && shipmentObj.shipmentStatus !== oldStatus) {
    if (shipmentObj.shipmentStatus === shipmentStatusMapping.SoftShipped) {
      return notificationLib.sendShipmentSoftShippedNotification(shipmentObj._id);
    } else if (shipmentObj.shipmentStatus === shipmentStatusMapping.PartialShipped) {
      return notificationLib.sendShipmentPartialShippedNotification(shipmentObj._id);
    } else {
        return shipmentObj;
    }
  } else {
    return shipmentObj;
  }
};

/**
 * Save order ship status 
 *
 * @param {Object} orderId order Id
 * @param {Object} shipmentObj shipment Object
 * @param {Object} productId product Id
 * @return {Promise} Promise after saving
 * 
 */
shipmentStatusTrackingService.prototype.setItemOrchestration = function(productId, itemStatus, parentType, parentId, actionTime) {
  if(itemStatus !== null) {
    return itemOrchestrationHelper.save({'itemId':productId,'itemStatus':itemStatus,'parentType':parentType,'parentId':parentId,'actionTime': actionTime});
  } else {
    return false;
  }
};

/**
 * Save order ship status 
 *
 * @param {Object} orderId order Id
 * @param {Object} shipmentObj shipment Object
 * @param {Object} productId product Id
 * @return {Promise} Promise after saving
 * 
 */
shipmentStatusTrackingService.prototype.setShipmentOrchestration = function(shipmentId, shipmentStatus, actionTime) {
  if(shipmentStatus !== null) {
    return shipmentOrchestrationHelper.update({'shipmentId':shipmentId,'shipmentStatus':shipmentStatus,'actionTime':actionTime});
  } else {
    return false;
  }
};

/**
 * Save order ship status 
 *
 * @param {Object} orderId order Id
 * @param {Object} shipmentObj shipment Object
 * @param {Object} productId product Id
 * @return {Promise} Promise after saving
 * 
 */
shipmentStatusTrackingService.prototype.setShipmentShipped = function(shipmentId, shipTime) {
  if(this.settings.isAutoShipMode === true) {
    return shipmenthelper.setShipmentShipped(shipmentId, shipTime);
  } else {
    return true;
  } 
};
/**
 * Save order ship status 
 *
 * @param {Object} orderId order Id
 * @param {Object} shipmentObj shipment Object
 * @param {Object} productId product Id
 * @return {Promise} Promise after saving
 * 
 */
shipmentStatusTrackingService.prototype.setOrderShipTracking = function(itemOrderObj, shipmentObj, productId, shipTime) {
  let self = this;
  if(itemOrderObj !== null) {
    let orderId = itemOrderObj.id;
    
    let itemStatus = null;
    return ordermodel.findOne({
      '_id' : orderId
    }).then( (orderObj) => {
      if(orderObj.orderStatus === orderStatusMapping.Open || orderObj.orderStatus === orderStatusMapping.PartialShipped ) {
        orderObj.products = orderObj.products.map((row) => {
          if(row.id.toString() === productId.toString() && row.deliveryStatus === itemStatusMapping.Scheduled ) {
            if(self.settings.isAutoShipMode === true) {
              row.deliveryStatus = itemStatusMapping.Shipped;
            } else {
              row.deliveryStatus = itemStatusMapping.SoftShipped;
            }
            itemStatus = row.deliveryStatus;
            //akUtils.log('Order Product deliveryStatus');
            //akUtils.log(row.deliveryStatus);
              
            return row;
          } else {
            return row;
          }
          
          
        });
        
        return orderObj.save();
      } else {
        return orderObj;
      }
      
    }).then( (orderObj) => {  
      return bluebirdPromise.join(
          self.setItemOrchestration(productId, itemStatus, 'order', orderObj._id, shipTime),
          orderhelper.setOrderShipped(orderObj._id, shipTime),
          (res1, res2) => {
            // akUtils.log('IIIIIIIII')
          }
      );
      
    });
  } else {
    return false;
  }
};

/**
 * Save order ship status 
 *
 * @param {Object} orderId order Id
 * @param {Object} shipmentObj shipment Object
 * @param {Object} productId product Id
 * @return {Promise} Promise after saving
 * 
 */
shipmentStatusTrackingService.prototype.setOrderOrchestration = function(orderId, orderStatus, actionTime) {
  if(orderStatus !== null) {
    return orderOrchestrationHelper.save({'orderId':orderId,'orderStatus':orderStatus,'actionTime':actionTime});
  } else {
    return false;
  }
};

/**
 * Save Shipment deliver status 
 * 
 * @param {Object} shipmentId shipment Id
 * @param {Object} pointData Tracking Data
 * @return {Promise} Promise after saving
 * 
 */
shipmentStatusTrackingService.prototype.saveShipmentDeliverStatus = function (shipmentId, pointData) {
  let self = this;
  
  return commonTrackingService.getSettings().then( (settings) => {
    self.settings = settings;
    
    if(typeof shipmentId === 'undefined') {
      akUtils.log('Invalid shipment id.');
      return {};
    }
    akUtils.log('IN DELIVER STATUS');
    return shipmentTrackingModel.findOne({'shipment.id' : shipmentId}).then((shipmentTrackingObj) => {
      akUtils.log(shipmentTrackingObj);
      if(shipmentTrackingObj === null || shipmentTrackingObj.lastTracked.getTime() < new Date(pointData.ts).getTime()) {
        akUtils.log('IN DELIVER TIME OK');
        return productsmodel.findOne({
          'things' : { '$elemMatch' : { 'code' : pointData.sensors.code } } 
        }).then((productObj) => {
          if(productObj === null) {
            akUtils.log('No product found.');
            return ;
          }
          
          return shipmentmodel.findOne({
            '_id' : shipmentId
          }).then((shipmentObj) => {
            if(shipmentObj === null) {
              akUtils.log('No valid shipment attached.');
              return;
            }
            if(shipmentObj.shipmentStatus === shipmentStatusMapping.PartialDelivered || shipmentObj.shipmentStatus === shipmentStatusMapping.SoftShipped || shipmentObj.shipmentStatus === shipmentStatusMapping.PartialShipped || shipmentObj.shipmentStatus === shipmentStatusMapping.Shipped) {
              let deliverAddress = {};
              shipmentObj.addresses.forEach( (row) => {
                  if(row.addressType === 'shipToAddress') {
                      deliverAddress = row.location;
                  }
              });
              //akUtils.log(pointData.location.coordinates);
              //pointData.location.coordinates = [77.42589990,28.612580];
              return locationmodel.findOne({
                '_id' : deliverAddress.id,
                'perimeter' : { '$geoIntersects':
                  { '$geometry':{ 
                     'type' : 'Point',
                     'coordinates' : [ pointData.location.coordinates[0], pointData.location.coordinates[1] ] }
                  }
                },
              }).then((locationObj) => {
                
                //akUtils.log(locationObj);
                // Shipment is outside of perimiter
                if(locationObj !== null) {
                  return self.updateShipmentDeliverTracking(shipmentId, productObj._id, pointData)
                } else {
                  return false;
                }
              });
            } else {
              return false;
            }
          });
        });
      } else {
        akUtils.log('IN DELIVER TIME NOT OK');
        return false;
      }
    });
  });
};

/**
 * Save Shipment Deliver status 
 * 
 * @param {String} shipmentId shipment id
 * @param {String} productId product id
 * @return {Promise} Promise after saving
 * 
 */
shipmentStatusTrackingService.prototype.updateShipmentDeliverTracking = function (shipmentId, productId, pointData) {
  
  // console.log(this.settings)
  let self = this;
  let itemStatus = null;
  let itemOrderObj = null;
  let oldStatus = null;
  const deliveryDate = new Date(Number(pointData.ts));
  return shipmentmodel.findOne({
    '_id' : shipmentId
  }).then( (shipmentObj) => {
    if(shipmentObj === null) {
      return null;
    }
    
    oldStatus = shipmentObj.shipmentStatus;
    shipmentObj.products = shipmentObj.products.map((row) => {
      if(row.id.toString() === productId.toString() && ( row.deliveryStatus === itemStatusMapping.SoftShipped || row.deliveryStatus === itemStatusMapping.Shipped )) {
        if(self.settings.isAutoDeliveryMode === true) {
          row.deliveryStatus = itemStatusMapping.Delivered;
        } else {
          row.deliveryStatus = itemStatusMapping.SoftDelivered;
        }
        itemStatus = row.deliveryStatus; 
        itemOrderObj = row.orderDetails;
        return row;
      } else {
        return row;
      }
    });
    if(shipmentObj.shipmentStatus === shipmentStatusMapping.SoftShipped || 
      shipmentObj.shipmentStatus === shipmentStatusMapping.PartialShipped || 
      shipmentObj.shipmentStatus === shipmentStatusMapping.Shipped || 
      shipmentObj.shipmentStatus === shipmentStatusMapping.PartialDelivered ) {
      let sproducts = shipmentObj.products.filter((row) => {
        
        if(row.deliveryStatus === itemStatusMapping.SoftDelivered || row.deliveryStatus === itemStatusMapping.Delivered ) {
          return row;
        }
      });
      
      if(sproducts.length === shipmentObj.products.length) {
        shipmentObj.shipmentStatus = shipmentStatusMapping.SoftDelivered;
      } else {
        // Only if auto delivered if off, Set partial delivred here 
        // other wise from common shipment deliver method 
        if(self.settings.isAutoDeliveryMode !== true) {
          shipmentObj.shipmentStatus = shipmentStatusMapping.PartialDelivered;
        }
      }
      shipmentObj.deliveryDate = deliveryDate;
      return shipmentObj.save();
    } else {
      return null;
    }
  }).then( (shipmentObj) => {
    if(shipmentObj !== null) {
      return bluebirdPromise.all([
        self.setOrderDeliverTracking(itemOrderObj, shipmentObj, productId, deliveryDate),
        self.setItemOrchestration(productId, itemStatus, 'shipment', shipmentObj._id, deliveryDate),
        self.setShipmentOrchestration(shipmentObj._id, shipmentObj.shipmentStatus, deliveryDate),
        self.setShipmentDelivered(shipmentObj._id, deliveryDate),
      ]).then(() => {
        return bluebirdPromise.all([
          self.sendSoftDeliverNotification(shipmentObj, oldStatus),
          self.saveShipmentLocation(shipmentObj, pointData)
        ]);
      });
    }
  });
};

shipmentStatusTrackingService.prototype.saveShipmentLocation = function(shipmentObj, pointData) {
  const shipmentStatusLabel = require('./../../mappings/shipmentStatusLabel.json');
  if (shipmentObj.shipmentStatus === shipmentStatusMapping.SoftDelivered) {
    return commonTrackingService.getLocationInformation(pointData).then((currentLocation) => {
      return bluebirdPromise.join(
        shipmentTrackingService.updateShipmentLocation(shipmentObj, pointData, currentLocation),
        commonTrackingService.updateTrackingLocation('shipment', { 
          id: shipmentObj._id, 
          code: shipmentObj.code, 
          name: shipmentObj.name 
        }, pointData, currentLocation),
        commonTrackingService.pushToIot('shipment', { 
          id: shipmentObj._id, 
          code: shipmentObj.code, 
          name: shipmentObj.name, 
          status: shipmentObj.shipmentStatus, 
          statusLabel: akUtils.objectKeyByValue(shipmentStatusLabel, shipmentObj.shipmentStatus) }, 
          pointData, 
          currentLocation, 
          process.env.shipmentTrackingIotTopic
        ),
        (shipmentResults, trackingResults, iotResults) => {
          
        }
      );
      // return shipmentTrackingService.saveShipmentTracking(pointData, currentLocation);
    });
  } else {
    return true;
  }
  
};

/**
 * Send soft/partial notification if auto shipment is not enabled
 *
 * @param {Object} orderId order Id
 * @param {Object} shipmentObj shipment Object
 * @param {Object} productId product Id
 * @return {Promise} Promise after saving
 * 
 */
shipmentStatusTrackingService.prototype.sendSoftDeliverNotification = function(shipmentObj, oldStatus) {
  
  if (this.settings.isAutoDeliveryMode !== true && oldStatus !== null && shipmentObj.shipmentStatus !== oldStatus) {
    if (shipmentObj.shipmentStatus === shipmentStatusMapping.SoftDelivered) {
      return notificationLib.sendShipmentSoftDeliveredNotification(shipmentObj._id);
    } else if (shipmentObj.shipmentStatus === shipmentStatusMapping.PartialDelivered) {
      return notificationLib.sendShipmentPartialDeliveredNotification(shipmentObj._id);
    } else {
        return shipmentObj;
    }
  } else {
    return shipmentObj;
  }
};


/**
 * Save order ship status 
 *
 * @param {Object} orderId order Id
 * @param {Object} shipmentObj shipment Object
 * @param {Object} productId product Id
 * @return {Promise} Promise after saving
 * 
 */
shipmentStatusTrackingService.prototype.setShipmentDelivered = function(shipmentId, deliveryTime) {
  if(this.settings.isAutoDeliveryMode === true) {
    return shipmenthelper.setShipmentDelivered(shipmentId, deliveryTime, {
      'images' : [ ],
      'recipientFirstName' : 'System',
      'recipientLastName' : 'Shipment',
      'recipientMobileCode' : '',
      'recipientMobileNumber' : ''
    }, false);
  } else {
    return true;
  } 
};
/**
 * Save order ship status 
 *
 * @param {Object} orderId order Id
 * @param {Object} shipmentObj shipment Object
 * @param {Object} productId product Id
 * @return {Promise} Promise after saving
 * 
 */
shipmentStatusTrackingService.prototype.setOrderDeliverTracking = function(itemOrderObj, shipmentObj, productId, deliveryTime) {
  let self = this;
  if(itemOrderObj !== null) {
    let itemStatus = null;
    let orderId = itemOrderObj.id;
    
    return ordermodel.findOne({
      '_id' : orderId
    }).then( (orderObj) => {
      if( orderObj.orderStatus === orderStatusMapping.PartialShipped || orderObj.orderStatus === orderStatusMapping.Shipped || orderObj.orderStatus === orderStatusMapping.PartialDelivered ) {
        
        orderObj.products = orderObj.products.map((row) => {
          if(row.id.toString() === productId.toString() && row.deliveryStatus === itemStatusMapping.Shipped ) {
            if(self.settings.isAutoDeliveryMode === true) {
              row.deliveryStatus = itemStatusMapping.Delivered;
            } else {
              row.deliveryStatus = itemStatusMapping.SoftDelivered;
            }
            itemStatus = row.deliveryStatus;
            return row;
          } else {
            return row;
          }
        });
        
        return orderObj.save();
      } else {
        return orderObj;
      }
    }).then( (orderObj) => {
      //return orderhelper.setOrderDelivered(orderObj._id);
      return bluebirdPromise.join(
          self.setItemOrchestration(productId, itemStatus, 'order', orderObj._id, deliveryTime),
          orderhelper.setOrderDelivered(orderObj._id, deliveryTime)
      );
    });
  } else {
    return false;
  }
};

module.exports = new shipmentStatusTrackingService();
