const jsTypeChecker = require('javascript-type-checker');
// const AkUtils = require('./utility');

class Validator {
  /**
   * Creates an instance of Validator.
   * @memberof Validator
   */
  constructor() {
    this.required.bind(this);
    this.type.bind(this);
    this.required.bind(this);
    this.required.bind(this);
    this.required.bind(this);
    this.urlRegex =
      'https?://(?:www.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9].[^s]{2,}|www.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9].[^s]{2,}|https?://(?:www.|(?!www))[a-zA-Z0-9].[^s]{2,}|www.[a-zA-Z0-9].[^s]{2,}';
  }

  required(data) {
    if (data) {
      return {
        status: true,
        validatorErrors: {}
      };
    }
    return {
      status: false,
      validatorErrors: {
        eCode: 'ak-required-check-fail',
        data
      }
    };
  }

  type(requiredType = '', data = '') {
    if (jsTypeChecker.getType(data) === requiredType) {
      return {
        status: true,
        validatorErrors: {}
      };
    }
    return {
      status: false,
      validatorErrors: {
        eCode: 'ak-type-check-fail',
        data,
        requiredType
      }
    };
  }

  regex(regex = '', dataString = '') {
    if (!jsTypeChecker.isString(dataString)) {
      throw 'data must be a string';
    }
    if (!jsTypeChecker.isString(regex)) {
      throw new Error('regex must be a string');
    }
    const regexp = new RegExp(regex);
    if (regexp.test(dataString)) {
      return {
        status: true,
        validatorErrors: {}
      };
    }

    return {
      status: false,
      validatorErrors: {
        eCode: 'ak-regex-check-fail',
        regex,
        data: dataString
      }
    };
  }

  range(minValue = 0, maxValue = 0, data = 0) {
    if (!jsTypeChecker.isNumber(minValue)) {
      throw new Error('minValue must be a number');
    }
    if (!jsTypeChecker.isNumber(maxValue)) {
      throw new Error('maxValue must be a number');
    }
    if (minValue > maxValue) {
      throw new Error('minValue cannot be greater than maxValue');
    }
    if (!jsTypeChecker.isNumber(data)) {
      throw new Error('data must be a number');
    }

    if (data >= minValue && data <= maxValue) {
      return {
        status: true,
        validatorErrors: {}
      };
    }

    return {
      status: false,
      validatorErrors: {
        eCode: 'ak-range-check-fail',
        minValue,
        maxValue,
        data
      }
    };
  }

  valueAllowed(allowedValues, data) {
    if (!jsTypeChecker.isArray(allowedValues)) {
      throw new Error('allowedValues must be an array');
    }
    if (new Set(allowedValues).has(data)) {
      return {
        status: true,
        validatorErrors: {}
      };
    }
    return {
      status: false,
      validatorErrors: {
        eCode: 'ak-valueAllowed-check-fail',
        allowedValues,
        data
      }
    };
  }

  stringLength(minLength = 0, maxLength = 0, data = '') {
    if (!jsTypeChecker.isNumber(minLength)) {
      throw new Error('minLength must be a number');
    }
    if (!jsTypeChecker.isNumber(maxLength)) {
      throw new Error('maxLength must be a number');
    }
    if (minLength > maxLength) {
      throw new Error('minLength cannot be greater than maxLength');
    }
    if (!jsTypeChecker.isString(data)) {
      throw new Error('data must be a string');
    }

    if (data.length >= minLength && data.length <= maxLength) {
      return {
        status: true,
        validatorErrors: {}
      };
    }

    return {
      status: false,
      validatorErrors: {
        eCode: 'ak-stringLength-check-fail',
        minLength,
        maxLength,
        data
      }
    };
  }

  getErrorMessage(validatorErrorsObj, fieldName) {
    const eCode = validatorErrorsObj.eCode;
    let message = '';
    switch (eCode) {
      case 'ak-required-check-fail':
        message = `${fieldName} is mandatory`;
        break;
      case 'ak-type-check-fail':
        message = `Invalid ${fieldName}(only ${validatorErrorsObj.requiredType}s are allowed)`;
        break;
      case 'ak-regex-check-fail':
        message = `Invalid ${fieldName}`;
        break;
      case 'ak-range-check-fail':
        message = `Invalid ${fieldName}(must be between ${validatorErrorsObj.minValue} and ${validatorErrorsObj.maxValue})`;
        break;
      case 'ak-valueAllowed-check-fail':
        message = `Invalid ${fieldName}`;
        break;
      case 'ak-stringLength-check-fail':
        if (validatorErrorsObj.minLength === 0) {
          message = `${fieldName} cannot be more than ${validatorErrorsObj.maxLength} characters`;
        } else {
          message = `${fieldName} must be between ${validatorErrorsObj.minLength} and ${validatorErrorsObj.maxLength} characters`;
        }
    }

    return message;
  }
}

module.exports = new Validator();
