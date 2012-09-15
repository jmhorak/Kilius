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
    cli     = require('modCLI'),
    Promise = require('modPromise').Promise,
    domain = require('domain'),
    // Create a top-level domain for the server
    serverDomain = domain.create();

/**
 * Entry point for new requests. Create a domain and push to request handler
 * @param req - The request
 * @param res - Generated response
 */
function onRequest(req, res) {
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
}

/**
 * Start the server and begin listening for requests
 */
function runServer() {

  var args = process.argv.slice(2),
      len = args.length,
      regStartAsService = /^(\/|--)s(ervice)?$/, // check for --service, --s, /service, or /s
      startAsService = false;

  // Test for option to start as a service
  while ((len--) && !startAsService) {
    startAsService = regStartAsService.test(args[len]);
  }

  // Start the server
  if (startAsService) {
    http.createServer(onRequest).listen(8642);
  } else {
    // If not started as a service, load interactive CLI
    cli.createCLI(http.createServer(onRequest).listen(8642));
  }
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