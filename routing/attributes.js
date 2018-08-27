const attributeHandler = require('../handlers/attributes');

exports.routeAttributes = function(event, context, callback) {
  switch (event.httpMethod.toUpperCase()) {
    case 'GET':
      if (event.pathParameters === null) {
        attributeHandler.getAttributes(event, context, callback);
      } else {
        attributeHandler.getAttributeById(event, context, callback);
      }
      break;
    case 'POST':
      attributeHandler.saveAttribute(event, context, callback);
      break;
    case 'PUT':
      attributeHandler.updateAttribute(event, context, callback);
      break;
    default:
  }
};
