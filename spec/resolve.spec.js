/**
 * Unit tests for resolving a shortened link
 * Author: Jeff Horak
 * Date: 6/20/12
 */

/*globals describe expect it beforeEach afterEach jasmine spyOn */

var helper    = require('./testing.helpers.js'),
    r         = helper.resolve,
    Promise   = helper.Promise,
    logging   = helper.logging,
    transform = helper.transform,
    db        = helper.db;

describe('resolving a shortened link', function() {
  var spy,
      notCalled,
      client = '192.168.1.1',
      url = '/+/2',
      userAgent = 'Mozilla';

  beforeEach(function() {
    spy = jasmine.createSpy();
    notCalled = jasmine.createSpy();

    spyOn(logging, 'log');
    spyOn(logging, 'error');

    this.addMatchers({

      toHaveLogged: helper.equalObjectMatcher
    });
  });

  describe('the case where everything works', function() {
    var transformLinkID = 1,
        longLink = 'http://google.com';

    beforeEach(function() {
      spyOn(db, 'addNewLinkHit').andCallFake(function() {
        return helper.resolveAPromise(longLink);
      });

      spyOn(transform, 'uriToLinkID').andCallThrough();

      r.resolveURL({
        url: url,
        client: client,
        userAgent: userAgent
      }).then(spy, notCalled);
    });

    afterEach(function() {
      expect(logging.error).not.toHaveBeenCalled();
    });

    it('should resolve the shortened URL to a link ID', function() {
      expect(transform.uriToLinkID).toHaveBeenCalledWith(url);
    });

    it('should push a new hit onto the link', function() {
      var linkID = db.addNewLinkHit.mostRecentCall.args[0],
          hitInfo = db.addNewLinkHit.mostRecentCall.args[1];

      expect(linkID).toBe(transformLinkID);
      expect(hitInfo.client).toEqual(client);
      expect(hitInfo.userAgent).toEqual(userAgent);
    });

    it('should resolve the promise with the original link', function() {
      expect(spy).toHaveBeenCalledWith(longLink);
      expect(notCalled).not.toHaveBeenCalled();
    });

    it('should log activity when a link is resolved', function() {
      expect(logging.log).toHaveLogged({
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
        return helper.resolveAPromise(longLink);
      });
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
        return helper.resolveAPromise(longLink);
      });

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

      expect(logging.log).not.toHaveBeenCalled();
      expect(logging.error).toHaveLogged({
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

      expect(logging.log).not.toHaveBeenCalled();
      expect(logging.error).toHaveLogged({
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
        return helper.rejectAPromise({
          message: message,
          error: error,
          code: 404
        });
      });

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
      expect(logging.error).toHaveLogged({
        message: message,
        error: error,
        code: code
      });
      expect(logging.log).not.toHaveBeenCalled();
    });

  });

  describe('error handling after database errors', function() {
    it('should log an error if updating a link fails', function() {
      var message = 'Database error updating resolved link for ID x',
          code = 500,
          error = 'Some error';

      spyOn(db, 'addNewLinkHit').andCallFake(function() {
        return helper.rejectAPromise({
          message: message,
          error: error,
          code: code
        });
      });

      r.resolveURL({
        url: url,
        client: client,
        userAgent: userAgent
      }).then(notCalled, spy);

      expect(spy).toHaveBeenCalledWith(message, code);
      expect(notCalled).not.toHaveBeenCalled();

      expect(logging.log).not.toHaveBeenCalled();
      expect(logging.error).toHaveLogged({
        message: message,
        error: error,
        code: code
      });
    });
  });
});
