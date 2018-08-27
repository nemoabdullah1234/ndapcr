/* jshint esversion: 6 */

const sg = require('sendgrid')(process.env.SENDGRID_API_KEY);
const EmailTemplate = require('email-templates').EmailTemplate;
const path = require('path');

const bluebirdPromise = require('bluebird');

const emailsService = function() {};

/**
 * Set client of the helper for use across all functions in the helper
 * 
 * @param {Object} clientObj
 * @return {Void}
 * 
 */
emailsService.prototype.setClient = function(clientObj) {
  this.client = clientObj;
};
/**
 * Query the database to fetch attributes on the basis of search parameters and other parameters
 * 
 * @param {Object} searchParams search filters
 * @param {Object} otherParams pagination, sorting etc other params.
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */
emailsService.prototype.getEmailTemplate = function(action, data) {
  const templateDir = path.join(__dirname, '../email-templates', action);
  const emailTemplateData = new EmailTemplate(templateDir);
  return emailTemplateData.render(data, (err, result) => result.html);
};
/**
 * Query the database to fetch attributes on the basis of search parameters and other parameters
 * 
 * @param {Object} searchParams search filters
 * @param {Object} otherParams pagination, sorting etc other params.
 * @return {Promise} Promise to represent the result of get operation.
 * 
 */

emailsService.prototype.sendEmail = function(to_email, email_subject, action, data) {
  data.adminurl = process.env.adminurl;
  data.footerText = process.env.footerText;
  data.salutationText = process.env.salutationText;
  data.companyName = process.env.companyName;
  data.companyLogo = process.env.companyLogo;

  const templateDir = path.join(__dirname, '../email-templates', action);
  const emailTemplateData = new EmailTemplate(templateDir);
  return emailTemplateData.render(data, (err, result) => {
    // // Sendgrid Example /////
    const request = sg.emptyRequest({
      method: 'POST',
      path: '/v3/mail/send',
      body: {
        personalizations: [
          {
            to: [
              {
                email: to_email
              }
            ],
            subject: email_subject
          }
        ],
        from: {
          email: process.env.EMAIL_FROM_ADDRESS
        },
        content: [
          {
            type: 'text/html',
            value: result.html
          }
        ]
      }
    });

    // With promise
    return sg
      .API(request)
      .then(response => {
        const respose_data = {
          description: response
        };
        return bluebirdPromise.resolve(respose_data);
      })
      .catch(error => {
        const respose_data = {
          description: error.response
        };
        return bluebirdPromise.resolve(respose_data);
      });
  });
};

module.exports = new emailsService();
