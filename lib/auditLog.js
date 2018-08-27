class AuditLog {
  constructor() {
    this.auditLogLib = require('audit-log');
  }

  addMongooseTransport(dbUri) {
    this.auditLogLib.addTransport('mongoose', { connectionString: dbUri, debug: true });
  }

  attachModel(schema, modelName, namePath) {
    const pluginFn = this.auditLogLib.getPlugin('mongoose', {
      modelName,
      namePath
    });
    schema.plugin(pluginFn.handler);
  }
}

module.exports = new AuditLog();
