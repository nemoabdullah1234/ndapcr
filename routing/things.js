const beaconHandler = require('../handlers/things');
const gatewayHandler = require('../handlers/gateway');
const nfcTagHandler = require('../handlers/nfcTag');
const tempTagsHandler = require('../handlers/tempTags');
const deviceHandler = require('../handlers/device');

exports.routeBeacons = function(event, context, callback) {
  switch (event.httpMethod.toUpperCase()) {
    case 'GET':
      if (event.pathParameters === null) {
        beaconHandler.getThings(event, context, callback);
      } else {
        beaconHandler.getThingById(event, context, callback);
      }
      break;
    case 'POST':
      beaconHandler.saveThing(event, context, callback);
      break;
    case 'PUT':
      beaconHandler.updateThing(event, context, callback);
      break;
    default:
  }
};

exports.routeGateways = function(event, context, callback) {
  switch (event.httpMethod.toUpperCase()) {
    case 'GET':
      if (event.pathParameters === null) {
        gatewayHandler.getGateways(event, context, callback);
      } else {
        gatewayHandler.getGatewayById(event, context, callback);
      }
      break;
    case 'POST':
      gatewayHandler.saveGateway(event, context, callback);
      break;
    case 'PUT':
      gatewayHandler.updateGateway(event, context, callback);
      break;
    default:
  }
};

exports.routeDevices = function(event, context, callback) {
  switch (event.httpMethod.toUpperCase()) {
    case 'GET':
      if (event.pathParameters === null) {
        deviceHandler.getDevices(event, context, callback);
      } else {
        deviceHandler.getDevicebyId(event, context, callback);
      }
      break;
    case 'POST':
      deviceHandler.saveDevice(event, context, callback);
      break;
    case 'PUT':
      deviceHandler.updateDevice(event, context, callback);
      break;
    default:
  }
};

exports.routeTempTags = function(event, context, callback) {
  switch (event.httpMethod.toUpperCase()) {
    case 'GET':
      if (event.pathParameters === null) {
        tempTagsHandler.getTempTags(event, context, callback);
      } else if (event.pathParameters.productId) {
        tempTagsHandler.getScanHistoryDataForProduct(event, context, callback);
      } else {
        tempTagsHandler.getTempTagbyId(event, context, callback);
      }
      break;
    case 'POST':
      tempTagsHandler.saveTempTag(event, context, callback);
      break;
    case 'PUT':
      tempTagsHandler.updateTempTag(event, context, callback);
      break;
    default:
  }
};

exports.routeNfcTags = function(event, context, callback) {
  switch (event.httpMethod.toUpperCase()) {
    case 'GET':
      if (event.pathParameters === null) {
        nfcTagHandler.getNfcTags(event, context, callback);
      } else if (event.pathParameters.productId) {
        nfcTagHandler.getScanHistoryDataForProduct(event, context, callback);
      } else {
        nfcTagHandler.getNfcTagbyId(event, context, callback);
      }
      break;
    case 'POST':
      nfcTagHandler.saveNfcTag(event, context, callback);
      break;
    case 'PUT':
      nfcTagHandler.updateNfcTagStatus(event, context, callback);
      break;
    default:
  }
};
