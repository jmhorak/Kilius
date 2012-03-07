//////////////////////////////////////////////////////////////////////////
// File: kilius.js
//
// Description: 
//   kili.us Node.js URL shortening service
//////////////////////////////////////////////////////////////////////////

var http = require('http'),
    fs = require('fs'),
    urlService = require('url'),
    sh = require('./node_modules/modShorten/shortenURL.js'),
    m = require('mongodb'),
    mongo = null,
    server = null;

var Kilius = function() {
  var that = this,
      blackList = [],
      doLog = function(collection, payload) {
          collection.insert(payload, {safe: false});
      };

  // Check for black-listed clients
  this.isBlackListed = function(client) {
    return !!blackList[client];
  };

  // Serve HTML
  this.servePageFor = function(client, page, response) {
    fs.readFile(page, function(err, fd) {
      if (err) {
        that.logError(client, 'Could not load ' + page, 503);
        response.writeHead(503); // 503 => Service temporarily unavailable
        response.end();
      } else {
        // Write the page to the response stream
        that.log(client, 'Served ' + page);
        response.writeHead(200);
        response.end(fd);
      }
    })
  };

  this.serveResourceFor = function(client, resource, response) {
    fs.readFile(resource, function(err, fd) {
      if (err) {
        that.logError(client, ['Invalid resource ', resource, ' requested'].join(''), 404);
        response.writeHead(404); // 404 => Not Found
        response.end();
      } else {
        that.log(client, 'Served ' + resource);
        switch (true) {
          case /\.css$/i.test(resource):
            response.writeHead(200, { 'Content-Type': 'text/css' });
            break;

          case /\.html?$/i.test(resource):
            response.writeHead(200, { 'Content-Type': 'text/html' });
            break;

          case /\.js$/i.test(resource):
            response.writeHead(200, { 'Content-Type': 'text/javascript' });
            break;

          case /\.ico$/i.test(resource):
            response.writeHead(200, { 'Content-Type': 'image/x-icon' });
            break;

          default:
            response.writeHead(200);
            break;
        }
        response.end(fd);
      }
    });
  };

  this.serveFavIconFor = function(client, path, response) {
    fs.readFile(path, function(err, fd) {
      if (err) {
        // This isn't a terrible problem, we'll just return nothing
        that.logError(client, 'Could not load the favicon');
        response.writeHead(200);
        response.end();
      } else {
        // Return with the correct MIME type
        that.log(client, "Served fav icon");
        response.writeHead(200, {'Content-Type': 'image/x-icon'});
        response.end(fd);
      }
    })
  };

  this.getRequestData = function(request, callback) {
    var data = [];
    request.on('data', function(chunk) {
      data.push(chunk);
    }).on('end', function() {
      callback(JSON.parse(data));
    });
  };

  this.log = function(client, msg) {
    doLog(mongo.collection('actLog'), {
      client: client,
      date: new Date(),
      msg: msg
    });
  };

  this.logError = function(client, msg, code) {
    doLog(mongo.collection('errLog'), {
      client: client,
      date: new Date(),
      msg: msg,
      code: code
    });
  };

  // Start the server
  http.createServer(function(req, res) {
    try {
      var servURL = urlService.parse(req.url),
          path = servURL.pathname,
          host = req.headers.host;

      that.log(host, 'Starting to process request');

      if (that.isBlackListed(host)) {
        // This user is not allowed
        that.logError(host, 'Blacklisted client attempting to connect', 403);
        res.writeHead(403); // Forbidden
        res.end();
        return;
      }

      if (path.charAt(0) === ':') {
        path.substring(1);
      }

      if (path === '/') {
        // Requesting the index.html page
        that.servePageFor(host, '../siteContent/index.html', res);

      } else if (path === '/favicon.ico') {
        // Requesting the favicon for our page
        that.serveFavIconFor(host, '../siteContent/favicon.ico', res);

      } else if (path.indexOf('/service') === 0) {

        if (path.indexOf('/shorten') === 8) {
          that.getRequestData(req, function(data) {
            data.database = mongo;
            data.clientID = host;
            sh.shorten(data, function(result) {
              that.log(host, ['Finished shortening URL as [', result.url, '] ',
                (24 - result.throttle).toString(), ' more requests available today'].join(''));

              res.writeHead(200, { 'Content-Type': 'application/json'});
              res.end(JSON.stringify({
                url: result.url,
                throttle: result.throttle
              }));
            }, function(err) {
              // TODO: Should this return 500 instead?
              res.writeHead(200, { 'Content-Type': 'application/json'});
              res.end(JSON.stringify({
                isErr: true,
                errCode: err.code,
                errMessage: err.clientMessage
              }));

              // Remove the client information before writing to the error log
              delete err.clientMessage;

              that.logError(host, JSON.stringify(err), 200);
            });
          });
        } else {
          // Service not found
          that.logError(host, 'Service not implemented', 501);
          res.writeHead(501); // 501 => Not Implemented
          res.end();
        }
        // TODO: Add other services (login, track)
      } else if (path.indexOf('/+') == 0) {
        // Need to redirect to the given URL
      } else {
        that.serveResourceFor(host, '../siteContent/' + path, res);
      }
    } catch (e) {
      that.logError('Kilius Server', 'createServer: Exception thrown: ' + e.toString(), 500);
      res.writeHead(500); // 500 => Internal Server Error
      res.end();
    }
  }).listen(8642);

}

mongo = new m.Db('kilius', new m.Server('localhost', 27017, {}));

mongo.open(function(err, result) {
  // If any database initialization method fails, throw
  var throwOnErr = function(err) { if (err) { throw err; } },
      mb = 1048576;

  throwOnErr(err);

  // Need to init the collections
  mongo.collection('counter', {safe: true}, function(err, result) {
    if (err) {
      mongo.createCollection('counter', {safe: true}, function(err, collection) {
        throwOnErr(err);
        // Initialize the counter collection
        collection.insert({ tbl: 'links', c: 0 }, {safe: true}, function(err, result) {
          throwOnErr(err);
        });
      });
    }
  });
  mongo.collection('links', {safe: true}, function(err, result) {
    if (err) {
      mongo.createCollection('links', {safe: true}, function(err) { throwOnErr(err); });
    }
  });
  mongo.collection('errLog', {safe: true}, function(err, result) {
    if (err) {
      // Create the err log collection, cap it at 10 MB
      mongo.createCollection('errLog', {safe: true, capped: true, size: mb*10}, function(err) { throwOnErr(err); });
    }
  });
  mongo.collection('actLog', {safe: true}, function(err, result) {
    if (err) {
      // Create the activity log collection, cap it at 50 MB
      mongo.createCollection('actLog', {safe: true, capped: true, size: mb*50}, function(err) { throwOnErr(err); });
    }
  });

  server = new Kilius();
});