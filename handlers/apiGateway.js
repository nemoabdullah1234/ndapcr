const apiGatewayHelper = require('../helpers/apiGateway');
const akResponse = require('../lib/respones');
const messages = require('../mappings/messagestring.json');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');

module.exports.getRestApis = (event, context, callback) => {
  // const req = commonHelper.lambdaEventToBodyParserReq(event);

  apiGatewayHelper.getRestApis().then(
    res => {
      callback(null, res);
    },
    error => {
      callback(null, error);
      // // console.log(error);
    }
  );
};

module.exports.getResources = (event, context, callback) => {
  // const req = commonHelper.lambdaEventToBodyParserReq(event);

  apiGatewayHelper.getResources().then(
    res => {
      const response = akResponse.listSuccess(res, 'Attribute List');

      callback(null, response);
    },
    () => {
      // // console.log(error);
      const response = akResponse.noDataFound(messages.NO_RECORDS, messages.NO_RECORDS);

      callback(null, response);
    }
  );
};
