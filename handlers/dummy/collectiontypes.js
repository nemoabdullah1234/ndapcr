const commonHelper = require('../../helpers/common');
const clientHandler = require('../../lib/clientHandler');
const currentUserHandler = require('../../lib/currentUserHandler');

module.exports.getCollectionTypes = (event, context, callback) => {
  event = commonHelper.parseLambdaEvent(event);
  clientHandler.setClient(clientHandler.getClientObject(event));
  currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
  const response = {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      code: 200,
      message: 'Success',
      description: 'CategoryType List ',
      totalRecords: 7,
      recordsCount: 3,
      data: [
        {
          id: 'products',
          name: 'products'
        },
        {
          id: 'categories',
          name: 'categories'
        },
        {
          id: 'attributes',
          name: 'attributes'
        }
      ]
    })
  };
  callback(null, response);
};
