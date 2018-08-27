const bluebirdPromise = require('bluebird');
const exporterLib = require('../lib/exporter');
const s3Lib = require('../lib/aws/s3');
const emailHelper = require('../helpers/emails');

const helperPath = './';
const dataFetcher = require('../lib/exportDataFetcher');
const lambdaLib = new (require('../lib/aws/lambda'))();
const configHelper = require('./configuration');
const currentUserHandler = require('../lib/currentUserHandler');
const clientHandler = require('../lib/clientHandler');
const akUtils = require('../lib/utility');
// const json2csv = require('json2csv');
// const fsPromisified = bluebirdPromise.promisifyAll(require('fs'));
// const jsonexport = bluebirdPromise.promisifyAll(require('jsonexport'));

// const newLine = '\r\n';

class Export {
  constructor() {
    this.config = {};
    // TODO: move to env variable
    this.config.recordsPerQuery = 5000;
  }

  castObjectKeysToString(object) {
    for (const i in object) {
      if (object.hasOwnProperty(i)) {
        object[i] = String(object[i]);
      }
    }
    return object;
  }
  initiateExport({ entity, format, queryParams, pathParams, entityDisplayName }) {
    const initiateParams = {
      entity,
      format,
      queryParams,
      pathParams,
      entityDisplayName,
      client: clientHandler.getClient(),
      requestedBy: currentUserHandler.getCurrentUser()
    };
    return lambdaLib.promisifiedExecuteAsync(
      process.env.exporterLambda,
      initiateParams,
      process.env.stage
    );
  }

  export({ entity, queryParams, pathParams, format, entityDisplayName }) {
    if (!dataFetcher[entity]) {
      return bluebirdPromise.reject(new Error('invalid type'));
    }
    pathParams = this.castObjectKeysToString(pathParams || {});
    queryParams = this.castObjectKeysToString(queryParams) || {};
    queryParams.limit = `${this.config.recordsPerQuery}`;
    queryParams.offset = '0';
    const helper = require(helperPath + dataFetcher[entity].helperName);

    return bluebirdPromise
      .resolve()
      .then(() => {
        if (dataFetcher[entity].type === 'master') {
          return this.exportMasterData(helper, queryParams, pathParams, entity);
        } else if (dataFetcher[entity].type === 'report') {
          const functionName = dataFetcher[entity].functionName;
          return this.exportReportData(helper, functionName, queryParams, pathParams, entity);
        } else if (dataFetcher[entity].type === 'ordershipment') {
          return this.exportOrderShipmentData(helper, queryParams, pathParams, entity);
        }
        return bluebirdPromise.reject('Entity Type not supported');
      })
      .then(data => {
        this.doExport({
          data,
          entity,
          format,
          entityDisplayName
        });
      });
  }

  getReportCount(helper, functionName, queryParams, pathParams) {
    const queryStringParameters = JSON.parse(JSON.stringify(queryParams || {}));
    queryStringParameters.offset = '0';
    queryStringParameters.limit = '1';
    return helper[functionName]({ queryStringParameters, pathParameters: pathParams || {} })
      .then(result => result[1] || 0)
      .catch(() => 0);
  }

  getReportData(helper, functionName, queryParams, pathParams) {
    return helper[functionName]({
      queryStringParameters: queryParams,
      pathParameters: pathParams || {}
    })
      .then(result => result[0] || [])
      .catch(e => {
        akUtils.log(e, 'getReportData error');
        return [];
      });
  }

  exportReportData(helper, functionName, queryParams, pathParams, entity) {
    return configHelper.getDateTimeFormat().then(dateTimeFormat =>
      this.getReportCount(helper, functionName, queryParams, pathParams).then(count => {
        akUtils.log(count, 'count');
        const offsets = this.getOffsetList(count);
        return bluebirdPromise
          .map(offsets, offset => {
            queryParams.offset = `${offset}`;
            return this.getReportData(helper, functionName, queryParams, pathParams).then(data =>
              data.map(x =>
                dataFetcher[entity].mappingFn(
                  x,
                  (currentUserHandler.getCurrentUser() || {}).timezone,
                  dateTimeFormat
                )
              )
            );
          })
          .then(data => data.reduce((result, x) => [...result, ...x], []));
      })
    );
  }

  getMasterData(helper, queryParams, pathParams) {
    return helper
      .get(
        helper.getFilterParams({
          queryStringParameters: queryParams || {},
          pathParameters: pathParams || {}
        }),
        helper.getExtraParams({
          queryStringParameters: queryParams || {},
          pathParameters: pathParams || {}
        })
      )
      .catch(e => {
        akUtils.log(e, 'getmasterData error');
        return [];
      });
  }

  getMasterCount(helper, queryParams, pathParams) {
    const queryStringParameters = JSON.parse(JSON.stringify(queryParams || {}));
    queryStringParameters.offset = '0';
    queryStringParameters.limit = '1';
    return helper.count(
      helper.getFilterParams({ queryStringParameters, pathParameters: pathParams || {} })
    );
  }

  exportMasterData(helper, queryParams, pathParams, entity) {
    return configHelper.getDateTimeFormat().then(dateTimeFormat =>
      this.getMasterCount(helper, queryParams, pathParams).then(count => {
        akUtils.log(count, 'count');
        const offsets = this.getOffsetList(count);
        return bluebirdPromise
          .map(offsets, offset => {
            queryParams.offset = `${offset}`;
            return this.getMasterData(helper, queryParams, pathParams).then(data =>
              data.map(x =>
                dataFetcher[entity].mappingFn(
                  x,
                  currentUserHandler.getCurrentUser().timezone,
                  dateTimeFormat
                )
              )
            );
          })
          .then(data => data.reduce((result, x) => [...result, ...x], []));
      })
    );
  }

  getOffsetList(totalRecordCount, recordsPerQuery = this.config.recordsPerQuery) {
    const iterationsRequired = Math.ceil(totalRecordCount / recordsPerQuery);
    const offsets = [];
    for (let i = 0; i < iterationsRequired; i++) {
      offsets.push(i * this.config.recordsPerQuery);
    }

    return offsets;
  }

  exportOrderShipmentData(helper, queryParams, pathParams, entity) {
    return configHelper.getDateTimeFormat().then(dateTimeFormat =>
      this.getOrderShipmentCount(helper, queryParams, pathParams).then(count => {
        akUtils.log(count, 'count');
        const offsets = this.getOffsetList(count);
        return bluebirdPromise
          .map(offsets, offset => {
            queryParams.offset = `${offset}`;
            return this.getOrderShipmentData(helper, queryParams, pathParams).then(data =>
              data.map(x =>
                dataFetcher[entity].mappingFn(
                  x,
                  (currentUserHandler.getCurrentUser() || {}).timezone,
                  dateTimeFormat
                )
              )
            );
          })
          .then(data => data.reduce((result, x) => [...result, ...x], []));
      })
    );
  }

  getOrderShipmentCount(helper, queryParams, pathParams) {
    const queryStringParameters = JSON.parse(JSON.stringify(queryParams || {}));
    queryStringParameters.offset = '0';
    queryStringParameters.limit = '1';
    return helper.count({
      searchParams: helper.getFilterParams({
        queryStringParameters,
        pathParameters: pathParams || {}
      }),
      projectParams: helper.getProjectParams({
        queryStringParameters,
        pathParameters: pathParams || {}
      })
    });
  }

  getOrderShipmentData(helper, queryParams, pathParams) {
    return helper.get({
      searchParams: helper.getFilterParams({
        queryStringParameters: queryParams || {},
        pathParameters: pathParams || {}
      }),
      otherParams: helper.getExtraParams({
        queryStringParameters: queryParams || {},
        pathParameters: pathParams || {}
      }),
      projectParams: helper.getProjectParams({
        queryStringParameters: queryParams || {},
        pathParameters: pathParams || {}
      })
    });
  }

  doExport({ data, entity, format, filename, entityDisplayName, dontSendEmail }) {
    const exportFormat = format;
    let contentType = '';
    const exportedEntityDisplayName = entityDisplayName || entity;
    const dataToExport = data;
    const fileName =
      filename ||
      `${exportedEntityDisplayName}-${currentUserHandler.getCurrentUser().uuid}-${Date.now()}`;
    return bluebirdPromise
      .resolve()
      .then(() => {
        switch (exportFormat) {
          case 'csv':
            contentType = 'application/vnd.ms-excel';
            return exporterLib.csv(dataToExport, fileName);
          default:
            return bluebirdPromise.reject('Invalid Type');
        }
      })
      .then(result =>
        s3Lib.writeFileToS3({
          access: 'public-read',
          localFilePath: result.path,
          contentType,
          outputFileName: `${fileName}.${exportFormat}`,
          bucketName: `${process.env.docBucket}/${process.env.exportsFolderName}/${exportFormat}`
        })
      )
      .then(result => {
        if (!dontSendEmail) {
          return this.sendExportCompleteMail({
            exportedEntity: entity,
            exportedEntityDisplayName,
            fileURL: result.url
          }).then(() => result);
        }
        return result;
      });
  }

  sendExportCompleteMail({
    exportedEntity,
    exportedEntityDisplayName,
    userName,
    userEmail,
    fileURL
  }) {
    return emailHelper.sendEmail(
      userEmail || (currentUserHandler.getCurrentUser() || {}).email,
      `Your ${exportedEntityDisplayName} export is complete`,
      'export-complete',
      {
        name:
          userName ||
          `${(currentUserHandler.getCurrentUser() || {}).firstName ||
            ''} ${(currentUserHandler.getCurrentUser() || {}).lastName || ''}`.trim(),
          exportedEntityDisplayName: exportedEntityDisplayName || exportedEntity,
        url: fileURL
      }
    );
  }
}

module.exports = Export;
