/**
 * URL Shortening unit tests
 * Author: Jeff Horak
 */

/*globals describe beforeEach jasmine expect waitsFor runs waits it spyOn */

var shorten = require(__dirname + '/../src/node_modules/modShorten/shortenURL.js'),
    Promise = require(__dirname + '/../src/node_modules/modPromise').Promise,
    opt = require(__dirname + '/../src/node_modules/modOptions'),
    db = require(__dirname + '/../src/node_modules/modDatabase'),
    logging = require(__dirname + '/../src/node_modules/modLogging'),
    helper = require('./testing.helpers.js');

describe('shortening a hyperlink', function() {
  var spy, notCalled;

  beforeEach(function() {
    spy = jasmine.createSpy();
    notCalled = jasmine.createSpy();

    spyOn(logging, 'log');
    spyOn(logging, 'error');

    this.addMatchers({

      toHaveLogged: helper.equalObjectMatcher
    });
  });

  describe('verifying a hyperlink is legal', function() {

    it('should only accept URLs using the HTTP protocol', function() {

      expect(shorten.validateURL('ftp://jeffhorak.com')).toBe(false);
      expect(shorten.validateURL('telnet://jeffhorak.com')).toBe(false);
      expect(shorten.validateURL('http://jeffhorak.com')).toBe(true);
      expect(shorten.validateURL('https://jeffhorak.com')).toBe(true);

    });

    it('should reject invalid HTTP URLs', function() {

      expect(shorten.validateURL('http:www.jeffhorak.com')).toBe(false);
      expect(shorten.validateURL('http://www.jeffhorak')).toBe(false);
      expect(shorten.validateURL('http://ww.jeffhorak')).toBe(false);
      expect(shorten.validateURL('http://www.jeff<horak.com')).toBe(false);
      expect(shorten.validateURL('http://www.jeff horak.com')).toBe(false);
      expect(shorten.validateURL('http://jeffhorak')).toBe(false);

    });

    it('should accept an IPv4 address', function() {
      expect(shorten.validateURL('http://127.0.0.1')).toBe(true);
      expect(shorten.validateURL('https://127.0.0.1')).toBe(true);
    });

    it('should accept an IPv6 address', function() {
      expect(shorten.validateURL('http://0:0:0:0:0:0:0:1')).toBe(true);
      expect(shorten.validateURL('https://0:0:0:0:0:0:0:1')).toBe(true);
    });

    it('should only accept URLs shorter than 2048 characters in length', function() {
      // Over the limit
      expect(shorten.validateURL(['http://www.', new Array(2048).join('a'), '.com'].join(''))).toBe(false);
      // At the limit
      expect(shorten.validateURL(['http://www.', new Array(2033).join('a'), '.com'].join(''))).toBe(true);
    });

  });

  describe('rejecting input that does not validate', function() {

    beforeEach(function() {
      spyOn(db, 'getNextLinkID').andCallFake(function() {
        return helper.resolveAPromise(1);
      });

      spyOn(db, 'insertLink').andCallFake(function() {
        return helper.resolveAPromise();
      });
    });

    it('should reject the shortening promise and write to the error log if the input does not validate', function() {
      var client = '192.168.1.1',
          url = 'abc123';

      shorten.shortenURL({
        url: url,
        client: client
      }).then(notCalled, spy);

      expect(spy).toHaveBeenCalledWith('Oops. You\'ve entered an invalid URL.', 400);
      expect(logging.error).toHaveLogged({
        message: 'Failed URL validation',
        client: client,
        url: url,
        code: 400
      });
      expect(logging.log).not.toHaveBeenCalled();
      expect(notCalled).not.toHaveBeenCalled();
    });

    it('should reject the shortening promise and write to the error log if the input is missing the URL', function() {
      var client = '192.168.1.1';
      shorten.shortenURL({
        client: client
      }).then(notCalled, spy);

      expect(spy).toHaveBeenCalledWith('Oops. You\'ve entered an invalid URL.', 400);
      expect(logging.error).toHaveLogged({
        message: 'Failed URL validation',
        client: client,
        code: 400
      });
      expect(logging.log).not.toHaveBeenCalled();
      expect(notCalled).not.toHaveBeenCalled();
    });

    it('should reject the shortening promise and write to the error log if the input is missing the client', function() {
      var url = 'http://www.hp.com';
      shorten.shortenURL({
        url: url
      }).then(notCalled, spy);

      expect(spy).toHaveBeenCalledWith('Validation error', 400);
      expect(logging.error).toHaveLogged({
        message: 'Failed client validation',
        url: url,
        code: 400
      });
      expect(logging.log).not.toHaveBeenCalled();
      expect(notCalled).not.toHaveBeenCalled();
    });
  });

  describe('throttling users', function() {

    beforeEach(function() {

      opt.throttleLimit = 1;
      opt.throttleTime = 50;

      spyOn(db, 'getNextLinkID').andCallFake(function() {
        return helper.resolveAPromise(1);
      });

      spyOn(db, 'insertLink').andCallFake(function() {
        return helper.resolveAPromise();
      });
    });

    it('should throttle users to a number of links in a predefined time period', function() {
      var url = 'http://github.com',
          client = '192.168.1.1';

      // Shorten a link
      shorten.shortenURL({
        url: url,
        client: client
      }).then(spy);

      // It should correctly shorten the link
      expect(spy).toHaveBeenCalledWith('http://kili.us/+/2', 1);
      expect(logging.error).not.toHaveBeenCalled();

      url = 'http://kili.us';
      client = '192.168.1.1';

      // Try shortening a second link with the same client
      shorten.shortenURL({
        url: url,
        client: client
      }).then(notCalled, spy);

      // Should reject because the throttling limit was reached
      expect(spy).toHaveBeenCalledWith('Pace yourself. You\'ve reached your daily shortening limit.', 429);
      expect(logging.error).toHaveLogged({
        message: 'User data throttle limit hit',
        client: client,
        url: url,
        code: 429
      });

      logging.error.reset();
      url = 'http://jeffhorak.com';
      client = '192.168.1.2';

      // Try shortening a third link with a different client
      shorten.shortenURL({
        url: url,
        client: client
      }).then(spy);

      expect(spy).toHaveBeenCalledWith('http://kili.us/+/2', 1);
      expect(logging.error).not.toHaveBeenCalled();
    });

    it('should remove the throttling after the time period has elapsed', function() {

      runs(function() {
        // Shorten a link
        shorten.shortenURL({
          url: 'http://www.yahoo.com',
          client: '192.168.1.3'
        }).then(spy);

        expect(spy).toHaveBeenCalledWith('http://kili.us/+/2', 1);
        spy.reset();
      });

      waits(50);

      runs(function() {
        // Throttling for this user should have expired
        shorten.shortenURL({
          url: 'http://www.google.com',
          client: '192.168.1.3'
        }).then(spy, notCalled);

        expect(spy).toHaveBeenCalledWith('http://kili.us/+/2', 1);
        expect(notCalled).not.toHaveBeenCalled();
      });
    });

  });

  describe('returning a shortened link', function() {

    it('should return unique shortened links', function() {
      var linkID = 0,
          i = 1;

      opt.throttleLimit = 10;

      spyOn(db, 'getNextLinkID').andCallFake(function() {
        return helper.resolveAPromise(++linkID);
      });

      spyOn(db, 'insertLink').andCallFake(function() {
        return helper.resolveAPromise();
      });

      // Write 5 links
      for (; i <= 5; i++) {
        shorten.shortenURL({
          url: 'http://twitter.com',
          client: '192.168.1.4'
        }).then(spy, notCalled);

        expect(spy).toHaveBeenCalledWith('http://kili.us/+/' + (i + 1), i);
        expect(notCalled).not.toHaveBeenCalled();
        expect(logging.log).toHaveBeenCalled();
        expect(logging.error).not.toHaveBeenCalled();
      }

    });

  });

  describe('writing to the activity log', function() {

    it('should log activity when a new link is shortened', function() {
      var url = 'http://arstechnica.com',
          client = '192.168.1.6';

      spyOn(db, 'getNextLinkID').andCallFake(function() {
        return helper.resolveAPromise(1);
      });

      spyOn(db, 'insertLink').andCallFake(function() {
        return helper.resolveAPromise();
      });

      shorten.shortenURL({
        url: url,
        client: client
      }).then(spy, notCalled);

      expect(spy).toHaveBeenCalled();
      expect(notCalled).not.toHaveBeenCalled();
      expect(logging.log).toHaveLogged({
        message: 'Link created',
        client: client
      });
    });

  });

  describe('handling database errors', function() {

    describe('errors while getting the next link ID', function() {

      var logMessage = 'Database error incrementing links counter',
          logError = 'Some error',
          clientMessage = 'A database error occurred while shortening the link',
          code = 500;

      beforeEach(function() {
        spyOn(db, 'getNextLinkID').andCallFake(function() {
          return helper.rejectAPromise({
            message: logMessage,
            error: logError,
            code: code
          });
        });

        spyOn(db, 'insertLink').andCallFake(function() {
          return helper.resolveAPromise();
        });

      });

      it('should write errors to the error log', function() {
        var url = 'http://espn.com',
            client = '192.168.1.5';

        shorten.shortenURL({
          url: url,
          client: client
        }).then(notCalled, spy);

        expect(logging.error).toHaveLogged({
          message: logMessage,
          error: logError,
          code: code
        });

        expect(notCalled).not.toHaveBeenCalled();
        expect(spy).toHaveBeenCalledWith(clientMessage, code);
      });

    });

    describe('errors while inserting a link into the database', function() {
      var logMessage = 'Database error inserting into links database',
          logError = 'Some error',
          clientMessage = 'A database error occurred while shortening the link',
          code = 500;

      beforeEach(function() {
        spyOn(db, 'getNextLinkID').andCallFake(function() {
          return helper.resolveAPromise(1);
        });

        spyOn(db, 'insertLink').andCallFake(function() {
          return helper.rejectAPromise({
            message:logMessage,
            error: logError,
            code: code
          });
        });

      });

      it('should write errors to the error log', function() {

        shorten.shortenURL({
          url: 'http://cnn.com',
          client: '192.168.1.5'
        }).then(notCalled, spy);

        expect(logging.error).toHaveLogged({
          message: logMessage,
          error: logError,
          code: code
        });
        expect(notCalled).not.toHaveBeenCalled();
        expect(spy).toHaveBeenCalledWith(clientMessage, code);
      });

    });

  });

});