const configurationHandler = require('../handlers/configuration');

exports.routeConfiguration = function(event, context, callback) {
  switch (event.httpMethod.toUpperCase()) {
    case 'GET':
      configurationHandler.getAttributes(event, context, callback);
      break;
    case 'PUT':
      configurationHandler.updateAttribute(event, context, callback);
      break;
    default:
  }
};
