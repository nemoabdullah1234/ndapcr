const commonHelper = require('../helpers/common');
const bluebirdPromise = require('bluebird');
const shipStatusMap = require('../mappings/shipmentStatus.json');
const akUtils = require('../lib/utility');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');
/** 
 * Get Shipment List
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getShipments = (event, context, callback) => {
  commonHelper
    .decryptDbURI()
    .then(dbURI => {
      event = commonHelper.parseLambdaEvent(event);
      clientHandler.setClient(clientHandler.getClientObject(event));
      currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
      const mongoose = require('mongoose');
      commonHelper.connectToDb(dbURI);
      const shipmentHelper = require('../helpers/shipment');
      bluebirdPromise
        .all([
          shipmentHelper.get({
            searchParams: shipmentHelper.getFilterParams(event),
            otherParams: shipmentHelper.getExtraParams(event),
            projectParams: shipmentHelper.getProjectParams(event)
          }),
          shipmentHelper.count({
            searchParams: shipmentHelper.getFilterParams(event),
            projectParams: shipmentHelper.getProjectParams(event)
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
              description: 'Shipment List',
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
 * Get Single shipment for specified ID
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getShipmentById = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    const shipmentHelper = require('../helpers/shipment');
    shipmentHelper
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
            description: 'Shipment fetched successfully',
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
 * Update an shipment.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */

module.exports.updateShipment = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const shipmentHelper = require('../helpers/shipment');
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    const scheduleStatus = event.body.scheduleStatus;
    event.body.products = Array.from(new Set((event.body.products || []).map(JSON.stringify))).map(
      JSON.parse
    );
    shipmentHelper
      .validateUpdate(event)
      .then(populatedTags => {
        event.body.tags = populatedTags.body.tags;
        shipmentHelper
          .update(event)
          .then(() =>
            // // console.log(result)
            shipmentHelper.getById(event.pathParameters.id)
          )
          .then(result => {
            if (scheduleStatus === 'Y' && event.pathParameters.id !== '') {
              shipmentHelper
                .schedule([event.pathParameters.id])
                .then(scheduleResult => {
                  const response = {
                    statusCode: 200,
                    headers: {
                      'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                      code: 200,
                      message: 'Ok',
                      description: 'Shipment scheduled successfully',
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
                      message: 'Scheduling Failed',
                      description: 'Scheduling Failed',
                      data: {}
                    })
                  };
                  mongoose.disconnect();
                  callback(null, response);
                });
            } else {
              const response = {
                statusCode: 200,
                headers: {
                  'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                  code: 200,
                  message: 'Ok',
                  description: 'Shipment updated successfully',
                  data: result
                })
              };
              mongoose.disconnect();
              callback(null, response);
            }
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
 * Save an shipment.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.saveShipment = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const shipmentHelper = require('../helpers/shipment');
    const mongoose = require('mongoose');
    const scheduleStatus = event.body.scheduleStatus;
    let shipId = '';
    commonHelper.connectToDb(dbURI);
    event.body.products = Array.from(new Set((event.body.products || []).map(JSON.stringify))).map(
      JSON.parse
    );
    shipmentHelper
      .validateRequest(event)
      .then(populatedEvent => {
        shipmentHelper
          .save(populatedEvent)
          .then(result => {
            shipId = result._id;
            return shipmentHelper.getById(result._id);
          })
          .then(result => {
            if (scheduleStatus === 'Y' && shipId !== '') {
              shipmentHelper
                .schedule([shipId])
                .then(scheduleResult => {
                  const response = {
                    statusCode: 200,
                    headers: {
                      'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                      code: 200,
                      message: 'Ok',
                      description: 'Shipment scheduled successfully',
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
                      message: 'Scheduling Failed',
                      description: 'Scheduling Failed',
                      data: {}
                    })
                  };
                  mongoose.disconnect();
                  callback(null, response);
                });
            } else {
              const response = commonHelper.formatResponse(
                201,
                'Ok',
                'Shipment saved successfully',
                result
              );
              mongoose.disconnect();
              callback(null, response);
            }
          })
          .catch(() => {
            // // console.log(error);
            const response = {
              statusCode: 400,
              headers: {
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                code: 400,
                message: 'Shipment create failed',
                description: 'Shipment create failed',
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
 * Set the status of shipment to scheduled.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.scheduleShipment = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const shipmentHelper = require('../helpers/shipment');
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    // shipmentHelper.validateUpdate(event).then((populatedTags) => {
    // event.body.tags = populatedTags.body.tags;
    shipmentHelper
      .schedule(event)
      // .then((result) => {
      //   // // console.log(result)
      //   return shipmentHelper.getById(event.pathParameters.id);
      // })
      .then(result => {
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 200,
            message: 'Ok',
            description: 'Shipment scheduled successfully',
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
            message: 'Scheduling Failed',
            description: 'Scheduling Failed',
            data: {}
          })
        };
        mongoose.disconnect();
        callback(null, response);
      });
    // }).catch((errors) => {
    //   // console.log(errors);
    //   const response = {
    //     statusCode: 422,
    //     headers: {
    //       'Access-Control-Allow-Origin': '*',

    //     },
    //     body: JSON.stringify({
    //       'code': 422,
    //       'message': 'ValidationErrors',
    //       'description': 'Validation Errors Occured',
    //       'data': errors
    //     }),

    //   };
    //   mongoose.disconnect();
    //   callback(null, response);
    // });
  });
};

/**
 * Get Shipment Orchestrations List
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.getShipmentOrchestrations = (event, context, callback) => {
  commonHelper
    .decryptDbURI()
    .then(dbURI => {
      event = commonHelper.parseLambdaEvent(event);
      clientHandler.setClient(clientHandler.getClientObject(event));
      currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
      const mongoose = require('mongoose');
      commonHelper.connectToDb(dbURI);
      const shipmentOrchestrationHelper = require('../helpers/shipmentOrchestration');
      bluebirdPromise
        .all([
          shipmentOrchestrationHelper.get(
            event.pathParameters.id,
            shipmentOrchestrationHelper.getFilterParams(event),
            shipmentOrchestrationHelper.getExtraParams(event)
          ),
          shipmentOrchestrationHelper.count(
            event.pathParameters.id,
            shipmentOrchestrationHelper.getFilterParams(event)
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
              description: 'Shipment Orchestration List',
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
module.exports.getShipmentsForMobile = (event, context, callback) => {
  commonHelper
    .decryptDbURI()
    .then(dbURI => {
      event = commonHelper.parseLambdaEvent(event);
      clientHandler.setClient(clientHandler.getClientObject(event));
      currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
      const mongoose = require('mongoose');
      commonHelper.connectToDb(dbURI);
      const shipmentHelper = require('../helpers/shipment');
      bluebirdPromise
        .all([
          shipmentHelper.getShipmentsForMobile(
            shipmentHelper.getFilterParams(event),
            shipmentHelper.getExtraParams(event)
          ),
          shipmentHelper.count({
            searchParams: shipmentHelper.getFilterParams(event),
            projectParams: shipmentHelper.getProjectParams(event)
          })
        ])
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
                readerGetShipmentsResponse: {
                  shipments: akUtils.cleanFormatResponse(resultObj[0])
                }
              },
              _links: {
                self: {
                  href: 'http://strykerapi.nicbitqc.ossclients.com/reader/getShipments'
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
module.exports.getShipmentForMobileById = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    const shipmentHelper = require('../helpers/shipment');
    shipmentHelper
      .getShipmentByIdForMobile(event.pathParameters.id)
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
              readerGetShipmentDetailsResponse: akUtils.cleanFormatResponse(result)
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
 * Get Single order for specified ID
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.pickShipment = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);
    const shipmentHelper = require('../helpers/shipment');
    const shipmentIdArray = event.body.shipments.map(x => x.shipmentNo);
    bluebirdPromise
      .each(shipmentIdArray, shipmentId =>
        shipmentHelper.setShipmentStatus(shipmentId, shipStatusMap.Shipped)
      )
      .then(() => {
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
              ReaderPickShipmentResponse: {}
            },
            _links: {
              self: {
                href: 'http://strykerapi.nicbit.ossclients.com/reader/pickShipment'
              }
            }
          })
        };
        mongoose.disconnect();
        callback(null, response);
      })
      .catch(err => {
        // console.log(err);
        const response = {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 1006,
            status: 0,
            message: 'Invalid Shipping No',
            data: {},
            _links: {
              self: {
                href: 'http://strykerapi.nicbit.ossclients.com/reader/pickShipment'
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
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.deliverShipment = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    const shipmentHelper = require('../helpers/shipment');
    const shipmentId = event.pathParameters.id;
    const deliveryDetails = event.body.deliveryDetails;
    const isAdminDelivered = event.body.isAdminDelivered || 0;
    shipmentHelper
      .getById(event.pathParameters.id)
      .then(result =>
        // Todo : validate shipment status
        shipmentHelper
          .setShipmentStatus(event.pathParameters.id, shipStatusMap.Delivered, {
            deliveryDetails,
            isAdminDelivered
          })
          .then(res => {
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
                  ReaderDeliverShipmentResponse: {}
                },
                _links: {
                  self: {
                    href: 'http://strykerapi.nicbit.ossclients.com/reader/deliverShipment'
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
                code: 1016,
                status: 0,
                message: 'Problem while delivering shipment',
                data: {},
                _links: {
                  self: {
                    href: 'http://strykerapi.nicbit.ossclients.com/reader/deliverShipment'
                  }
                }
              })
            };
            mongoose.disconnect();
            callback(null, response);
          })
      )
      .catch(e => {
        // console.log(e);
        const response = {
          statusCode: 404,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 404,
            status: 0,
            message: 'Invalid Shipping No',
            data: {},
            _links: {
              self: {
                href: 'http://strykerapi.nicbit.ossclients.com/reader/deliverShipment'
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
 * Update an order.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.carrierSearch = (event, context, callback) => {
  commonHelper
    .decryptDbURI()
    .then(dbURI => {
      event = commonHelper.parseLambdaEvent(event);
      clientHandler.setClient(clientHandler.getClientObject(event));
      currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
      const mongoose = require('mongoose');
      commonHelper.connectToDb(dbURI);
      const shipmentHelper = require('../helpers/shipment');
      shipmentHelper
        .searchShipmentsAndProductsForMobile(event)
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
                readerSearchShipmentsResponse: akUtils.cleanFormatResponse(resultObj)
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
                readerSearchShipmentsResponse: []
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
 * Cancel shipment.
 * 
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.cancelShipment = (event, context, callback) => {
  commonHelper.decryptDbURI().then(dbURI => {
    event = commonHelper.parseLambdaEvent(event);
    clientHandler.setClient(clientHandler.getClientObject(event));
    currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
    const shipmentHelper = require('../helpers/shipment');
    const mongoose = require('mongoose');
    commonHelper.connectToDb(dbURI);

    shipmentHelper
      .validateCancelShipment(event.pathParameters.id)
      .then(() => {
        shipmentHelper
          .cancelShipment(event.pathParameters.id)
          .then(result => {
            const response = {
              statusCode: 200,
              headers: {
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                code: 200,
                message: 'Ok',
                description: 'Shipment Canceled successfully',
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
 * @param {Object} event event passed to the lambda
 * @param {Object} context context passed to the lambda
 * @callback callback Lambda Callback
 */
module.exports.bulkOperation = (event, context, callback) => {
  commonHelper
    .decryptDbURI()
    .then(dbURI => {
      event = commonHelper.parseLambdaEvent(event);
      clientHandler.setClient(clientHandler.getClientObject(event));
      currentUserHandler.setCurrentUser(currentUserHandler.getCurrentUserObject(event));
      const mongoose = require('mongoose');
      commonHelper.connectToDb(dbURI);

      const shipmentHelper = require('../helpers/shipment');
      const deliveryDetails = event.body.deliveryDetails;
      shipmentHelper
        .bulkOperation({
          event
        })
        .then(result => {
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
                ReaderShipmentBulkOperationResponse: {}
              },
              _links: {
                self: {
                  href: 'http://strykerapi.nicbit.ossclients.com/reader/bulkOperation'
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
            statusCode: 422,
            headers: {
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              code: 422,
              status: 0,
              message: 'Error Encountered',
              data: e,
              _links: {
                self: {
                  href: 'http://strykerapi.nicbit.ossclients.com/reader/bulkOperation'
                }
              }
            })
          };
          mongoose.disconnect();
          callback(null, response);
        });
    })
    .catch(e => {
      // console.log(e);
      const response = {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          code: 404,
          status: 0,
          message: 'Error Encountered',
          data: e,
          _links: {
            self: {
              href: 'http://strykerapi.nicbit.ossclients.com/reader/bulkOperation'
            }
          }
        })
      };
      callback(null, response);
    });
};
