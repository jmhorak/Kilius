/**
 * Unit tests for file fetching subsystem
 *
 * Author: Jeff Horak
 * Date: 7/11/12
 */

/*globals describe expect it beforeEach afterEach spyOn jasmine */

var fs      = require('fs'),
    helper  = require('./testing.helpers.js'),
    fetch   = helper.fileFetch,
    Promise = helper.Promise,
    logging = helper.logging,
    options = helper.options;

describe('fetching resources', function() {
  var spy,
      notCalled,
      client = 'abc123',
      code = 404,
      invalidFileStr = 'Missing or invalid file',
      stats = {};

  beforeEach(function() {

    this.addMatchers({
      toHaveBeenCalledWithObject: helper.equalObjectMatcher
    });

    spy = jasmine.createSpy();
    notCalled = jasmine.createSpy();

    spyOn(logging, 'log');
    spyOn(logging, 'error');

    stats.isFile = function() { return true; };
  });

  describe('file not found', function() {
    var fileNotFound = 'File not found';

    function fetchResourceTest(expectedError, expectedCode) {
      fetch.fetchResource('something.js', client).then(notCalled, spy);

      expect(spy).toHaveBeenCalledWith(expectedError, expectedCode);
      expect(notCalled).not.toHaveBeenCalled();

      expect(logging.error).toHaveBeenCalledWithObject({
        message: expectedError,
        client: client,
        error: fileNotFound,
        code: expectedCode
      });
    }

    it('should reject the promise and log an error if the resource real path returns an error', function() {
      spyOn(fs, 'realpath').andCallFake(function(loadPath, cache, callback) {
        callback(fileNotFound);
      });

      fetchResourceTest(invalidFileStr, code);
    });

    it('should reject the promise and log an error if the file stat returns an error', function() {
      spyOn(fs, 'realpath').andCallFake(function(loadPath, cache, callback) {
        callback(null, options.clientRootFilePath + '/something.js');
      });

      spyOn(fs, 'stat').andCallFake(function(path, callback) {
        callback(fileNotFound);
      });

      fetchResourceTest(invalidFileStr, code);
    });

    it('should reject the promise and log an error if the file cannot be read', function() {
      spyOn(fs, 'realpath').andCallFake(function(loadPath, cache, callback) {
        callback(null, options.clientRootFilePath + '/something.js');
      });

      spyOn(fs, 'stat').andCallFake(function(path, callback) {
        callback(null, stats);
      });

      spyOn(fs, 'readFile').andCallFake(function(path, callback) {
        callback(fileNotFound);
      });

      fetchResourceTest('Could not load resource', 503);
    });

  });

  describe('sanitizing the input', function() {

    it('should log an error and reject the promise if file path attempts to go to the parent directory', function() {

      spyOn(fs, 'realpath').andCallFake(function(loadPath, cache, callback) {
        callback(null, '/etc/passwd');
      });

      fetch.fetchResource('something.js', client).then(notCalled, spy);

      expect(spy).toHaveBeenCalledWith(invalidFileStr, code);
      expect(notCalled).not.toHaveBeenCalled();

      expect(logging.error).toHaveBeenCalledWithObject({
        message: invalidFileStr,
        client: client,
        error: 'Attempt to request up the directory tree.',
        code: code
      });
    });

    it('should log an error and reject the promise if file path is a folder', function() {
      spyOn(fs, 'realpath').andCallFake(function(loadPath, cache, callback) {
        callback(null, options.clientRootFilePath + '/something.js');
      });

      spyOn(fs, 'stat').andCallFake(function(loadPath, callback) {
        stats.isFile = function() { return false; };
        callback(null, stats);
      });

      fetch.fetchResource('something.js', client).then(notCalled, spy);

      expect(spy).toHaveBeenCalledWith(invalidFileStr, code);
      expect(notCalled).not.toHaveBeenCalled();

      expect(logging.error).toHaveBeenCalledWithObject({
        message: invalidFileStr,
        error: 'Requested resource is not a file',
        client: client,
        code: code
      });
    });

    describe('checking for files that don\'t pass the white-listed file extension test', function() {
      var errorStr = 'Requested file with non-white listed extension: ';

      function fetchResourceTest(resource) {
        fetch.fetchResource(resource, client).then(notCalled, spy);
        expect(logging.error).toHaveBeenCalledWithObject({
          message: invalidFileStr,
          client: client,
          error: errorStr + resource,
          code: code
        });

        expect(spy).toHaveBeenCalledWith(invalidFileStr, code);
        expect(notCalled).not.toHaveBeenCalled();
      }

      function fetchResourceTest_pass(resource) {
        spyOn(fs, 'realpath').andCallFake(function(loadPath, cache, callback) {
          callback(null, options.clientRootFilePath + '/' + loadPath);
        });

        spyOn(fs, 'stat').andCallFake(function(loadPath, callback) {
          callback(null, stats);
        });

        spyOn(fs, 'readFile').andCallFake(function(loadPath, callback) {
          callback(null, 'content');
        });

      }

      it('should reject files with no file-extension', function() {
        fetchResourceTest('passwd');
      });

      it('should reject .json files', function() {
        fetchResourceTest('options.json');
      });

      it('should reject hidden files', function() {
        fetchResourceTest('.bashrc');
      });

    });

  });

  describe('fetching the file', function() {
    var fd = 'content';

    beforeEach(function() {
      spyOn(fs, 'realpath').andCallFake(function(loadPath, cache, callback) {
        callback(null, options.clientRootFilePath + '/' + loadPath);
      });

      spyOn(fs, 'stat').andCallFake(function(loadPath, callback) {
        callback(null, stats);
      });

      spyOn(fs, 'readFile').andCallFake(function(loadPath, callback) {
        callback(null, fd);
      });
    });

    function fetchResourceTest(resource, expectedMimeType) {
      fetch.fetchResource(resource, client).then(spy, notCalled);

      expect(logging.error).not.toHaveBeenCalled();
      expect(logging.log).toHaveBeenCalledWithObject({
        client: client,
        message: 'Served ' + resource
      });

      expect(spy).toHaveBeenCalledWith(fd, stats, expectedMimeType);
      expect(notCalled).not.toHaveBeenCalled();
    }

    it('should fetch css files', function() {
      fetchResourceTest('main.css', 'text/css');
    });

    it('should fetch html files', function() {
      fetchResourceTest('index.html', 'text/html');
    });

    it('should fetch js files', function() {
      fetchResourceTest('kilius.js', 'text/javascript');
    });

    it('should fetch ico files', function() {
      fetchResourceTest('fav.ico', 'image/x-icon');
    });

    it('should fetch flash files', function() {
      fetchResourceTest('copy.swf', 'application/x-shockwave-flash');
    });
  });
});