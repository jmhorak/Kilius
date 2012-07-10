//////////////////////////////////////////////////////////////////////////
// File: kilius.js
// Author: Jeff Horak
// Date: 7/1/12
//
// Description: 
//   kili.us Node.js URL shortening service
//////////////////////////////////////////////////////////////////////////

var http = require('http'),
    url = require('url'),
    db = require('.node_modules/modDatabase/dbService.js'),
    Promise = require('./node_modules/modPromise').Promise;

function runServer() {
  http.createServer(function(req, res) {
    try {

      // Log starting to handle request
      db.logActivity({
        client: req.headers.host,
        status: 'Starting to process request'
      });

      // Is this client blacklisted?
      // TODO: Add modBlacklist and supporting functionality

      // TODO: Add modRouter

    } catch (e) {
      db.logError({
        message: 'Exception thrown',
        error: e.toString(),
        code: 500
      });

      res.writeHead(500);
      res.end();
    }
  }).listen(8642);
}

// Initialize the database and start the server
db.initDatabase().then(
    runServer,
    function(err) {
      throw 'Failure to initialize database with error ' + err;
    }
);