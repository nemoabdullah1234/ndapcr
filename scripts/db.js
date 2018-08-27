"use strict";

let fs = require('fs');
let mongo = require('mongodb').MongoClient;

class database {
    constructor(fs, mongo, database) {
        //this._database = database;
        this._dbUri = 'mongodb://127.0.0.1:27017/' + database;
        this._mongoClient = mongo;
        this._mappingFile = "./../config/database-structure/db.json";
        this._mapping = null;
        this._fs = fs;

        let Server = require('mongodb').Server;

        this._mc = new mongo(new Server("localhost", 27017), { native_parser: true });
    }

    dbOpen() {

    }

    // load json
    load() {
        try {
            let content = this._fs.readFileSync(this._mappingFile, {
                encoding: 'utf8'
            });
            this.execute(content);
        } catch (err) {

        }
    }

    // iterate through json for loading different collections
    execute(data) {
        // console.log('asdada');
        this._mc.open().then((db) => {
            // console.log(db);
        }).catch((err) => {
            // console.log(err);
        });


        /*

        // create database
        this._mongoClient.connect(this._dbUri).then((db) => {
            // console.log('database created');

            let obj = JSON.parse(data);
            //// console.log(db);
            //// console.log(obj.collections[0]);

            db.collectionNames().then((cols) => {
                // console.log(cols);
            }).catch((err) => {
                // console.log(err);
            });

            for (let i = 0; i < obj.collections.length; i++) {

                //// console.log(db.collection(obj.collections[0].name));

                //db.createCollection(obj.collections[0].name).then((db) => {}).catch((err) => {
                // // console.log(err);
                //});
            }

            //// console.log(obj);
            // obj.collections.forEach(this.buildCollection, this);

            //db.close();
        }).catch((err) => {
            // console.log(err);
        });

*/
    }

    /*
    // create individual collection
    buildCollection(details) {
        //// console.log(element);
        this.createCollection(details.name);
        this.loadData(details.name, details.rows);
    }

    createCollection(cName) {
        // console.log(cName);
        this._mongoClient.connect(this._dbUri).then((db) => {
            db.createCollection(cName);
            // console.log('collection created');
            db.close();
        }).catch((err) => {
            //// console.log(err);
        });
    }

    loadData(cName, data) {

        // console.log(data);
    }


    addCoreFields(data) {
        //data
        //return data;
    }

    */

}


let db = new database(fs, mongo, 'akwa1');
db.load();


/*
{
	"_id" : ObjectId("593f5f2726181816f55d4da9"),
	"client" : {
		"clientId" : "012179919676",
		"projectId" : "us-east-1_zI0af0OBy"
	},
	"updatedBy" : {
		"uuid" : "d744458c-866c-4e49-bef7-82080872536f",
		"firstName" : "Sujoy",
		"lastName" : "Mukherjee1",
		"email" : "sujoy@nicbit.com"
	},
	"status" : 1,
	"sysDefined" : 1,
	"name" : "address",
	"code" : "address",
	"tags" : [ ],
	"updatedOn" : ISODate("2017-06-13T03:42:31.386Z"),
	"__v" : 0
}
*/
