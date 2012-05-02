//////////////////////////////////////////////////////////////////////////
// File: kilius.js
//
// Description: 
//   kili.us Node.js URL shortening service
//////////////////////////////////////////////////////////////////////////

var http = require('http'),
    fs = require('fs'),
    urlService = require('url'),
    queryString = require('querystring'),
    sh = require('./node_modules/modShorten/shortenURL.js'),
    rs = require('./node_modules/modResolve/resolveURL.js'),
    ts = require('./node_modules/modTransform/transformService.js'),
    stat = require('./node_modules/modStats/statService.js'),
    m = require('mongodb'),
    mongo = null,
    server = null;

var Kilius = function() {
  var that = this,
      blackList = [],
      doLog = function(collection, payload) {
        collection.insert(payload, {safe: false});
      };

  // Initialize the transformation service
  ts.init();

  // Check for black-listed clients
  this.isBlackListed = function(client) {
    return !!blackList[client];
  };

  this.serveResource = function(resource, errorCallback, successCallback) {
    fs.stat(resource, function(err, stats) {

      // Only handle files
      if (err || !stats.isFile()) {
        errorCallback(err);
      } else {

        // Read the file from disk and write to the response object
        fs.readFile(resource, function(err, fd) {
          if (err) {
            errorCallback(err);
          } else {
            successCallback(fd, stats);
          }
        });
      }
    });
  };

  this.writeResponseForFile = function(context) {
    var resource = context.resource,
        response = context.response;

    that.log(context.host, 'Served ' + resource);

    switch (true) {
      case /\.css$/i.test(resource):
        response.setHeader('Content-Type', 'text/css');
        break;

      case /\.html?$/i.test(resource):
        response.setHeader('Content-Type', 'text/html');
        break;

      case /\.js$/i.test(resource):
        response.setHeader('Content-Type', 'text/javascript');
        break;

      case /\.ico$/i.test(resource):
        response.setHeader('Content-Type', 'image/x-icon');
        break;

      case /\.swf$/i.test(resource):
        response.setHeader('Content-Type', 'application/x-shockwave-flash');
        break;

      default:
        break;
    }

    // Miscellaneous headers
    response.statusCode = 200;
    response.setHeader('Cache-Control', 'public, max-age=604800'); // Cache for one week
    response.setHeader('Content-Length', +context.stats.size);
    response.setHeader('Last-Modified', context.stats.mtime.toUTCString());

    response.end(context.fd);
  };

  this.createShortenedURL = function(host, req, res) {
    that.getRequestData(req, res, function (data) {
      data.database = mongo;
      data.clientID = host;
      sh.shorten(data, function (result) {
        that.log(host, ['Finished shortening URL as [', result.url, '] ',
          (24 - result.throttle).toString(), ' more requests available today'].join(''));

        // 201 => Created New Item
        res.writeHead(201, {
          'Content-Type':'application/json',
          'Location': result.url
        });
        res.end(JSON.stringify({
          throttle:result.throttle
        }));
      }, function (err) {
        res.writeHead(err.statusCode || 500, { 'Content-Type':'application/json'});
        res.end(JSON.stringify({
          message:err.clientMessage
        }));

        // Remove the client information before writing to the error log
        delete err.clientMessage;

        that.logError(host, JSON.stringify(err), 500);
      });
    });
  };

  this.resolveShortenedURL = function(host, userAgent, uri, res) {
    rs.resolveURL({
      database: mongo,
      clientID: host,
      userAgent: userAgent,
      uri: uri
    }, function(destination) {
      that.log(host, ['Resolved ', uri, ' as ', destination].join(''));
      // Redirect to the long link, 307 is temporary redirect, this will allow us to keep statistics on hits
      res.writeHead(307, {'Location': destination});
      res.end();
    }, function(err) {
      // Write a log error message and then return our custom error page
      var payload = "",
          code = err.code,
          resource = '';

      if (code === 500) {
        delete err.code;
        payload = JSON.stringify(err);
        resource = '../siteContent/500.html';
      } else {
        payload = err.logMessage;
        resource = '../siteContent/404.html';

        that.serveResource(resource,
          function(err) {
            that.handlePageLoadError({
              host: host,
              page: resource,
              res: res
            })
          },
          function(fd, stats) {
            that.writeResponseForFile({
              fd: fd,
              host: host,
              resource: resource,
              response: res,
              stats: stats
            })
          }
        );
      }

      that.logError(host, payload, code);
    });
  };

  this.buildStatsForUser = function(host, page, response) {
    stat.linksForUser({
      database: mongo,
      clientID: host,
      page: page
    }, function(stats) {

      var jsonString = JSON.stringify({
        history: stats
      });
      that.log(host, ['Prepared usage stats for ', host].join(''));

      response.writeHead(200, {'Content-Type': 'application/json', 'Content-Length': +Buffer.byteLength(jsonString)});
      response.end(jsonString);
    }, function(err) {

      var jsonString = JSON.stringify({
        message: err.message
      });

      response.writeHead(500, {'Content-Type': 'application/json', 'Content-Length': +Buffer.byteLength(jsonString)});
      response.end(jsonString);

      delete err.message;
      that.logError(host, JSON.stringify(err), 500);
    });
  }

  this.getRequestData = function(request, response, callback) {
    var data = [];
    request.on('data', function(chunk) {
      data.push(chunk);
    }).on('end', function() {
      try {
        callback(JSON.parse(data));
      } catch(e) {
        that.logError('Kilius Server', 'getRequestData: Exception thrown: ' + e.toString(), 400);
        response.writeHead(400); // 400 => Bad client request
        response.end();
      }
    });
  };

  this.handlePageLoadError = function(context) {
    that.logError(context.host, 'Could not load ' + context.page, 503);
    context.res.writeHead(503); // 503 => Service temporarily unavailable
    context.res.end();
  };

  this.handleBlackListConnected = function(host, res) {
    that.logError(host, 'Blacklisted client attempting to connect', 403);
    res.writeHead(403); // Forbidden
    res.end();
  };

  this.handleInvalidResource = function(client, resource, response, err) {
    that.logError(client, ['Invalid resource ', resource, ' requested: ', JSON.stringify(err)].join(''), 404);
    response.writeHead(404); // 404 => Not Found
    response.end();
  }

  this.handleUnsupportedRequest = function(host, verb, path, res) {
    that.logError(host, [verb, ' for ', path, ' not implemented'].join(''), 501);
    res.writeHead(405); // 405 => Method not allowed
    res.end();
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
    console.log(msg);
  };

  // Start the server
  http.createServer(function(req, res) {
    try {
      var servURL = urlService.parse(req.url),
          path = servURL.pathname,
          host = req.headers.host,
          userAgent = req.headers['user-agent'],
          contentType = req.headers['content-type'],
          verb = req.method,
          resource = '';

      that.log(host, 'Starting to process request');



      if (that.isBlackListed(host)) {
        // This user is not allowed
        that.handleBlackListConnected(host, res);
        return;
      }

      if (path.charAt(0) === ':') {
        path.substring(1);
      }

      if (/\.\./.test(path)) {
        // Stay within the site content subdirectory
        that.handleInvalidResource(host, path, res);
        return;
      }

      // TODO: Add other services (login, track)
      switch(verb) {
        case 'GET':
          if (path === '/') {
            // Requesting the index.html page
            resource = '../siteContent/index.html';
            that.serveResource(resource,
              function(err) {
                that.handlePageLoadError({
                  host: host,
                  page: resource,
                  res: res
                });
              },
              function(fd, stats) {
                that.writeResponseForFile({
                  fd: fd,
                  host: host,
                  resource: resource,
                  response: res,
                  stats: stats
                });
              }
            );
          } else if (path.indexOf('/+') === 0) {
            // Resolve the URL
            that.resolveShortenedURL(host, userAgent, path, res);

          } else if (/^\/[a-zA-Z][0-9a-zA-Z_]{0,31}\/history\/?$/.test(path)) {
            that.buildStatsForUser(host, parseInt(queryString.parse(servURL.query).page) || 0, res);

          } else {
            resource = path === '/favicon.ico' ? '../siteContent/favicon.ico' : '../siteContent/' + path;
            that.serveResource(resource,
              function(err) {
                that.handleInvalidResource(host, resource, res, err);
              },
              function(fd, stats) {
                that.writeResponseForFile({
                  fd: fd,
                  host: host,
                  resource: resource,
                  response: res,
                  stats: stats
                });
              }
            );
          }
          break;

        case 'POST':
          if (path.indexOf('/+') === 0 && contentType === 'application/json') { // Only accepting JSON
            that.createShortenedURL(host, req, res);
          } else {
            that.handleUnsupportedRequest(host, verb, path, res);
          }
          break;

        default:
            // Not supporting this verb
          that.handleUnsupportedRequest(host, verb, path, res);
          break;
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
