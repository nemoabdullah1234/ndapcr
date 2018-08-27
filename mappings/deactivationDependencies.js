module.exports = {
  dependencies: {
    attributes: [
      { model: 'products', paths: ['attributes'], additionalConditions: {} },
      { model: 'things', paths: ['attributes'], additionalConditions: {} },
      { model: 'kollections', paths: ['items'], additionalConditions: {} },
      { model: 'locations', paths: ['attributes'], additionalConditions: {} },
      { model: 'orders', paths: ['attributes'], additionalConditions: {} },
      {
        model: 'shipments',
        paths: ['attributes', 'deliveryDetails.attributes'],
        additionalConditions: {}
      }
    ],
    categories: [
      { model: 'categories', paths: ['ancestors'], additionalConditions: {} },
      { model: 'products', paths: ['categories'], additionalConditions: {} },
      { model: 'things', paths: ['categories'], additionalConditions: {} },
      { model: 'kollections', paths: ['items'], additionalConditions: {} },
      { model: 'locations', paths: ['categories'], additionalConditions: {} }
    ],
    products: [
      { model: 'products', paths: ['ancestors'], additionalConditions: {} },
      // { model: 'things', paths: ['product'], additionalConditions: {} },
      // { model: 'productThingAssignment', paths: ['product'], additionalConditions: {} },
      { model: 'kollections', paths: ['items'], additionalConditions: {} },
      { model: 'orders', paths: ['products'], additionalConditions: {} },
      { model: 'shipments', paths: ['products'], additionalConditions: {} }
    ],
    things: [
      { model: 'products', paths: ['things'], additionalConditions: {} },
      { model: 'locations', paths: ['things'], additionalConditions: {} },
      { model: 'users', paths: ['things'], additionalConditions: {} }
      // { model: 'productThingAssignment', paths: ['thing'], additionalConditions: {} }
    ],
    locations: [
      {
        model: 'products',
        paths: ['location', 'location.floor', 'location.floor.zone'],
        additionalConditions: {}
      },
      // { model: 'things', paths: ['location'], additionalConditions: {} },
      { model: 'locations', paths: ['ancestors'], additionalConditions: {} },
      { model: 'orders', paths: ['addresses.location'], additionalConditions: {} },
      {
        model: 'shipments',
        paths: ['addresses.location', 'addresses.location'],
        additionalConditions: {}
      }
    ],
    tags: [
      { model: 'attributes', paths: ['tags'], additionalConditions: {} },
      { model: 'categories', paths: ['tags'], additionalConditions: {} },
      { model: 'products', paths: ['tags'], additionalConditions: {} },
      { model: 'kollections', paths: ['tags', 'items'], additionalConditions: {} },
      { model: 'locations', paths: ['tags'], additionalConditions: {} },
      { model: 'orders', paths: ['tags'], additionalConditions: {} },
      { model: 'shipments', paths: ['tags'], additionalConditions: {} },
      { model: 'things', paths: ['tags'], additionalConditions: {} }
    ]
  },
  modelFilePaths: {
    attributes: 'attribute',
    categories: 'category',
    products: 'product',
    kollections: 'kollection',
    things: 'things',
    locations: 'location',
    orders: 'order',
    shipments: 'shipment',
    productThingAssignment: 'productThingAssignment',
    tags: 'tags'
  }
};
