const auditTrailHandler = require('../handlers/auditTrail');

exports.routeAuditTrail = function(event, context, callback) {
  switch (event.httpMethod.toUpperCase()) {
    case 'GET':
      if (event.pathParameters === null) {
        auditTrailHandler.getAuditTrails(event, context, callback);
      } else {
        auditTrailHandler.getAuditTrailById(event, context, callback);
      }
      break;
    default:
  }
};
