const reportHandler = require('../handlers/report');

exports.routeReports = function(event, context, callback) {
  switch ((event.pathParameters || {}).path) {
    case 'get-graph-report':
      reportHandler.getGraphReport(event, context, callback);
      break;
    case 'app-status':
      reportHandler.appStatus(event, context, callback);
      break;
    case 'orders-per-hospital':
      reportHandler.ordersPerHospital(event, context, callback);
      break;
    case 'orders-by-surgery':
      reportHandler.ordersBySurgery(event, context, callback);
      break;
    case 'orders-not-closed':
      reportHandler.ordersNotClosed(event, context, callback);
      break;
    case 'orders-with-unshipped-products':
      reportHandler.casesWithUnshippedProducts(event, context, callback);
      break;
    case 'undelivered-products':
      reportHandler.undeliveredProducts(event, context, callback);
      break;
    case 'orders-per-surgeon':
      reportHandler.orderspersurgeon(event, context, callback);
      break;
    case 'shipment-due':
      reportHandler.shipmentDue(event, context, callback);
      break;
    case 'orders-by-city':
      reportHandler.ordersPerCity(event, context, callback);
      break;
    case 'shipment-delivery-time':
      reportHandler.shipmentDeliveryTime(event, context, callback);
      break;
    case 'location-zone-mapping':
      reportHandler.locationToZoneMapping(event, context, callback);
      break;
    case 'carrier-wise-delayed-shipments':
      reportHandler.carrierWiseDelayedShipments(event, context, callback);
      break;
    case 'shipment-hard-delivered':
      reportHandler.shipmentHardDelivered(event, context, callback);
      break;
    case 'most-used-products-per-surgeon':
      reportHandler.mostUsedProductsPerSurgeon(event, context, callback);
      break;
    case 'shipments-in-jeopardy':
      reportHandler.shipmentsInJeopardy(event, context, callback);
      break;
    case 'salesrep-wise-product-order':
      reportHandler.salesrepWiseProductOrder(event, context, callback);
      break;
    case 'partial-shipments':
      reportHandler.partialShipments(event, context, callback);
      break;
    case 'stationary-shipments':
      reportHandler.stationaryShipments(event, context, callback);
      break;
    case 'internal-external-shipments':
      reportHandler.internalExternalShipment(event, context, callback);
      break;
    case 'sensor-connection-status':
      reportHandler.sensorConnectionStatus(event, context, callback);
      break;
    case 'products-ready-to-dispatch':
      reportHandler.productsToDispatch(event, context, callback);
      break;
    case 'product-thing-mapping':
      if (event.pathParameters.id) {
        reportHandler.productThingMappingHistory(event, context, callback);
      } else {
        reportHandler.productThingMapping(event, context, callback);
      }
      break;
    case 'login-history':
      reportHandler.loginHistory(event, context, callback);
      break;
    default:
  }
};
