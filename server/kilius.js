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
    mongo = require('mongodb'),
    dbConnect = null;

var kilius = {
  // Serve HTML
  servePageFor: function(client, page, response) {
    fs.readFile(page, function(err, fd) {
      if (err) {
        log(client, 'Could not load ' + page);
        response.writeHead(503); // 503 => Service temporarily unavailable
        response.end();
      } else {
        // Write the page to the response stream
        response.writeHead(200);
        response.end(fd);
      }
    })
  },

  serveResourceFor: function(client, resource, response) {
    fs.readFile(resource, function(err, fd) {
      if (err) {
        log(client, ['Invalid resource ', resource, ' requested'].join(''));
        response.writeHead(404); // 404 => Not Found
        response.end();
      } else {
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
  },

  serveFavIconFor: function(client, path, response) {
    fs.readFile(path, function(err, fd) {
      if (err) {
        // This isn't a terrible problem, we'll just return nothing
        log(client, 'Could not load the favicon');
        response.writeHead(200);
        response.end();
      } else {
        // Return with the correct MIME type
        response.writeHead(200, {'Content-Type': 'image/x-icon'});
        response.end(fd);
      }
    })
  },

  getRequestData: function(request, callback) {
    var data = [];
    request.on('data', function(chunk) {
      data.push(chunk);
      console.log('Received: ' + chunk);
    }).on('end', function() {
      callback(JSON.parse(data));
    });
  },

  log: function(client, msg) {
    console.log([
      '[', client.toString(), '] ', new Date(), ': ', msg
    ].join(''));
  }
}

dbConnect = new mongo.Db('kilius', new mongo.Server('localhost', 27012, {}));

dbConnect.open(function(err, result) {
  if (err) {
    // Couldn't initialize the database, pack it up - we're done
    throw err;
  } else {
    // Create the server
    http.createServer(function(req, res) {
      try {
        var servURL = urlService.parse(req.url),
            path = servURL.pathname,
            host = req.headers.host;

        if (path.charAt(0) === ':') {
          path.substring(1);
        }

        if (path === '/') {
          // Requesting the index.html page
          kilius.servePageFor(host, '../siteContent/index.html', res);

        } else if (path === '/favicon.ico') {
          // Requesting the favicon for our page
          kilius.serveFavIconFor(host, '../siteContent/favicon.ico', res);

        } else if (path.indexOf('/service') === 0) {

          if (path.indexOf('/shorten') === 8) {
            kilius.getRequestData(req, function(data) {
              data.database = dbConnect;
              sh.shorten(data, function(url) {
                res.writeHead(200, { 'Content-Type': 'application/json'});
                res.end(JSON.stringify({ url: url }));
              });
            });
          } else {
            // Service not found
            res.writeHead(501); // 501 => Not Implemented
            res.end();
          }
          // TODO: Add other services (login, track)
        } else if (path.indexOf('/+') == 0) {
          // Need to redirect to the given URL
        } else {
          kilius.serveResourceFor(host, '../siteContent/' + path, res);
        }
      } catch (e) {
        kilius.log('Kilius Server', 'createServer: Exception thrown: ' + e.toString());

        res.writeHead(500); // 500 => Internal Server Error
        res.end();
      }
    }).listen(8642);
  }
});