// const commonHelper = require('./common');
const validator = require('../lib/validatorAsync');
const akUtils = require('../lib/utility');
const bluebirdPromise = require('bluebird');
const clientHandler = require('../lib/clientHandler');
const currentUserHandler = require('../lib/currentUserHandler');
const gadgetPositionModel = require('../models/gadgetposition');
const availableGadgetsModel = require('../models/availablegadget');
const jsTypeChecker = require('javascript-type-checker');

class Gadget {
  /* constructor() {} */

  validateUpdate(event) {
    return this.commonValidations(event)
      .then(() => {})
      .catch(errors => {
        if (!jsTypeChecker.isEmptyObject(errors)) {
          return bluebirdPromise.reject(
            akUtils.getObjectValues(akUtils.sortErrorsObject(errors, 'attributes'))
          );
        }
        return bluebirdPromise.resolve();
      });
  }

  getAvailableGadgets() {
    let conditions = {};
    conditions = clientHandler.addClientFilterToConditions(conditions);
    return availableGadgetsModel.findOne(conditions).then(result => {
      if (!result) {
        return [];
      }
      return (result.gadgets || []).map(x => {
        x.id = `${x._id}`;
        x._id = undefined;
        return x;
      });
    });
  }
  commonValidations(event) {
    return bluebirdPromise
      .all([
        bluebirdPromise.all([
          validator.required(event.body.displayScheme),
          validator.type('string', event.body.displayScheme)
        ])
      ])
      .then(result => {
        const validatorErrorsMap = {
          displayScheme: {
            index: 0,
            fieldName: 'displayScheme'
          }
        };
        const errors = akUtils.mapAndGetValidationErrors(result, validatorErrorsMap);
        if (errors) {
          return bluebirdPromise.reject(errors);
        }
        return bluebirdPromise.resolve();
      });
  }

  getCurrentUserGadgetPositioning() {
    let filters = {};
    // TODO: uncomment after custom authorizer works
    filters = clientHandler.addClientFilterToConditions(filters);
    filters['user.uuid'] = currentUserHandler.getCurrentUser().uuid;
    return gadgetPositionModel
      .findOne(filters)
      .exec()
      .then(result => {
        if (!result) {
          return this.saveCurrentUserDefaultPositioning().then(() =>
            gadgetPositionModel.findOne(filters).exec()
          );
        }
        return result;
      })
      .then(result => this.formatResponse(result));
  }

  saveCurrentUserGadgetPosition(event) {
    // console.log(event.body);

    let filters = {};
    // TODO: uncomment after custom authorizer works
    filters = clientHandler.addClientFilterToConditions(filters);
    filters['user.uuid'] = currentUserHandler.getCurrentUser().uuid;
    const gadgetPositionObj = {};
    gadgetPositionObj.displayScheme = event.body.displayScheme || '';
    gadgetPositionObj.position = event.body.position;
    gadgetPositionObj.client = clientHandler.getClient();
    gadgetPositionObj.user = currentUserHandler.getCurrentUser();
    gadgetPositionObj.updatedOn = new Date();
    return gadgetPositionModel
      .findOneAndUpdate(filters, { $set: gadgetPositionObj }, { upsert: false, new: true })
      .exec();
  }

  saveCurrentUserDefaultPositioning() {
    const gadgetPositionObj = new gadgetPositionModel();
    gadgetPositionObj.displayScheme = 'default';
    gadgetPositionObj.position = {
      leftSection: [],
      rightSection: []
    };
    gadgetPositionObj.client = clientHandler.getClient();
    gadgetPositionObj.user = currentUserHandler.getCurrentUser();
    gadgetPositionObj.updatedOn = new Date();
    return gadgetPositionObj.save();
  }

  formatResponse(data) {
    return {
      displayScheme: data.displayScheme || '',
      position: data.position
    };
  }
}

module.exports = new Gadget();
