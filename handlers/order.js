const commonHelper = require('../helpers/common');
const bluebirdPromise = require('bluebird');
const akUtils = require('../lib/utility');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');
/**
 * Get order List
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getOrders = (event, context, callback) => {
  commonHelper
    .decryptDbURI()
    .then(dbURI => {
      event = commonHelper.parseLambdaEvent(event);
      clientHandler.setClient(clientHandler.getClientObject(event));
      currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
      const mongoose = require('mongoose');
      commonHelper.connectToDb(dbURI);
      const orderHelper = require('../helpers/order');
      bluebirdPromise
        .all([
          orderHelper.get({
            searchParams: orderHelper.getFilterParams(event),
            otherParams: orderHelper.getExtraParams(event),
            projectParams: orderHelper.getProjectParams(event)
          }),
          orderHelper.count({
            searchParams: orderHelper.getFilterParams(event),
            projectParams: orderHelper.getProjectParams(event)
          })
        ])
        .then(resultObj => {
          const response = {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              code: 200,
              message: 'Success',
              description: 'Order List',
              totalRecords: resultObj[1],
              recordsCount: resultObj[0].length,
              data: resultObj[0]
            })
          };
          mongoose.disconnect();
          callback(null, response);
        })
        .catch(error => {
          // console.log(error);
          const response = {
            statusCode: 404,
            headers: {
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              code: 404,
              message: 'No Records Found',
              description: 'No Records Found',
              data: []
            })
          };
          mongoose.disconnect();
          callback(null, response);
        });
    })
    .catch(err => {
      // console.log(err);
      const response = {
        statusCode: 403,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          code: 403,
          message: 'Not authorized to access this resource'
        })
      };
      callback(null, response);
    });
};
/**
 * Get Single order for specified ID
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getOrderById = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    const orderHelper = require('../helpers/order');
    orderHelper
      .getById(event.pathParameters.id)
      .then(result => {
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 200,
            message: 'Ok',
            description: 'Order fetched successfully',
            data: result
          })
        };
        mongoose.disconnect();
        callback(null, response);
      })
      .catch(() => {
        const response = {
          statusCode: 404,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 404,
            message: 'No Record Found',
            description: 'No Record Found',
            data: {}
          })
        };
        mongoose.disconnect();
        callback(null, response);
      });
  });
};
/**
 * Update an order.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.updateOrder = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const orderHelper = require('../helpers/order');
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    event.body.products = Array.from(new Set((event.body.products || []).map(JSON.stringify))).map(
      JSON.parse
    );

    orderHelper
      .validateUpdate(event)
      .then(populatedTags => {
        event.body.tags = populatedTags.body.tags;
        orderHelper
          .update(event)
          .then(() =>
            // // console.log(result)
            orderHelper.getById(event.pathParameters.id)
          )
          .then(result => {
            const response = {
              statusCode: 200,
              headers: {
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                code: 200,
                message: 'Ok',
                description: 'Order updated successfully',
                data: result
              })
            };
            mongoose.disconnect();
            callback(null, response);
          })
          .catch(error => {
            // console.log(error);
            const response = {
              statusCode: 304,
              headers: {
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                code: 304,
                message: 'Update Failed',
                description: 'Update Failed',
                data: {}
              })
            };
            mongoose.disconnect();
            callback(null, response);
          });
      })
      .catch(errors => {
        // console.log(errors);
        const response = {
          statusCode: 422,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 422,
            message: 'ValidationErrors',
            description: 'Validation Errors Occured',
            data: errors
          })
        };
        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Save an order.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */

module.exports.saveOrder = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const orderHelper = require('../helpers/order');
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    event.body.products = Array.from(new Set((event.body.products || []).map(JSON.stringify))).map(
      JSON.parse
    );

    orderHelper
      .validateRequest(event)
      .then(populatedEvent => {
        orderHelper
          .save(populatedEvent)
          .then(result => orderHelper.getById(result._id))
          .then(result => {
            const response = commonHelper.formatResponse(
              201,
              'Ok',
              'Order saved successfully',
              result
            );
            mongoose.disconnect();
            callback(null, response);
          })
          .catch(error => {
            // console.log(error);
            const response = {
              statusCode: 400,
              headers: {
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                code: 400,
                message: 'Order create failed',
                description: 'Order create failed',
                data: {}
              })
            };
            mongoose.disconnect();
            callback(null, response);
          });
      })
      .catch(errors => {
        // console.log(errors);
        const response = {
          statusCode: 422,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 422,
            message: 'ValidationErrors',
            description: 'Validation Errors Occured',
            data: errors
          })
        };
        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * 
 * Get product associated with order
 * @param {any} event 
 * @param {any} context 
 * @param {any} callback 
 */
module.exports.getOrderProducts = (event, context, callback) => {
  commonHelper
    .decryptDbURI()
    .then(dbURI => {
      event = commonHelper.parseLambdaEvent(event);
      clientHandler.setClient(clientHandler.getClientObject(event));
      currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
      const mongoose = require('mongoose');
      commonHelper.connectToDb(dbURI);
      const orderHelper = require('../helpers/order');
      // const req = commonHelper.lambdaEventToBodyParserReq(event);

      bluebirdPromise
        .all([
          orderHelper.getProducts(
            orderHelper.getFilterParams(event),
            orderHelper.getExtraParams(event)
          ),
          orderHelper.count({
            searchParams: orderHelper.getFilterParams(event),
            projectParams: orderHelper.getProjectParams(event)
          })
        ])
        .then(resultObj => {
          const response = {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              code: 200,
              message: 'Success',
              description: 'Order Product List',
              totalRecords: resultObj[1],
              recordsCount: resultObj[0].length,
              data: resultObj[0]
            })
          };
          mongoose.disconnect();
          callback(null, response);
        })
        .catch(error => {
          // console.log(error);
          const response = {
            statusCode: 404,
            headers: {
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              code: 404,
              message: 'No Records Found',
              description: 'No Records Found',
              data: []
            })
          };
          mongoose.disconnect();
          callback(null, response);
        });
    })
    .catch(err => {
      // console.log(err);
      const response = {
        statusCode: 403,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          code: 403,
          message: 'Not authorized to access this resource'
        })
      };
      callback(null, response);
    });
};

/**
 * Get order List
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getOrdersHistoryForMobile = (event, context, callback) => {
  commonHelper
    .decryptDbURI()
    .then(dbURI => {
      event = commonHelper.parseLambdaEvent(event);
      clientHandler.setClient(clientHandler.getClientObject(event));
      currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
      const mongoose = require('mongoose');
      commonHelper.connectToDb(dbURI);
      const orderHelper = require('../helpers/order');
      bluebirdPromise
        .all([
          orderHelper.getOrdersForMobile(
            orderHelper.getFilterParams(event),
            orderHelper.getExtraParams(event),
            true
          ),
          orderHelper.count({
            searchParams: orderHelper.getFilterParams(event),
            projectParams: orderHelper.getProjectParams(event)
          })
        ])
        .then(resultObj => {
          const response = {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              code: 200,
              status: 1,
              message: 'Success',
              description: 'Order List',
              totalRecords: resultObj[1],
              recordsCount: resultObj[0].length,
              data: {
                readerGetCasesHistoryResponse: akUtils.cleanFormatResponse(resultObj[0])
              },
              _links: {
                self: {
                  href: 'http://strykerapi.nicbitqc.ossclients.com/reader/getCases'
                }
              }
            })
          };
          mongoose.disconnect();
          callback(null, response);
        })
        .catch(error => {
          // console.log(error);
          const response = {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              code: 404,
              status: 0,
              message: 'No Records Found',
              description: 'No Records Found',
              data: [],
              _links: {
                self: {
                  href: 'http://strykerapi.nicbitqc.ossclients.com/reader/getCases'
                }
              }
            })
          };
          mongoose.disconnect();
          callback(null, response);
        });
    })
    .catch(err => {
      // console.log(err);
      const response = {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          code: 403,
          status: 0,
          message: 'Not authorized to access this resource',
          _links: {
            self: {
              href: 'http://strykerapi.nicbitqc.ossclients.com/reader/getCases'
            }
          }
        })
      };
      callback(null, response);
    });
};

/**
 * Get order List
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getOrdersCompletedForMobile = (event, context, callback) => {
  commonHelper
    .decryptDbURI()
    .then(dbURI => {
      event = commonHelper.parseLambdaEvent(event);
      clientHandler.setClient(clientHandler.getClientObject(event));
      currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
      const mongoose = require('mongoose');
      commonHelper.connectToDb(dbURI);
      const orderHelper = require('../helpers/order');
      bluebirdPromise
        .all([
          orderHelper.getOrdersForMobile(
            orderHelper.getFilterParams(event),
            orderHelper.getExtraParams(event),
            true
          ),
          orderHelper.count({
            searchParams: orderHelper.getFilterParams(event),
            projectParams: orderHelper.getProjectParams(event)
          })
        ])
        .then(resultObj => {
          const response = {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              code: 200,
              status: 1,
              message: 'Success',
              description: 'Order List',
              totalRecords: resultObj[1],
              recordsCount: resultObj[0].length,
              data: {
                readerGetCompletedCasesResponse: akUtils.cleanFormatResponse(resultObj[0])
              },
              _links: {
                self: {
                  href: 'http://strykerapi.nicbitqc.ossclients.com/reader/getCases'
                }
              }
            })
          };
          mongoose.disconnect();
          callback(null, response);
        })
        .catch(error => {
          // console.log(error);
          const response = {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              code: 404,
              status: 0,
              message: 'No Records Found',
              description: 'No Records Found',
              data: {},
              _links: {
                self: {
                  href: 'http://strykerapi.nicbitqc.ossclients.com/reader/getCases'
                }
              }
            })
          };
          mongoose.disconnect();
          callback(null, response);
        });
    })
    .catch(err => {
      // console.log(err);
      const response = {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          code: 403,
          status: 0,
          message: 'Not authorized to access this resource',
          _links: {
            self: {
              href: 'http://strykerapi.nicbitqc.ossclients.com/reader/getCases'
            }
          }
        })
      };
      callback(null, response);
    });
};
/**
 * Get order List
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getOrdersForMobile = (event, context, callback) => {
  commonHelper
    .decryptDbURI()
    .then(dbURI => {
      event = commonHelper.parseLambdaEvent(event);
      clientHandler.setClient(clientHandler.getClientObject(event));
      currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
      const mongoose = require('mongoose');
      commonHelper.connectToDb(dbURI);
      const orderHelper = require('../helpers/order');
      bluebirdPromise
        .all([
          orderHelper.getOrdersForMobile(
            orderHelper.getFilterParams(event),
            orderHelper.getExtraParams(event)
          )
          // orderHelper.count({ searchParams: orderHelper.getFilterParams(event), projectParams: orderHelper.getProjectParams(event) })
        ])
        .then(resultObj => {
          const response = {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              code: 200,
              status: 1,
              message: 'Success',
              description: 'Order List',
              totalRecords: resultObj[1],
              recordsCount: resultObj[0].length,
              data: {
                readerGetCasesResponse: akUtils.cleanFormatResponse(resultObj[0])
              },
              _links: {
                self: {
                  href: 'http://strykerapi.nicbitqc.ossclients.com/reader/getCases'
                }
              }
            })
          };
          mongoose.disconnect();
          callback(null, response);
        })
        .catch(error => {
          // console.log(error);
          const response = {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              code: 404,
              status: 0,
              message: 'No Records Found',
              description: 'No Records Found',
              data: {},
              _links: {
                self: {
                  href: 'http://strykerapi.nicbitqc.ossclients.com/reader/getCases'
                }
              }
            })
          };
          mongoose.disconnect();
          callback(null, response);
        });
    })
    .catch(err => {
      // console.log(err);
      const response = {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          code: 403,
          status: 0,
          message: 'Not authorized to access this resource',
          _links: {
            self: {
              href: 'http://strykerapi.nicbitqc.ossclients.com/reader/getCases'
            }
          }
        })
      };
      callback(null, response);
    });
};

/**
 * Get Single order for specified ID
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getOrderForMobileById = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    const orderHelper = require('../helpers/order');
    orderHelper
      .getOrderForMobileById(event.pathParameters.id)
      .then(result => {
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 200,
            status: 1,
            message: 'Ok',
            description: 'Order fetched successfully',
            data: {
              readerGetCaseDetailsResponse: akUtils.cleanFormatResponse(result)
            },
            _links: {
              self: {
                href: 'http://strykerapi.nicbitqc.ossclients.com/reader/getCases'
              }
            }
          })
        };
        mongoose.disconnect();
        callback(null, response);
      })
      .catch(e => {
        // console.log(e);
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 404,
            status: 0,
            message: 'No Record Found',
            description: 'No Record Found',
            data: {},
            _links: {
              self: {
                href: 'http://strykerapi.nicbitqc.ossclients.com/reader/getCases'
              }
            }
          })
        };
        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * 
 * Get product associated with order
 * @param {any} event 
 * @param {any} context 
 * @param {any} callback 
 */
module.exports.getProductDetailForMobile = (event, context, callback) => {
  commonHelper
    .decryptDbURI()
    .then(dbURI => {
      event = commonHelper.parseLambdaEvent(event);
      clientHandler.setClient(clientHandler.getClientObject(event));
      currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
      const mongoose = require('mongoose');
      commonHelper.connectToDb(dbURI);
      const orderHelper = require('../helpers/order');
      // const req = commonHelper.lambdaEventToBodyParserReq(event);

      orderHelper
        .getProductDetailForMobile(event)
        .then(result => {
          const response = {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              code: 200,
              status: 1,
              message: 'Success',
              description: 'Order Product fetched successfully',
              data: {
                readerGetItemDetailsResponse: akUtils.cleanFormatResponse(result)
              },
              _links: {
                self: {
                  href: 'http://strykerapi.nicbitqc.ossclients.com/reader/getCases'
                }
              }
            })
          };
          mongoose.disconnect();
          callback(null, response);
        })
        .catch(error => {
          // console.log(error);
          const response = {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              code: 404,
              message: 'No Records Found',
              description: 'No Records Found',
              data: {},
              _links: {
                self: {
                  href: 'http://strykerapi.nicbitqc.ossclients.com/reader/getCases'
                }
              }
            })
          };
          mongoose.disconnect();
          callback(null, response);
        });
    })
    .catch(err => {
      // console.log(err);
      const response = {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          code: 403,
          status: 0,
          message: 'Not authorized to access this resource',
          _links: {
            self: {
              href: 'http://strykerapi.nicbitqc.ossclients.com/reader/getCases'
            }
          }
        })
      };
      callback(null, response);
    });
};

/**
 * Update an order.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.favouriteOrder = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const orderHelper = require('../helpers/order');
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    orderHelper
      .validateFavouriteRequest(event)
      .then(() => {
        orderHelper
          .favourite(event)
          .then(() => {
            // // console.log(result)
            const response = {
              statusCode: 200,
              headers: {
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                code: 0,
                status: 1,
                message: 'Ok',
                data: {
                  ReaderUpdateCaseFlagResponse: {}
                },
                _links: {
                  self: {
                    href: 'http://strykerapi.nicbit.ossclients.com/reader/updateCaseFlag'
                  }
                }
              })
            };
            mongoose.disconnect();
            callback(null, response);
          })
          .catch(error => {
            // console.log(error);
            const response = {
              statusCode: 200,
              headers: {
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                code: 304,
                message: 'Update Failed',
                description: 'Update Failed',
                data: {}
              })
            };
            mongoose.disconnect();
            callback(null, response);
          });
      })
      .catch(errors => {
        // console.log(errors);
        const response = {
          statusCode: 422,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 422,
            message: 'ValidationErrors',
            description: 'Validation Errors Occured',
            data: errors
          })
        };
        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Get order Orchestrations List
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getOrderOrchestrations = (event, context, callback) => {
  commonHelper
    .decryptDbURI()
    .then(dbURI => {
      event = commonHelper.parseLambdaEvent(event);
      clientHandler.setClient(clientHandler.getClientObject(event));
      currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
      const mongoose = require('mongoose');
      commonHelper.connectToDb(dbURI);
      const orderOrchestrationHelper = require('../helpers/orderOrchestration');
      bluebirdPromise
        .all([
          orderOrchestrationHelper.get(
            event.pathParameters.id,
            orderOrchestrationHelper.getFilterParams(event),
            orderOrchestrationHelper.getExtraParams(event)
          ),
          orderOrchestrationHelper.count(
            event.pathParameters.id,
            orderOrchestrationHelper.getFilterParams(event)
          )
        ])
        .then(resultObj => {
          const response = {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              code: 200,
              message: 'Success',
              description: 'Order Orchestration List',
              totalRecords: resultObj[1],
              recordsCount: resultObj[0].length,
              data: akUtils.cleanFormatResponse(resultObj[0])
            })
          };
          mongoose.disconnect();
          callback(null, response);
        })
        .catch(error => {
          // console.log(error);
          const response = {
            statusCode: 404,
            headers: {
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              code: 404,
              message: 'No Records Found',
              description: 'No Records Found',
              data: []
            })
          };
          mongoose.disconnect();
          callback(null, response);
        });
    })
    .catch(err => {
      // console.log(err);
      const response = {
        statusCode: 403,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          code: 403,
          message: 'Not authorized to access this resource'
        })
      };
      callback(null, response);
    });
};

/**
 * Update an order.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.searchOrdersAndProductsForMobile = (event, context, callback) => {
  commonHelper
    .decryptDbURI()
    .then(dbURI => {
      // console.log('preparse event');
      // console.log(event.queryStringParameters);
      // console.log('preparse event');
      event = commonHelper.parseLambdaEvent(event);
      clientHandler.setClient(clientHandler.getClientObject(event));
      currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
      const mongoose = require('mongoose');
      commonHelper.connectToDb(dbURI);
      const orderHelper = require('../helpers/order');
      orderHelper
        .searchOrdersAndProductsForMobile(event)
        .then(resultObj => {
          const response = {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              code: 0,
              status: 1,
              message: 'Ok',
              data: {
                readerSearchCasesResponse: akUtils.cleanFormatResponse(resultObj)
              }
            })
          };
          mongoose.disconnect();
          callback(null, response);
        })
        .catch(error => {
          // console.log(error);
          const response = {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              code: 0,
              status: 0,
              message: 'Ok',
              data: {
                readerSearchCasesResponse: []
              }
            })
          };
          mongoose.disconnect();
          callback(null, response);
        });
    })
    .catch(err => {
      // console.log(err);
      const response = {
        statusCode: 403,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          code: 403,
          message: 'Not authorized to access this resource'
        })
      };
      callback(null, response);
    });
};

/**
 * Cancel an order.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.cancelOrder = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const orderHelper = require('../helpers/order');
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    orderHelper
      .validateCancel(event.pathParameters.id)
      .then(() => {
        orderHelper
          .cancelOrder(event.pathParameters.id)
          .then(result => {
            const response = {
              statusCode: 200,
              headers: {
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                code: 200,
                message: 'Ok',
                description: 'Order Canceled successfully',
                data: {}
              })
            };
            mongoose.disconnect();
            callback(null, response);
          })
          .catch(error => {
            // console.log(error);
            const response = {
              statusCode: 304,
              headers: {
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                code: 304,
                message: 'Canceled Failed',
                description: 'Canceled Failed',
                data: {}
              })
            };
            mongoose.disconnect();
            callback(null, response);
          });
      })
      .catch(errors => {
        // console.log(errors);
        const response = {
          statusCode: 422,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 422,
            message: 'ValidationErrors',
            description: 'Validation Errors Occured',
            data: errors
          })
        };
        mongoose.disconnect();
        callback(null, response);
      });
  });
};

/**
 * Get order's item Orchestrations List
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getOrderItemOrchestrations = (event, context, callback) => {
  commonHelper
    .decryptDbURI()
    .then(dbURI => {
      event = commonHelper.parseLambdaEvent(event);
      clientHandler.setClient(clientHandler.getClientObject(event));
      currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
      const mongoose = require('mongoose');
      commonHelper.connectToDb(dbURI);
      const itemOrchestrationHelper = require('../helpers/itemOrchestration');
      bluebirdPromise
        .all([
          itemOrchestrationHelper.get(
            event.pathParameters.id,
            event.pathParameters.orderid,
            itemOrchestrationHelper.getFilterParams(event),
            itemOrchestrationHelper.getExtraParams(event)
          ),
          itemOrchestrationHelper.count(
            event.pathParameters.id,
            event.pathParameters.orderid,
            itemOrchestrationHelper.getFilterParams(event)
          )
        ])
        .then(resultObj => {
          const response = {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              code: 200,
              message: 'Success',
              description: 'Order Item Orchestration List',
              totalRecords: resultObj[1],
              recordsCount: resultObj[0].length,
              data: akUtils.cleanFormatResponse(resultObj[0])
            })
          };
          mongoose.disconnect();
          callback(null, response);
        })
        .catch(error => {
          // console.log(error);
          const response = {
            statusCode: 404,
            headers: {
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              code: 404,
              message: 'No Records Found',
              description: 'No Records Found',
              data: []
            })
          };
          mongoose.disconnect();
          callback(null, response);
        });
    })
    .catch(err => {
      // console.log(err);
      const response = {
        statusCode: 403,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          code: 403,
          message: 'Not authorized to access this resource'
        })
      };
      callback(null, response);
    });
};

/**
 * Close an order.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.closeOrder = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const orderHelper = require('../helpers/order');
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    orderHelper
      .validateClose(event.pathParameters.id)
      .then(() => {
        orderHelper
          .closeOrder(event.pathParameters.id)
          .then(result => {
            const response = {
              statusCode: 200,
              headers: {
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                code: 200,
                message: 'Ok',
                description: 'Order closed successfully',
                data: {}
              })
            };
            mongoose.disconnect();
            callback(null, response);
          })
          .catch(error => {
            // console.log(error);
            const response = {
              statusCode: 304,
              headers: {
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                code: 304,
                message: 'Closed Failed',
                description: 'Closed Failed',
                data: {}
              })
            };
            mongoose.disconnect();
            callback(null, response);
          });
      })
      .catch(errors => {
        // console.log(errors);
        const response = {
          statusCode: 422,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 422,
            message: 'ValidationErrors',
            description: 'Validation Errors Occured',
            data: errors
          })
        };
        mongoose.disconnect();
        callback(null, response);
      });
  });
};
