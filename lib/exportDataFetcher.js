const akUtils = require('./utility');
const shipStatusLabelMap = require('../mappings/shipmentStatusLabel.json');
const orderStatusLabelMap = require('../mappings/orderStatusLabel.json');

const entities = {
  attributes: {
    type: 'master',
    helperName: 'attribute',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        Name: element.name || '',
        Code: element.code || '',
        'Active?': element.status === 1 ? 'Yes' : 'No',
        'Last Modified': akUtils.convertDateToTimezone({
          dateToConvert: element.updatedOn,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        })
      };
    }
  },
  beacons: {
    type: 'master',
    helperName: 'things',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        Name: element.name || '',
        Code: element.code || '',
        UUID: element.uuid || '',
        Major: element.major || '',
        Minor: element.minor || '',
        'Last Connection': akUtils.convertDateToTimezone({
          dateToConvert: element.last_connection,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'Updated On': akUtils.convertDateToTimezone({
          dateToConvert: element.updatedOn,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        })
      };
    }
  },
  categories: {
    type: 'master',
    helperName: 'category',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        Name: element.name || '',
        Code: element.code || '',
        Parent: ((element.ancestors || [])[0] || {}).name || '',
        'Active?': element.status === 1 ? 'Yes' : 'No',
        'Last Modified': akUtils.convertDateToTimezone({
          dateToConvert: element.updatedOn,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        })
      };
    }
  },
  collections: {
    type: 'master',
    helperName: 'collection',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        Name: element.name || '',
        Code: element.code || '',
        Parent: ((element.ancestors || [])[0] || {}).name || '',
        'Collection Type': element.type || '',
        'Active?': element.status === 1 ? 'Yes' : 'No',
        'Last Modified': akUtils.convertDateToTimezone({
          dateToConvert: element.updatedOn,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        })
      };
    }
  },
  devices: {
    type: 'master',
    helperName: 'device',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        Name: element.name || '',
        Code: element.code || '',
        OS: element.os || '',
        'App Name': element.appName || '',
        'App Version': element.appVersion || '',
        Manufacturer: element.manufacturer || '',
        Model: element.model || '',
        'Updated On': akUtils.convertDateToTimezone({
          dateToConvert: element.updatedOn,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        })
      };
    }
  },
  floors: {
    type: 'master',
    helperName: 'core/floor',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        Name: element.name || '',
        Code: element.code || '',
        Location: ((element.ancestors || [])[0] || {}).name || '',
        'Active?': element.status === 1 ? 'Yes' : 'No',
        'Last Modified': akUtils.convertDateToTimezone({
          dateToConvert: element.updatedOn,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        })
      };
    }
  },
  gateways: {
    type: 'master',
    helperName: 'gateways',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        Name: element.name || '',
        Code: element.code || '',
        UUID: element.uuid || '',
        'Active?': element.status === 1 ? 'Yes' : 'No',
        'Last Modified': akUtils.convertDateToTimezone({
          dateToConvert: element.updatedOn,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        })
      };
    }
  },
  locations: {
    type: 'master',
    helperName: 'core/location',
    mappingFn(element, timezone, dateTimeFormat) {
      const addressArray = [];
      if (element.address) {
        addressArray.push(element.address);
      }
      if (element.city) {
        addressArray.push(element.city);
      }
      if (element.state) {
        addressArray.push(element.state);
      }
      if (element.country) {
        addressArray.push(element.country);
      }
      if (element.zipcode) {
        addressArray.push(element.zipcode);
      }
      return {
        Name: element.name || '',
        Code: element.code || '',
        Address: addressArray.join(','),
        'Active?': element.status === 1 ? 'Yes' : 'No',
        'Last Modified': akUtils.convertDateToTimezone({
          dateToConvert: element.updatedOn,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        })
      };
    }
  },
  notifications: {
    type: 'master',
    helperName: 'notification',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        Message: element.message || '',
        Type: element.type || '',
        Date: akUtils.convertDateToTimezone({
          dateToConvert: element.notificationTime,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        From:
          `${(element.actionBy || {}).firstName || ''} ${(element.actionBy || {}).lastName ||
            ''}`.trim() || ''
      };
    }
  },
  orders: {
    type: 'ordershipment',
    helperName: 'order',
    mappingFn(element, timezone, dateTimeFormat) {
      const locations = (element.addresses || []).reduce((result, elem) => {
        result[elem.addressType] = elem.location;
        return result;
      }, {});
      return {
        'Order#': element.code || '',
        Status: akUtils.objectKeyByValue(orderStatusLabelMap, element.orderStatus) || '',
        'Ordered Date': akUtils.convertDateToTimezone({
          dateToConvert: element.orderedDate,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'Surgery Date': akUtils.convertDateToTimezone({
          dateToConvert: element.etd,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'Sales Representative':
          `${(element.consumer || {}).firstName || ''} ${(element.consumer || {}).lastName ||
            ''}`.trim() || '',
        'To Address': (locations.toAddress || {}).name || ''
      };
    }
  },
  shipments: {
    type: 'ordershipment',
    helperName: 'shipment',
    mappingFn(element, timezone, dateTimeFormat) {
      const locations = (element.addresses || []).reduce((result, elem) => {
        result[elem.addressType] = elem.location;
        return result;
      }, {});
      return {
        'Shipment#': element.code || '',
        'Created Date': akUtils.convertDateToTimezone({
          dateToConvert: element.createdOn,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'To Address': (locations.shipFromAddress || {}).name || '',
        'Scheduled Pickup Date': akUtils.convertDateToTimezone({
          dateToConvert: element.scheduledPickupDate,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'Scheduled Delivery Date': akUtils.convertDateToTimezone({
          dateToConvert: element.etd,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        Status: akUtils.objectKeyByValue(shipStatusLabelMap, element.shipmentStatus) || '',
        'Carrier User':
          `${(element.carrierUser || {}).firstName || ''} ${(element.carrierUser || {}).lastName ||
            ''}`.trim() || ''
      };
    }
  },
  products: {
    type: 'master',
    helperName: 'product',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        Name: element.name || '',
        Code: element.code || '',
        Parent: ((element.ancestors || [])[0] || {}).name || '',
        Category: (element.categories || []).map(x => x.name).join(', '),
        Things: (element.things || []).map(x => x.name).join(', '),
        'Active?': element.status === 1 ? 'Yes' : 'No',
        'Last Modified': akUtils.convertDateToTimezone({
          dateToConvert: element.updatedOn,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        })
      };
    }
  },
  tags: {
    type: 'master',
    helperName: 'tags',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        Name: element.name || '',
        'Active?': element.status === 1 ? 'Yes' : 'No',
        'Last Modified': akUtils.convertDateToTimezone({
          dateToConvert: element.updatedOn,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        })
      };
    }
  },
  tempTags: {
    type: 'master',
    helperName: 'tempTags',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        Name: element.name || '',
        Code: element.code || '',
        'Device id': element.deviceId || '',
        'Min Temperature': element.minTemp || '',
        'Max Temperature': element.maxTemp || '',
        'Measurement Cycle': element.measurementCycle || '',
        'Updated On': akUtils.convertDateToTimezone({
          dateToConvert: element.updatedOn,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        })
      };
    }
  },
  zones: {
    type: 'master',
    helperName: 'core/zone',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        Name: element.name || '',
        Code: element.code || '',
        Location: ((element.ancestors || [])[0] || {}).name || '',
        Floor: ((element.ancestors || [])[1] || {}).name || '',
        'Active?': element.status === 1 ? 'Yes' : 'No',
        'Last Modified': akUtils.convertDateToTimezone({
          dateToConvert: element.updatedOn,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        })
      };
    }
  },
  users: {
    type: 'master',
    helperName: 'users',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        'First Name': element.given_name || '',
        'Last Name': element.family_name || '',
        Email: element.email || '',
        Group: element.groups.map(item => item.name).join(',') || '',
        'Active?': element.Enabled === true ? 'Yes' : 'No',
        Status: element.UserStatus || '',
        'Admin Approved?': element.isAdminApproved === 'yes' ? 'Yes' : 'No',
        'Last Modified': akUtils.convertDateToTimezone({
          dateToConvert: element.UserLastModifiedDate,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        })
      };
    }
  },
  // REPORTS ----------------

  ordersPerHospital: {
    type: 'report',
    helperName: 'report',
    functionName: 'ordersPerHospital',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        Hospital: element.hospital || '',
        'Order#': element.code || '',
        Status: element.orderStatus || '',
        'Ordered Date': akUtils.convertDateToTimezone({
          dateToConvert: element.orderdate,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'Surgery Date': akUtils.convertDateToTimezone({
          dateToConvert: element.surgerydate,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'Sales Representative': element.salesrep || '',
        Surgeon: element.surgeon || '',
        Patient: element.patient || ''
      };
    }
  },

  ordersBySurgery: {
    type: 'report',
    helperName: 'report',
    functionName: 'ordersBySurgery',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        Surgery: element.surgery || '',
        'Order#': element.code || '',
        Status: element.orderStatus || '',
        'Ordered Date': akUtils.convertDateToTimezone({
          dateToConvert: element.orderdate,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'Surgery Date': akUtils.convertDateToTimezone({
          dateToConvert: element.surgerydate,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'Sales Representative': element.salesrep || '',
        Surgeon: element.surgeon || '',
        Patient: element.patient || ''
      };
    }
  },

  ordersNotClosed: {
    type: 'report',
    helperName: 'report',
    functionName: 'ordersNotClosed',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        'Order#': element.code || '',
        Status: element.orderStatus || '',
        'Ordered Date': akUtils.convertDateToTimezone({
          dateToConvert: element.orderdate,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'Surgery Date': akUtils.convertDateToTimezone({
          dateToConvert: element.surgerydate,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'Sales Representative': element.salesrep || '',
        Surgeon: element.surgeon || '',
        Patient: element.patient || '',
        'Time Elapsed': element.dateDiff || ''
      };
    }
  },

  shipmentDue: {
    type: 'report',
    helperName: 'report',
    functionName: 'shipmentDue',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        'Shipment#': element.code || '',
        'To Location': element.toAddress || '',
        'Scheduled Delivery Date': akUtils.convertDateToTimezone({
          dateToConvert: element.scheduledDeliveryDate,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        Status: element.shipmentStatus || '',
        'Carrier User': element.carrier || '',
        'Pickup Date': akUtils.convertDateToTimezone({
          dateToConvert: element.pickupDate,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'Due In': element.dateDiff || ''
      };
    }
  },

  ordersWithUnshippedProducts: {
    type: 'report',
    helperName: 'report',
    functionName: 'casesWithUnshippedProducts',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        'Order#': element.code || '',
        'Unshipped Products': element.product || '',
        Code: element.sku || '',
        'Surgery Date': akUtils.convertDateToTimezone({
          dateToConvert: element.surgerydate,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'Sales Representative': element.salesrep || ''
      };
    }
  },

  undeliveredProducts: {
    type: 'report',
    helperName: 'report',
    functionName: 'undeliveredProducts',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        Code: element.sku || '',
        Product: element.product || '',
        Things: element.things || '',
        'Shipment #': element.code || '',
        Status: element.shipmentStatus || '',
        'Ship to Address': element.toAddress || '',
        'Current Location': element.currentLocation || '',
        'Shipped Date': akUtils.convertDateToTimezone({
          dateToConvert: element.shipDate,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'Surgery Date': akUtils.convertDateToTimezone({
          dateToConvert: element.etd,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'Carrier User': element.carrier || '',
        'Last Tracked': akUtils.convertDateToTimezone({
          dateToConvert: element.lastTracked,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        })
      };
    }
  },

  ordersPerSurgeon: {
    type: 'report',
    helperName: 'report',
    functionName: 'orderspersurgeon',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        Surgeon: element.surgeon || '',
        'Order#': element.code || '',
        Status: element.orderStatus || '',
        'Ordered Date': akUtils.convertDateToTimezone({
          dateToConvert: element.orderdate,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        Surgery: element.surgery || '',
        'Surgery Date': akUtils.convertDateToTimezone({
          dateToConvert: element.surgerydate,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'Sales Representative': element.salesrep || ''
      };
    }
  },

  ordersPerCity: {
    type: 'report',
    helperName: 'report',
    functionName: 'ordersPerCity',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        City: element.surgeon || '',
        State: element.surgeon || '',
        'Order#': element.code || '',
        Status: element.orderStatus || '',
        'Ordered Date': akUtils.convertDateToTimezone({
          dateToConvert: element.orderdate,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'Surgery Date': akUtils.convertDateToTimezone({
          dateToConvert: element.surgerydate,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'Sales Representative': element.salesrep || '',
        Surgeon: element.surgeon || ''
      };
    }
  },

  locationToZoneMapping: {
    type: 'report',
    helperName: 'report',
    functionName: 'locationToZoneMapping',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        Location: element.location || '',
        Floor: element.floor || '',
        Zone: element.name || '',
        'Static Beacon': element.beacons || ''
      };
    }
  },

  shipmentDeliveryTime: {
    type: 'report',
    helperName: 'report',
    functionName: 'shipmentDeliveryTime',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        'Shipment#': element.code || '',
        'Ship From Address': element.fromAddress || '',
        'Ship To Address': element.toAddress || '',
        'Shipped On': akUtils.convertDateToTimezone({
          dateToConvert: element.shipDate,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'Delivered On': akUtils.convertDateToTimezone({
          dateToConvert: element.deliveryDate,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'Time Taken': element.dateDiff || ''
      };
    }
  },

  carrierWiseDelayedShipments: {
    type: 'report',
    helperName: 'report',
    functionName: 'carrierWiseDelayedShipments',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        'Carrier User': element.carrier || '',
        'Shipment #': element.code || '',
        'Scheduled Delivery Date': akUtils.convertDateToTimezone({
          dateToConvert: element.etd,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'Actual Delivery Date': akUtils.convertDateToTimezone({
          dateToConvert: element.deliveryDate,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'Delayed By': element.delay || ''
      };
    }
  },

  shipmentsHardDelivered: {
    type: 'report',
    helperName: 'report',
    functionName: 'shipmentHardDelivered',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        'Shipment #': element.code || '',
        'Previous Status': element.previousState || '',
        'Current Status': element.currentStatus || '',
        'Scheduled Delivery Date': akUtils.convertDateToTimezone({
          dateToConvert: element.scheduledDeliveryDate,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'Actual Delivery Date': akUtils.convertDateToTimezone({
          dateToConvert: element.deliveryDate,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'Carrier User': element.carrier || ''
      };
    }
  },

  shipmentsInJeopardy: {
    type: 'report',
    helperName: 'report',
    functionName: 'shipmentInJeopardy',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        'Order#': element.ordercode || '',
        'Shipment#': element.shipmentcode || '',
        'To Location': element.toAddress || '',
        'Scheduled Delivery Date': akUtils.convertDateToTimezone({
          dateToConvert: element.scheduledDeliveryDate,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        Status: element.shipmentStatus || '',
        'Carrier User': element.carrier || '',
        'Pickup Date': akUtils.convertDateToTimezone({
          dateToConvert: element.pickupDate,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'Surgery In': element.timeTillSurgery || ''
      };
    }
  },

  mostUsedProductsPerSurgeon: {
    type: 'report',
    helperName: 'report',
    functionName: 'mostUsedProductsPerSurgeon',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        Surgeon: element.surgeon || '',
        Product: element.product || '',
        Code: element.sku || '',
        Category: element.categories || '',
        'Usage Count': element.count || '',
        Surgery: element.surgery || '',
        Hospital: element.hospital || ''
      };
    }
  },

  partialShipments: {
    type: 'report',
    helperName: 'report',
    functionName: 'partialShipments',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        'Order#': element.ordercode || '',
        'Shipment#': element.shipmentcode || '',
        'To Location': element.toAddress || '',
        'Scheduled Delivery Date': akUtils.convertDateToTimezone({
          dateToConvert: element.scheduledDeliveryDate,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        Status: element.shipmentStatus || '',
        'Carrier User': element.carrier || ''
      };
    }
  },

  salesrepWiseProductOrders: {
    type: 'report',
    helperName: 'report',
    functionName: 'salesrepWiseProductOrder',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        'Sales Representative': element.salesrep || '',
        Product: element.product || '',
        Category: element.categories || '',
        'Order#': element.order || '',
        'Order Count': element.count || '',
        'Last Ordered': akUtils.convertDateToTimezone({
          dateToConvert: element.lastOrdered,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        })
      };
    }
  },

  stationaryShipments: {
    type: 'report',
    helperName: 'report',
    functionName: 'stationaryShipments',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        'Shipment#': element.code || '',
        Status: element.shipmentStatus || '',
        'Ship To Location': element.toAddress || '',
        'Current Location': element.currentLocation || '',
        'Stationary Since': element.stationarySince || ''
      };
    }
  },

  productLocator: {
    type: 'report',
    helperName: 'report',
    functionName: 'productLocator',
    mappingFn(element, timezone, dateTimeFormat) {
      let location = (element.location || {}).name;
      if (!location) {
        const locationData = [];
        if ((element.location || {}).address) {
          locationData.push(element.location.address);
        }
        if ((element.location || {}).city) {
          locationData.push(element.location.city);
        }
        if ((element.location || {}).state) {
          locationData.push(element.location.state);
        }
        if ((element.location || {}).country) {
          locationData.push(element.location.country);
        }
        location = locationData.join(', ');
      }
      return {
        Code: element.code || '',
        Name: element.name || '',
        Sensor: (element.sensors || {}).code || '' || '',
        Location: location || '',
        Floor: ((element.location || {}).floor || {}).name || '',
        Zone: (((element.location || {}).floor || {}).zone || {}).name || '',
        'Device Name': (element.device || {}).name || '',
        'Device Code': (element.device || {}).code || '',
        'Device App': (element.device || {}).appName || '',
        'Last Tracked Date': akUtils.convertDateToTimezone({
          dateToConvert: element.trackedAt,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        })
      };
    }
  },

  internalExternalShipment: {
    type: 'report',
    helperName: 'report',
    functionName: 'internalExternalShipment',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        Location: element.location || '',
        'External Shipments': element.externalCount || '',
        'Internal Shipments': element.internalCount || ''
      };
    }
  },

  sensorConnectionStatus: {
    type: 'report',
    helperName: 'report',
    functionName: 'sensorConnectionStatus',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        Name: element.sensor || '',
        'Product Code': element.sku || '',
        Product: element.product || '',
        Assigned: element.isAssigned || '',
        'Battery %': element.battery_level || '',
        'Last Connection': akUtils.convertDateToTimezone({
          dateToConvert: element.last_connection,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'Last Tracked': akUtils.convertDateToTimezone({
          dateToConvert: element.last_tracked,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        Location: element.location || '',
        'Firmware Version': element.firmware || '',
        Manufacturer: element.manufacturer || ''
      };
    }
  },

  appStatus: {
    type: 'report',
    helperName: 'report',
    functionName: 'appStatus',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        'User Name': element.user || '',
        'Device Name': element.devicename || '',
        Code: element.devicecode || '',
        App: element.appName || '',
        OS: element.os || '',
        Manufacturer: element.manufacturer || '',
        Bluetooth: element.bluetoothStatus || '',
        GPS: element.gpsStatus || '',
        'Beacon Service': element.beaconServiceStatus || '',
        'Logged In': element.isLoggedIn || '',
        Active: element.isActive || '',
        Reporting: element.isReporting || '',
        'Last Tracked': akUtils.convertDateToTimezone({
          dateToConvert: element.lastTracked,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        })
      };
    }
  },

  productsReadyToDispatch: {
    type: 'report',
    helperName: 'report',
    functionName: 'productsReadyToDispatch',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        Product: element.product || '',
        Category: element.categories || '',
        'Shipment #': element.shipmentcode || '',
        Status: element.shipmentStatus || '',
        'Ship To Address': element.toAddress || '',
        'Surgery Date': akUtils.convertDateToTimezone({
          dateToConvert: element.surgeryDate,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'Pickup Date': akUtils.convertDateToTimezone({
          dateToConvert: element.scheduledPickupDate,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'Scheduled Delivery Date': akUtils.convertDateToTimezone({
          dateToConvert: element.scheduledDeliveryDate,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'Carrier User': element.carrier || ''
      };
    }
  },

  productThingMapping: {
    type: 'report',
    helperName: 'report',
    functionName: 'productThingMapping',
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        Code: element.code || '',
        Product: element.name || '',
        Things: element.things || '',
        'Last Modified': akUtils.convertDateToTimezone({
          dateToConvert: element.lastThingsChangeOn,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        })
      };
    }
  },
  productThingMappingHistory: {
    type: 'report',
    helperName: 'report',
    functionName: 'productThingMappingHistory',
    pathParamsMap: {
      productId: 'id'
    },
    mappingFn(element, timezone, dateTimeFormat) {
      return {
        Sensor: element.thing || '',
        'Association Date': akUtils.convertDateToTimezone({
          dateToConvert: element.associatedOn,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'Disassociation Date': akUtils.convertDateToTimezone({
          dateToConvert: element.disassociatedOn,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        }),
        'Currently Associated': element.currentlyAssociated || ''
      };
    }
  },

  deviceLocator: {
    type: 'report',
    helperName: 'report',
    functionName: 'deviceLocator',
    mappingFn(element, timezone, dateTimeFormat) {
      element.attributes = element.attributes || {};
      let location = (element.location || {}).name;
      if (!location) {
        const locationData = [];
        if ((element.location || {}).address) {
          locationData.push(element.location.address);
        }
        if ((element.location || {}).city) {
          locationData.push(element.location.city);
        }
        if ((element.location || {}).state) {
          locationData.push(element.location.state);
        }
        if ((element.location || {}).country) {
          locationData.push(element.location.country);
        }
        location = locationData.join(', ');
      }
      return {
        Code: element.code || '',
        Name: element.name || '',
        App: element.attributes.appName || '',
        OS: element.attributes.os || '',
        Manufacturer:
          `${element.attributes.manufacturer || ''} .trim()${element.attributes.model ||
            ''} .trim()${element.attributes.version || ''}`.trim() || '',
        Sensor: (element.sensors || {}).code || '',
        Location: location || '',
        Floor: ((element.location || {}).floor || {}).name || '',
        Zone: (((element.location || {}).floor || {}).zone || {}).name || '',
        'Last Tracked Date': akUtils.convertDateToTimezone({
          dateToConvert: element.trackedAt,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        })
      };
    }
  },

  userLocator: {
    type: 'report',
    helperName: 'report',
    functionName: 'userLocator',
    mappingFn(element, timezone, dateTimeFormat) {
      let location = (element.location || {}).name;
      if (!location) {
        const locationData = [];
        if ((element.location || {}).address) {
          locationData.push(element.location.address);
        }
        if ((element.location || {}).city) {
          locationData.push(element.location.city);
        }
        if ((element.location || {}).state) {
          locationData.push(element.location.state);
        }
        if ((element.location || {}).country) {
          locationData.push(element.location.country);
        }
        location = locationData.join(', ');
      }
      return {
        'User Name': element.Username || '',
        Name: element.name || '',
        App: (element.device || {}).appName || '',
        OS: (element.device || {}).os || '',
        Manufacturer:
          `${(element.device || {}).manufacturer || ''} ${(element.device || {}).model ||
            ''} ${(element.device || {}).version || ''}`.trim() || '',
        Sensor: (element.sensors || {}).code || '' || '',
        Location: location || '',
        Floor: ((element.location || {}).floor || {}).name || '',
        Zone: (((element.location || {}).floor || {}).zone || {}).name || '',
        'Last Tracked Date': akUtils.convertDateToTimezone({
          dateToConvert: element.trackedAt,
          timeZone: timezone || 'UTC',
          formatType: 'dtz',
          format: dateTimeFormat,
          defaultValue: ''
        })
      };
    }
  }

  // productLocatorHistory - NOT SUPPORTED YET
  // deviceLocatorHistory - NOT SUPPORTED YET
};

module.exports = entities;
