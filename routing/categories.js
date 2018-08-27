const categoryHandler = require('../handlers/categories');

exports.routeCategories = function(event, context, callback) {
  switch (event.httpMethod.toUpperCase()) {
    case 'GET':
      if (event.pathParameters === null) {
        categoryHandler.getCategories(event, context, callback);
      } else {
        categoryHandler.getCategoryById(event, context, callback);
      }
      break;
    case 'POST':
      categoryHandler.saveCategory(event, context, callback);
      break;
    case 'PUT':
      categoryHandler.updateCategory(event, context, callback);
      break;
    default:
  }
};
