//////////////////////////////////////////////////////////////////////////
// File: kilius.js
//
// Description: 
//   kili.us Node.js URL shortening service
//////////////////////////////////////////////////////////////////////////

var http = require('http'),
    fs = require('fs'),
    urlService = require('url'),
    sh = require('./node_modules/modShorten/shortenURL.js');

var kilius = {
  // Serve HTML
  servePage: function(page, response) {
    fs.readFile(page, function(err, fd) {
      if (err) {
        console.log('Could not load ' + page);
        response.writeHead(503); // 503 => Service temporarily unavailable
        response.end();
      } else {
        // Write the page to the response stream
        response.writeHead(200);
        response.end(fd);
      }
    })
  },

  serveFavIcon: function(response) {
    fs.readFile('favicon.ico', function(err, fd) {
      if (err) {
        // This isn't a terrible problem, we'll just return nothing
        console.log('Could not load the favicon');
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
  }
}

http.createServer(function(req, res) {

  try {
    var servURL = urlService.parse(req.url),
        path = servURL.pathname;

    if (path.charAt(0) === ':') {
      path.substring(1);
    }

    if (path === '/') {
      // Requesting the index.html page
      kilius.servePage('test.html', res);

    } else if (path === '/favicon.ico') {
      // Requesting the favicon for our page
      kilius.serveFavIcon(res);

    } else if (path.indexOf('/service') === 0) {

      if (path.indexOf('/shorten') === 8) {
        kilius.getRequestData(req, function(data) {
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
    } else {
      // Need to redirect to the given URL
    }
  } catch (e) {
    console.log('createServer: Exception thrown: ' + e.toString());

    res.writeHead(500); // 500 => Internal Server Error
    res.end();
  }
}).listen(8642);
