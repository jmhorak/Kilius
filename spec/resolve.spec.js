/**
 * Unit tests for resolving a shortened link
 * Author: Jeff Horak
 * Date: 6/20/12
 */

var r = require(__dirname + '/../src/node_modules/modResolve/resolveURL.js'),
    Promise = require(__dirname + '/../src/node_modules/modPromise').Promise,
    transform = require(__dirname + '/../src/node_modules/modTransform/transformService.js'),
    db = require(__dirname + '/../src/node_modules/modDatabase/dbService.js');

function resolveAPromise(retValue) {
  var promise = new Promise();

  if (retValue) {
    promise.resolve(retValue);
  } else {
    promise.resolve();
  }

  return promise;
}

function rejectAPromise(retValue) {
  var promise = new Promise();

  if (retValue) {
    promise.reject(retValue);
  } else {
    promise.reject();
  }

  return promise;
}

describe('resolving a shortened link', function() {
  var spy,
      notCalled,
      client = '192.168.1.1',
      url = '/+/2',
      userAgent = 'Mozilla';

  beforeEach(function() {
    spy = jasmine.createSpy();
    notCalled = jasmine.createSpy();

    //transform.init();

    this.addMatchers({

      toHaveLogged: function(expected) {
        var args = this.actual.wasCalled ? this.actual.mostRecentCall.args[0] : {},
            actualValue,
            key,
            hasError = false;

        for (key in args) {
          if (args.hasOwnProperty(key)) {

            actualValue = args[key];
            hasError = expected[key] !== actualValue;

            if (hasError) break;
          }
        }

        if (!hasError) {
          for (key in expected) {
            if (expected.hasOwnProperty(key)) {

              actualValue = args[key];
              hasError = expected[key] !== actualValue;

              if (hasError) break;

            }
          }
        }

        this.message = function() {
          if (hasError) {
            return 'Expected ' + key + ' ' + actualValue + ' to be ' + expected[key];
          }
        }

        return !hasError;
      }
    });
  });

  describe('the case where everything works', function() {
    var transformLinkID = 1,
        longLink = 'http://google.com';

    beforeEach(function() {
      spyOn(db, 'addNewLinkHit').andCallFake(function() {
        return resolveAPromise(longLink);
      });
      spyOn(db, 'logActivity').andCallFake(function() { return resolveAPromise(); });
      spyOn(db, 'logError').andCallFake(function() { return resolveAPromise() });

      r.resolveURL({
        url: url,
        client: client,
        userAgent: userAgent
      }).then(spy, notCalled);
    });

    afterEach(function() {
      expect(db.logError).not.toHaveBeenCalled();
    });

    xit('should resolve the shortened URL to a link ID', function() {
      spyOn(transform, 'uriToLinkID').andCallThrough();
      expect(transform.uriToLinkID).toHaveBeenCalledWith(url);
    });

    it('should push a new hit onto the link', function() {
      var linkID = db.addNewLinkHit.mostRecentCall.args[0],
          hitInfo = db.addNewLinkHit.mostRecentCall.args[1];

      expect(linkID).toBe(transformLinkID);
      expect(hitInfo.client).toEqual(client);
      expect(hitInfo.userAgent).toEqual(userAgent);
    });

    xit('should resolve the promise with the original link', function() {
      expect(spy).toHaveBeenCalledWith(longLink);
      expect(notCalled).not.toHaveBeenCalled();
    });

    xit('should log activity when a link is resolved', function() {
      expect(db.logActivity).toHaveLogged({
        message: 'Link hit',
        linkID: transformLinkID
      });
    });
  });

  describe('how missing input is handled', function() {
    var unknown = 'Unknown',
        longLink = 'http://google.com';

    beforeEach(function() {
      spyOn(transform, 'uriToLinkID').andCallThrough();
      spyOn(db, 'addNewLinkHit').andCallFake(function() {
        return resolveAPromise(longLink);
      });
      spyOn(db, 'logActivity').andCallFake(function() { return resolveAPromise(); });
      spyOn(db, 'logError').andCallFake(function() { return resolveAPromise() });
    });

    it('should set a missing client to Unknown', function() {
      var args;

      r.resolveURL({
        url: url,
        userAgent: userAgent
      }).then(spy, notCalled);

      expect(spy).toHaveBeenCalledWith(longLink);
      expect(notCalled).not.toHaveBeenCalled();

      args = db.addNewLinkHit.mostRecentCall.args;

      expect(args[0]).toEqual(1);
      expect(args[1].userAgent).toEqual(userAgent);
      expect(args[1].client).toEqual(unknown);
    });

    it('should set a missing userAgent to Unknown', function() {
      var args;

      r.resolveURL({
        url: url,
        client: client
      }).then(spy, notCalled);

      expect(spy).toHaveBeenCalledWith(longLink);
      expect(notCalled).not.toHaveBeenCalled();

      args = db.addNewLinkHit.mostRecentCall.args;

      expect(args[0]).toEqual(1);
      expect(args[1].userAgent).toEqual(unknown);
      expect(args[1].client).toEqual(client);
    });
  });

  describe('error handling when the URL is invalid', function() {
    var invalidUrl = 'Invalid',
        longLink = 'http://google.com';

    beforeEach(function() {
      spyOn(db, 'addNewLinkHit').andCallFake(function() {
        return resolveAPromise(longLink);
      });
      spyOn(db, 'logActivity').andCallFake(function() { return resolveAPromise(); });
      spyOn(db, 'logError').andCallFake(function() { return resolveAPromise() });
    });

    it('should reject the promise if the shortened URL is undefined', function() {
      r.resolveURL({
        client: client,
        userAgent: userAgent
      }).then(notCalled, spy);

      expect(spy).toHaveBeenCalledWith('Missing or invalid URI', 404);
      expect(notCalled).not.toHaveBeenCalled();
    });

    it('should log an error if the shortened URL is undefined', function() {
      r.resolveURL({
        client: client,
        userAgent: userAgent
      }).then(notCalled, spy);

      expect(db.logActivity).not.toHaveBeenCalled();
      expect(db.logError).toHaveLogged({
        message: 'Missing or invalid URI',
        url: undefined,
        client: client,
        code: 404
      });
    });

    it('should reject the promise if shortened URL is invalid', function() {
      r.resolveURL({
        url: invalidUrl,
        client: client,
        userAgent: userAgent
      }).then(notCalled, spy);

      expect(spy).toHaveBeenCalledWith('Missing or invalid URI', 404);
      expect(notCalled).not.toHaveBeenCalled();
    });

    it('should log an error if the shortened URL is invalid', function() {
      r.resolveURL({
        url: invalidUrl,
        client: client,
        userAgent: userAgent
      }).then(notCalled, spy);

      expect(db.logActivity).not.toHaveBeenCalled();
      expect(db.logError).toHaveLogged({
        message: 'Missing or invalid URI',
        url: invalidUrl,
        client: client,
        code: 404
      });
    });
  });

  describe('error handling when the original link cannot be found', function() {
    var message = 'Missing or invalid URI',
        error = 'Long link for ID x not found',
        code = 404;

    beforeEach(function() {
      spyOn(db, 'addNewLinkHit').andCallFake(function() {
        return rejectAPromise({
          message: message,
          error: error,
          code: 404
        });
      });
      spyOn(db, 'logActivity').andCallFake(function() { return resolveAPromise(); });
      spyOn(db, 'logError').andCallFake(function() { return resolveAPromise() });

      r.resolveURL({
        url: url,
        client: client,
        userAgent: userAgent
      }).then(notCalled, spy);

    });

    it('should reject the promise', function() {
      expect(spy).toHaveBeenCalledWith(message, code);
      expect(notCalled).not.toHaveBeenCalled();
    });

    it('should log an error', function() {
      expect(db.logError).toHaveLogged({
        message: message,
        error: error,
        code: code
      });
      expect(db.logActivity).not.toHaveBeenCalled();
    });

  });

  describe('error handling after database errors', function() {
    it('should log an error if updating a link fails', function() {
      var message = 'Database error updating resolved link for ID x',
          code = 500,
          error = 'Some error';

      spyOn(db, 'addNewLinkHit').andCallFake(function() {
        return rejectAPromise({
          message: message,
          error: error,
          code: code
        });
      });

      spyOn(db, 'logActivity').andCallFake(function() { return resolveAPromise() });
      spyOn(db, 'logError').andCallFake(function() { return resolveAPromise() });

      r.resolveURL({
        url: url,
        client: client,
        userAgent: userAgent
      }).then(notCalled, spy);

      expect(spy).toHaveBeenCalledWith(message, code);
      expect(notCalled).not.toHaveBeenCalled();

      expect(db.logActivity).not.toHaveBeenCalled();
      expect(db.logError).toHaveLogged({
        message: message,
        error: error,
        code: code
      });
    });

    it('should log an error if logging activity fails', function() {
      var message = 'Database error writing to the activity log',
          code = 500,
          error = 'Some error',
          longLink = 'http://google.com';

      spyOn(db, 'addNewLinkHit').andCallFake(function() {
        return resolveAPromise(longLink);
      });

      spyOn(db, 'logActivity').andCallFake(function() {
        return rejectAPromise({
          message: message,
          error: error,
          code: code
        });
      });
      spyOn(db, 'logError').andCallFake(function() { return resolveAPromise() });

      r.resolveURL({
        url: url,
        client: client,
        userAgent: userAgent
      }).then(notCalled, spy);


      expect(db.logActivity).toHaveBeenCalled();
      expect(db.logError).toHaveLogged({
        message: message,
        error: error,
        code: code
      });
    });

    it('should throw an error if logging an error fails', function() {
      var message = 'Database error writing to the activity log',
          code = 500,
          error = 'Some error',
          longLink = 'http://google.com',
          errStr = 'Could not write to error log';;

      spyOn(db, 'addNewLinkHit').andCallFake(function() {
        return resolveAPromise(longLink);
      });

      spyOn(db, 'logActivity').andCallFake(function() {
        return rejectAPromise({
          message: message,
          error: error,
          code: code
        });
      });
      spyOn(db, 'logError').andCallFake(function() {
        return rejectAPromise({
          message: errStr,
          error: error,
          code: code
        });
      });

      expect(function() {
        r.resolveURL({
          url: url,
          client: client,
          userAgent: userAgent
        }).then(notCalled, spy);
      }).toThrow(errStr);
    });
  });
});
