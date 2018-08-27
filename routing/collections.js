const collectionHandler = require('../handlers/collections');

exports.routeCollections = function(event, context, callback) {
  switch (event.httpMethod.toUpperCase()) {
    case 'GET':
      if (event.pathParameters === null) {
        collectionHandler.getCollections(event, context, callback);
      } else {
        collectionHandler.getCollectionById(event, context, callback);
      }
      break;
    case 'POST':
      collectionHandler.saveCollection(event, context, callback);
      break;
    case 'PUT':
      collectionHandler.updateCollection(event, context, callback);
      break;
    default:
  }
};
