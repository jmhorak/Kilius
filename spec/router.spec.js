/**
 * Unit tests for the routing module
 * Author: Jeff Horak
 * Date: 7/18/12
 */

/*globals describe expect it beforeEach jasmine spyOn */
var helper  = require('./testing.helpers.js'),
    router  = helper.router,
    handler = helper.handler,
    logging = helper.logging,
    urlMod  = require('url');

describe('the routing module', function() {
  var userAgent,
      contentType,
      host,
      url,
      path,
      verb,
      req,
      res,
      reqData;

  function buildRequestDataObj() {
    req = req || {};
    req.headers = {
        host: host,
        'user-agent': userAgent,
        'content-type': contentType
      };
    req.method = verb;
    req.url = url;

    reqData = {
      url: urlMod.parse(url),
      path: path,
      host: host,
      ua: userAgent,
      contentType: contentType,
      verb: verb,
      response: res,
      request: req
    };
  }

  beforeEach(function() {
    userAgent = 'Mozilla';
    contentType = 'application/json';
    host = 'abc123';
    url = 'http://kili.us/+/abc';
    path = "/+/abc";
    verb = 'GET';

    this.addMatchers({
      toHaveBeenCalledWithObject: helper.equalObjectMatcher
    });
  });

  describe('routing GET requests', function() {

    it('should route shortened URLs to the resolve handler', function() {
      spyOn(handler, 'handleResolveURL');
      buildRequestDataObj();
      router.handleRequest(req, res);
      expect(handler.handleResolveURL).toHaveBeenCalledWith(reqData);
    });

    it('should route user history requests to the stats handler', function() {
      spyOn(handler, 'handleStatsForUser');

      url = 'http://kili.us/testuser/history';
      path = '/testuser/history';
      buildRequestDataObj();

      router.handleRequest(req, res);
      expect(handler.handleStatsForUser).toHaveBeenCalledWith(reqData);
    });

    describe('routing file fetches', function() {
      beforeEach(function() {
        spyOn(handler, 'handleFetchResource');
      });

      it('should route the path to the fetch handler', function() {
        url = 'http://kili.us/stylin.css';
        path = '/stylin.css';
        buildRequestDataObj();
        reqData.resource = path;

        router.handleRequest(req, res);
        expect(handler.handleFetchResource).toHaveBeenCalledWith(reqData);
      });

      it('should route an empty path to the index', function() {
        url = 'http://kili.us/';
        path = '/';
        buildRequestDataObj();
        reqData.resource = 'index.html';

        router.handleRequest(req, res);
        expect(handler.handleFetchResource).toHaveBeenCalledWith(reqData);
      });
    });
  });

  describe('routing POST requests', function() {
    var chunk;

    beforeEach(function() {
      verb = 'POST';

      req.on = function(evt, callback) {

        if ('data') { callback(chunk); }
        if ('end') { callback(); }

        return req;
      };

      spyOn(handler, 'createShortenedURL');
      spyOn(logging, 'error');

      res = {
        writeHead: jasmine.createSpy(),
        end: jasmine.createSpy()
      };
    });

    it('should route new URLs to the shortening handler', function() {

      chunk = '{ "abc": 123 }';
      url = 'http://kili.us/+/';
      path = '/+/';
      buildRequestDataObj();

      reqData.data = { abc: 123 };
      router.handleRequest(req, res);
      expect(handler.createShortenedURL).toHaveBeenCalledWith(reqData);
      expect(logging.error).not.toHaveBeenCalled();
    });

    it('should log an error if the posted data is not legal json', function() {
      var code = 400;

      chunk = '{ nope: not legal JSON }';
      url = 'http://kili.us/+/';
      path = '/+/';
      buildRequestDataObj();

      router.handleRequest(req, res);
      expect(logging.error).toHaveBeenCalledWithObject({
        message: 'Exception thrown in getRequestData - bad client request',
        error: 'SyntaxError: Unexpected token n',
        code: code
      });
      expect(handler.createShortenedURL).not.toHaveBeenCalled();

      expect(res.writeHead).toHaveBeenCalledWith(code);
      expect(res.end).toHaveBeenCalled();
    });

  });

  describe('rejecting unsupported actions', function() {

    beforeEach(function() {
      spyOn(handler, 'handleUnsupportedRequest');
      spyOn(logging, 'error');
    });

    it('should route POSTs with non-JSON content types to the unsupported request handler', function() {
      verb = 'POST';
      contentType = 'application/xml';
      url = 'http://kili.us/+/';
      path = '/+/';
      buildRequestDataObj();

      router.handleRequest(req, res);
      expect(handler.handleUnsupportedRequest).toHaveBeenCalledWith(reqData);
    });

    it('should route POSTs to locations other than /+ to the unsupported request handler', function() {
      verb = 'POST';
      url = 'http://kili.us/+/abc';
      path = '/+/abc';
      buildRequestDataObj();

      router.handleRequest(req, res);
      expect(handler.handleUnsupportedRequest).toHaveBeenCalledWith(reqData);
    });

    it('should route all PUTs to the unsupported request handler', function() {
      verb = 'PUT';
      buildRequestDataObj();

      router.handleRequest(req, res);
      expect(handler.handleUnsupportedRequest).toHaveBeenCalledWith(reqData);
    });

    it('should route all DELETEs to the unsupported request handler', function() {
      verb = 'DELETE';
      buildRequestDataObj();

      router.handleRequest(req, res);
      expect(handler.handleUnsupportedRequest).toHaveBeenCalledWith(reqData);
    });

    it('should route all unknown verbs to the unsupported request handler', function() {
      verb = 'TACO'; // Hey that's a noun!
      buildRequestDataObj();

      router.handleRequest(req, res);
      expect(handler.handleUnsupportedRequest).toHaveBeenCalledWith(reqData);
    });

  });

});