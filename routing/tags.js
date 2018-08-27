const tagHandler = require('../handlers/tags');

exports.routeTags = function(event, context, callback) {
  switch (event.httpMethod.toUpperCase()) {
    case 'GET':
      if (event.pathParameters === null) {
        tagHandler.getTags(event, context, callback);
      } else {
        tagHandler.getTagById(event, context, callback);
      }
      break;
    case 'POST':
      tagHandler.saveTag(event, context, callback);
      break;
    case 'PUT':
      tagHandler.updateTag(event, context, callback);
      break;
    default:
  }
};
