module.exports.getCollectionTypes = (event, context, callback) => {
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
