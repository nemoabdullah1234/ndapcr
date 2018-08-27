module.exports.dashboard = (event, context, callback) => {
  const response = {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      code: 200,
      message: 'Success',
      description: 'Dashboard List',
      data: {
        totalIn: 14400000,
        activities: []
      }
    })
  };
  callback(null, response);
};

module.exports.detail = (event, context, callback) => {
  const response = {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      code: 200,
      message: 'Success',
      description: 'Dashboard List',
      data: [
        {
          inTime: '09:00 AM',
          outTime: '11:30 AM',
          name: 'PlaceName',
          type: 'location'
        },
        {
          inTime: '12:00 AM',
          outTime: '2:30 AM',
          name: 'PlaceName',
          type: 'location'
        },
        {
          inTime: '3:00 AM',
          outTime: '4:30 AM',
          name: 'PlaceName',
          type: 'location'
        }
      ]
    })
  };
  callback(null, response);
};

module.exports.history = (event, context, callback) => {
  const response = {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      code: 200,
      message: 'Success',
      description: 'Dashboard List',
      data: [
        {
          firstIn: '09:00 AM',
          lastOut: '11:30 AM',
          totalIn: 900000,
          date: '23 Oct 2017'
        },
        {
          firstIn: '12:00 AM',
          lastOut: '2:30 AM',
          totalIn: 720000,
          date: '22 Oct 2017'
        },
        {
          firstIn: '3:00 AM',
          lastOut: '4:30 AM',
          totalIn: 360000,
          date: '21 Oct 2017'
        }
      ]
    })
  };
  callback(null, response);
};

module.exports.locations = (event, context, callback) => {
  const response = {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      code: 200,
      message: 'Success',
      description: 'Dashboard List',
      data: [
        {
          id: 'abcdef1',
          code: 'LOC1CODE',
          name: 'Location 1 Name',
          coordinates: {
            latitude: 23,
            longitude: 78
          },
          radius: 50,
          address: 'Address 1',
          city: 'City 1',
          state: 'State 1',
          country: 'Country 1',
          zipcode: 'Zipcode 1'
        },
        {
          id: 'abcdef2',
          code: 'LOC2CODE',
          name: 'Location 2 Name',
          coordinates: {
            latitude: 24,
            longitude: 78
          },
          radius: 500,
          address: 'Address 2',
          city: 'City 2',
          state: 'State 2',
          country: 'Country 2',
          zipcode: 'Zipcode 2'
        },
        {
          id: 'abcdef3',
          code: 'LOC3CODE',
          name: 'Location 3 Name',
          coordinates: {
            latitude: 23,
            longitude: 79
          },
          radius: 200,
          address: 'Address 3',
          city: 'City 3',
          state: 'State 3',
          country: 'Country 3',
          zipcode: 'Zipcode 3'
        }
      ]
    })
  };
  callback(null, response);
};
