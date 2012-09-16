/**
 * Unit testing for the Request Handler module
 * Author: Jeff Horak
 * Date: 7/10/12
 */

/*globals describe it beforeEach expect spyOn jasmine */

var helper  = require('./testing.helpers.js'),
    handler = helper.handler,
    logging = helper.logging,
    fetch   = helper.fileFetch,
    resolve = helper.resolve,
    stats   = helper.stats,
    shorten = helper.shorten,
    Promise = helper.Promise;

describe('testing the request handler module', function() {
  var response;

  beforeEach(function() {
    this.addMatchers({
      toHaveBeenCalledWithObject: helper.equalObjectMatcher
    });

    response = {
      writeHead: jasmine.createSpy(),
      end: jasmine.createSpy()
    };
  });

  describe('handling a request to resolve a URL', function() {
    var host = 'abc123',
        url = 'http://kili.us/+/123',
        ua = 'Mozilla',
        payload = {
          host: host,
          url: { href: url},
          ua: ua
        },
        testPayload = {
          client: host,
          url: url,
          userAgent: ua
        };

    it('should pass the call to the resolve module', function() {

      spyOn(resolve, 'resolveURL').andReturn(new Promise());

      handler.handleResolveURL(payload);

      expect(resolve.resolveURL).toHaveBeenCalledWithObject(testPayload);
    });

    it('should populate the response with the destination in the header', function() {
      var resolvedURL = 'http://www.google.com';

      spyOn(resolve, 'resolveURL').andCallFake(function() {
        return helper.resolveAPromise(resolvedURL);
      });

      payload.response = response;

      handler.handleResolveURL(payload);

      expect(response.writeHead).toHaveBeenCalledWith(307, {'Location': resolvedURL});
      expect(response.end).toHaveBeenCalled();

    });

    it('should return 404 if the URL is invalid', function() {
      var size = 100,
          mime = 'text/html',
          fd = 'some file content',
          mtime = new Date();

      spyOn(resolve, 'resolveURL').andCallFake(function() {
        return helper.rejectAPromise('Invalid URL', 404);
      });

      spyOn(fetch, 'fetchResource').andCallFake(function() {
        return helper.resolveAPromise(false, fd, { size: size, mtime: mtime }, mime);
      });

      payload.response = response;

      handler.handleResolveURL(payload);

      expect(response.writeHead).toHaveBeenCalledWith(404, {
        'Content-Type': mime,
        'Content-Length': size,
        'Last-Modified': mtime.toUTCString(),
        'Cache-Control': 'public, max-age=604800'
      });
      expect(response.end).toHaveBeenCalledWith(fd);
    });
  });

  describe('handling a request for user stats', function() {
    var client = 'abc123';

    it('should pass the call to the statistics module', function() {

      spyOn(stats, 'linksForUser').andReturn(new Promise());

      handler.handleStatsForUser({ url: {}, host: client, response: response });

      expect(stats.linksForUser).toHaveBeenCalledWith({
        clientID: client,
        page: 0
      });

    });

    it('should extract the page number from the URL query string', function() {

      spyOn(stats, 'linksForUser').andReturn(new Promise());

      handler.handleStatsForUser({ url: { query: 'page=10' }, host: client, response: response });

      expect(stats.linksForUser).toHaveBeenCalledWith({
        clientID: client,
        page: 10
      });

    });

    it('should populate the response with the history data', function() {
      var results = [ { longLink: 'https://github.com/jmhorak',
                        shortLink: 'http://kili.us/+/3',
                        hits: [],
                        createDate: new Date()
                      } ],
          jsonString = JSON.stringify({ history: results });

      spyOn(stats, 'linksForUser').andCallFake(function() {
        return helper.resolveAPromise(results);
      });

      handler.handleStatsForUser({ url: {}, host: client, response: response});

      expect(response.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'application/json',
        'Content-Length': +Buffer.byteLength(jsonString)
      });

      expect(response.end).toHaveBeenCalledWith(jsonString);
    });

    it('should return an error response if the statistics module fails', function() {
      var message = "An error occurred and it's all your fault",
          code = 404;

      spyOn(stats, 'linksForUser').andCallFake(function() {
        return helper.rejectAPromise(message, code);
      });

      handler.handleStatsForUser({ url: {}, host: client, response: response });

      expect(response.writeHead).toHaveBeenCalledWith(code, {
        'Content-Type': 'application/json'
      });

      expect(response.end).toHaveBeenCalledWith(JSON.stringify({ message: message }));
    });
  });

  describe('fetching resources', function() {
    var client = 'abc123',
        resource = 'index.html';

    it('should call the file fetching module', function() {

      spyOn(fetch, 'fetchResource').andReturn(new Promise());

      handler.handleFetchResource({
        host: client,
        resource: resource,
        response: response
      });

      expect(fetch.fetchResource).toHaveBeenCalledWith(resource, client, undefined);
    });

    it('should populate the response with the requested file', function() {
      var file = 'some file contents',
          size = 100,
          mimeType = 'text/html',
          time = new Date();

      spyOn(fetch, 'fetchResource').andCallFake(function() {
        return helper.resolveAPromise(false, file, { size: size, mtime: time}, mimeType);
      });

      handler.handleFetchResource({
        host: client,
        resource: resource,
        response: response
      });

      expect(response.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=604800',
        'Content-Length': size,
        'Last-Modified': time.toUTCString()
      });
      expect(response.end).toHaveBeenCalledWith(file);
    });

    it('should return an error if the file cannot be fetched', function() {

      spyOn(fetch, 'fetchResource').andCallFake(function() {
        return helper.rejectAPromise();
      });

      handler.handleFetchResource({
        host: client,
        resource: resource,
        response: response
      });

      expect(response.writeHead).toHaveBeenCalledWith(500, {
        'Content-Type': 'application/json'
      });

      expect(response.end).toHaveBeenCalledWith(JSON.stringify({ message: 'Server error fetching file'}));

    });

    it('should return 304 if the file is cached on the client', function() {
      spyOn(fetch, 'fetchResource').andCallFake(function() {
        return helper.resolveAPromise(true);
      });

      handler.handleFetchResource({
        host: client,
        resource: resource,
        response: response
      });

      expect(response.writeHead).toHaveBeenCalledWith(304);
      expect(response.end).toHaveBeenCalled();
    });
  });

  describe('handling an unsupported request', function() {
    var verb = 'GET',
        path = '/abc/',
        code = 405;

    beforeEach(function() {
      spyOn(logging, 'error');
    });

    it('should log an error', function() {

      handler.handleUnsupportedRequest({ response: response, verb: verb, path: path });

      expect(logging.error).toHaveBeenCalledWith({
        message: verb + ' for ' + path + ' not implemented',
        code: code
      });
    });

    it('should return a 405 error', function() {
      handler.handleUnsupportedRequest({ response: response, verb: verb, path: path });

      expect(response.writeHead).toHaveBeenCalledWith(code);
      expect(response.end).toHaveBeenCalled();
    });
  });

  describe('handling a request to create a shortened URL', function() {
    var client = 'abc123',
        url = 'http://google.com';

    it('should pass to the shortening module', function() {
      spyOn(shorten, 'shortenURL').andReturn(new Promise());

      handler.createShortenedURL({ response: response, data: { url: url }, host: client });

      expect(shorten.shortenURL).toHaveBeenCalledWith({
        url: url,
        client: client
      });
    });

    it('should return a 201 response with the shortened link in the Location header parameter', function() {
      var shortLink = 'kili.us/+/abc',
          throttle = 2;

      spyOn(shorten, 'shortenURL').andCallFake(function() {
        return helper.resolveAPromise(shortLink, throttle);
      });

      handler.createShortenedURL({ response: response, data: url, host: client });

      expect(response.writeHead).toHaveBeenCalledWith(201, {
        'Content-Type': 'application/json',
        'Location': shortLink
      });
      expect(response.end).toHaveBeenCalledWith(JSON.stringify({ throttle: throttle }));
    });

    it('should return an error if the link could not be shortened', function() {
      var message = 'Error shortening the link, and it\'s all your fault!',
          code = 404;

      spyOn(shorten, 'shortenURL').andCallFake(function() {
        return helper.rejectAPromise(message, code);
      });

      handler.createShortenedURL({ response: response, data: url, host: client });

      expect(response.writeHead).toHaveBeenCalledWith(code, {
        'Content-Type': 'application/json'
      });
      expect(response.end).toHaveBeenCalledWith(JSON.stringify({ message: message }));
    });

  });
});