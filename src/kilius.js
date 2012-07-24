//////////////////////////////////////////////////////////////////////////
// File: kilius.js
// Author: Jeff Horak
// Date: 7/1/12
//
// Description: 
//   kili.us Node.js URL shortening service
//////////////////////////////////////////////////////////////////////////

var http = require('http'),
    db = require('modDatabase'),
    router = require('modRouter'),
    blacklist = require('modBlackList'),
    logging = require('modLogging'),
    Promise = require('modPromise').Promise,
    domain = require('domain'),
    // Create a top-level domain for the server
    serverDomain = domain.create();
function runServer() {
  http.createServer(function(req, res) {

    // Create a domain to handle this request
    var requestDomain = domain.create();
    requestDomain.add(req);
    requestDomain.add(res);

    requestDomain.on('error', function(err) {
      // Unhandled exception, catch here
      try {
        console.error('Error', err, req.url);
        res.writeHead(500);
        res.end();

        res.on('close', function() {
          // Kill any resources opened in this domain
          requestDomain.dispose();
        });

      } catch (err) {
        console.error('Error sending 500 to client', err);
        // Clean up
        requestDomain.dispose();
      }
    });

    requestDomain.run(function() {
      // OK to handle the request
      router.handleRequest(req, res);
    });

  }).listen(8642);
}

// Initialize the database and start the server
db.initDatabase().then(
    function() {
      blacklist.initBlacklist().then(
          serverDomain.run(runServer),
          function(message, code) {
            throw message;
          }
      );
    },
    function(err) {
      throw 'Failure to initialize database with error ' + err;
    }
);