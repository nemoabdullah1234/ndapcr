class DependencyHelper {
  create(options) {
    this.opts = options;
  }

  setClient(clientObj) {
    this.client = clientObj;
  }

  findDependentCount({ entity, id }) {
    const allowedEntities = [
      'attributes',
      'categories',
      'tags',
      'things',
      'beacons',
      'products',
      'locations',
      'gateways',
      'devices'
    ];
    if (!new Set(allowedEntities).has(entity)) {
      return this.opts.bbPromise.reject(new Error('Invalid Entity'));
    }

    if (!this.opts.mongoose.Types.ObjectId.isValid(id)) {
      return this.opts.bbPromise.reject(new Error('Invalid ID'));
    }

    if (new Set(['things', 'beacons', 'gateways', 'devices']).has(entity)) {
      entity = 'things';
    }

    return this.opts.commonHelper.findDependencyCount(entity, id);
  }
}

module.exports = new DependencyHelper();
