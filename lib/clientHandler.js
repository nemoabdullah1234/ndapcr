class clientHandler {
  setClient(clientObj) {
    this.client = clientObj;
  }

  getClient() {
    return this.client;
  }

  addClientFilterToConditions(conditions) {
    if (!this.client) {
      throw new Error('Client not set');
    }
    conditions['client.clientId'] = this.client.clientId;
    conditions['client.projectId'] = this.client.projectId;
    return conditions;
  }

  getClientObject(event) {
    if (
      event.headers &&
      event.headers.authorizer &&
      Object.getOwnPropertyNames(event.headers.authorizer).length
    ) {
      return {
        clientId: event.headers.authorizer.clientId,
        projectId: event.headers.authorizer.projectId
      };
    }
    return {
      clientId: process.env.accountNo,
      projectId: process.env.cognitoUserpoolId
    };
  }
}

module.exports = new clientHandler();
