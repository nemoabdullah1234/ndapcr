// let auth = require('../lib/auth.js');

class AkResponse {
  listSuccess(data, desc) {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        code: 200,
        message: 'Success',
        description: desc,
        totalRecords: data[1],
        recordsCount: data[0].length,
        data: data[0]
      })
    };
  }

  success(result, desc, msg) {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        code: 200,
        message: msg,
        description: desc,
        data: result
      })
    };
  }

  created(result, desc, msg) {
    return {
      statusCode: 201,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        code: 201,
        message: msg,
        description: desc,
        data: result
      })
    };
  }

  validationFailed(errors, desc, msg) {
    return {
      statusCode: 422,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        code: 422,
        message: msg,
        description: desc,
        data: errors
      })
    };
  }

  noDataFound(msg, desc) {
    return {
      statusCode: 404,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        code: 404,
        message: msg,
        description: desc,
        data: []
      })
    };
  }

  notModified(desc, msg) {
    return {
      statusCode: 304,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        code: 304,
        message: msg,
        description: desc,
        data: {}
      })
    };
  }

  badRequest(desc, msg) {
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        code: 400,
        message: msg,
        description: desc,
        data: {}
      })
    };
  }

  somethingWentWrong(data) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        code: 500,
        message: 'Something Went Wrong',
        description: 'The server encountered some error',
        data: data || []
      })
    };
  }

  accepted(msg = 'Accepted', desc = '', data = {}) {
    return {
      statusCode: 202,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        code: 202,
        message: msg,
        description: desc,
        data
      })
    };
  }
  unauthorized(msg = 'Unauthorized', desc = '', data = {}) {
    return {
      statusCode: 401,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        code: 401,
        message: msg,
        description: desc,
        data
      })
    };
  }
}

module.exports = new AkResponse();
