/*jshint esversion: 6 */
'use strict';
var MongoClient = require('mongodb').MongoClient,
  format = require('util').format;

//var mongo = require('mongodb');
//var o_id = new mongo.ObjectID();

//connect away
MongoClient.connect('mongodb://127.0.0.1:27017/nodeCollection2', function(err, db) {
  if (err) {
    throw err;
  }
  var existingColl = [];

  var collectionArr = [];
  collectionArr['product'] = ['price', 'url', 'videoUrl', 'description', 'images'];
  collectionArr['things'] = [
    'master',
    'battery_level',
    'last_connection',
    'rssi',
    'interval',
    'uuid',
    'major',
    'minor',
    'manufacturer'
  ];
  collectionArr['location'] = [
    'address',
    'city',
    'state',
    'country',
    'zipcode',
    'radius',
    'phone',
    'fax'
  ];
  collectionArr['orders'] = ['price', 'patient', 'notes', 'surgeon', 'surgery'];
  var d = new Date();
  var n = d.toISOString();

  /*
    db.createCollection("Attribute", function(err, collection){
        if (err) throw err;
           // console.log("Created Attribute");
           collection.insert(AttributeJson, {w: 1}, function(err, records){
               if (err) throw err;
               // console.log(records);
        });
    });*/

  attributeCollection = [];

  var counter = 0;
  var returnIds = [];
  var itemArr = [];
  for (let i in collectionArr) {
    for (let j in collectionArr[i]) {
      if (itemArr.indexOf(collectionArr[i][j]) < 0) {
        attribute = {};
        //attributeArray['_id'] = new mongo.ObjectID();
        attribute.client = {};
        attribute.name = collectionArr[i][j];
        attribute.code = collectionArr[i][j];
        attribute.status = 1;
        attribute.sysDefined = 1;
        attribute.tags = [];
        attributeCollection.push(attribute);
        itemArr.push(collectionArr[i][j]);
      }
    }
  }
  //// console.log(itemArr);
  var count = 0;
  var collectionNew = [];
  var itemIdArr = [];
  db.listCollections({ name: 'attributes' }).next(function(err, collinfo) {
    if (collinfo) {
      db.collection('attributes').drop(function(err, result) {
        if (err) throw err;
      });
    }
  });

  /*db.createCollection("attributes", function(err, collection){
        if (err) throw err;
        collection.insertMany(attributeCollection, {w: 1}, function(err, records){
            if (err) throw err;
            // console.log("3");
            records.ops.forEach( function (arrayItem)
            {
                itemIdArr[arrayItem.name] = arrayItem._id;
            });
        });
    });*/

  db.createCollection('attributes', function(err, collection) {
    if (err) throw err;
    collection.insertMany(attributeCollection, { w: 1 }, function(err, records) {
      if (err) throw err;
      records.ops.forEach(function(arrayItem) {
        itemIdArr[arrayItem.name] = arrayItem._id;
      });
      for (let i in collectionArr) {
        // console.log(i);
        db.listCollections({ name: i }).next(function(err, collinfo) {
          if (collinfo) {
            db.collection(i).drop(function(err, result) {
              if (err) throw err;
            });
          }
          db.createCollection(i, function(err, collection) {
            if (err) throw err;
            collectionNew = [];
            var collectionObj = {};
            collectionObj.code = i + '_required';
            collectionObj.name = i + '_system_attributes';
            collectionObj.sysDefined = 1;
            collectionObj.status = 1;
            collectionObj.updatedBy = '1001';
            collectionObj.updatedOn = n;
            collectionObj.type = 'attributes';
            collectionObj.client = {};
            collectionObj.tags = [];
            collectionObj.parent = '';
            collectionObj.seoName = i + '_system_attributes';
            collectionObj.items = [];
            for (let j in collectionArr[i]) {
              itemObj = {};
              itemObj.name = collectionArr[i][j];
              itemObj.id = itemIdArr[collectionArr[i][j]];
              collectionObj.items.push(itemObj);
            }
            collectionNew.push(collectionObj);
            collection.insertMany(collectionNew, { w: 1 }, function(err, records) {
              if (err) throw err;
              //// console.log(records);
            });
          });
        });
      }
    });
  });

  /*for(var prop in collectionArr) {
        if(collectionArr.hasOwnProperty(prop)){
            // console.log(prop + ': ' + collectionArr[prop]);
        } 
    }*/
  /*for (let i in collectionArr) {
        db.listCollections({name: collectionArr[i]}).next(function(err, collinfo) {
            if (!collinfo) {
                db.createCollection(collectionArr[i], function(err, collection){
                    if (err) throw err;
                       // console.log("Created "+ collectionArr[i]);
                       collection.insert(collectionArr[i]+Json, {w: 1}, function(err, records){
                    });
                });
            }
        });
    }*/
});
