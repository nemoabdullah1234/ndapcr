const trackingReportHandler = require('../handlers/trackingreports');
const akResponses = require('../lib/respones');

exports.routeTrackingReports = function(event, context, callback) {
  try {
    switch ((event.pathParameters || {}).path) {
      case 'mobilelogs':
        trackingReportHandler.mobileLogs(event, context, callback);
        break;
      case 'pointstatus-tracking':
        trackingReportHandler.pointStatusTracking(event, context, callback);
        break;
      case 'rawsensors-tracking':
        trackingReportHandler.rawSensorsTracking(event, context, callback);
        break;
      case 'product-locator':
        trackingReportHandler.productLocator(event, context, callback);
        break;
      case 'device-locator':
        trackingReportHandler.deviceLocator(event, context, callback);
        break;
      case 'user-locator-list':
        trackingReportHandler.userLocator(event, context, callback);
        break;
      case 'sensor-locator':
        trackingReportHandler.sensorLocator(event, context, callback);
        break;
      case 'sensor-entrance':
        trackingReportHandler.sensorEntraceTracking(event, context, callback);
        break;
      case 'user-entrance':
        trackingReportHandler.userEntraceTracking(event, context, callback);
        break;

      case 'device-locator-history':
        trackingReportHandler.deviceLocatorHistory(event, context, callback);
        break;
      case 'user-locator-history':
        trackingReportHandler.userLocatorHistory(event, context, callback);
        break;
      case 'product-locator-history':
        trackingReportHandler.productLocatorHistory(event, context, callback);
        break;
      case 'sensor-locator-history':
        trackingReportHandler.sensorLocatorHistory(event, context, callback);
        break;
      default:
    }
  } catch (err) {
    console.log(err);
    callback(null, akResponses.somethingWentWrong([]));
  }
};
