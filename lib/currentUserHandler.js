class currentUserHandler {
  setCurrentUser(currentUserObj) {
    this.currentUser = currentUserObj;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getCurrentUserObject(event) {
    if (event.headers && event.headers.authorizer && Object.keys(event.headers.authorizer).length) {
      return {
        uuid: event.headers.authorizer.sub ? event.headers.authorizer.sub : '',
        firstName: event.headers.authorizer.given_name ? event.headers.authorizer.given_name : '',
        lastName: event.headers.authorizer.family_name ? event.headers.authorizer.family_name : '',
        email: event.headers.authorizer.email ? event.headers.authorizer.email : '',
        timezone: event.headers.authorizer.zoneinfo ? event.headers.authorizer.zoneinfo : 'UTC',
        preferredRole: event.headers.authorizer['cognito:preferred_role'].split('/')[1] || ''
      };
    }
    return {
      uuid: '',
      firstName: 'System',
      lastName: 'Operation',
      email: '',
      timezone: 'UTC'
    };
  }
}

module.exports = new currentUserHandler();
