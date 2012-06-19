/**
 * URL Shortening unit tests
 */

var s = require(__dirname + '/../src/node_modules/modShorten/shortenURL.js'),
    Promise = require(__dirname + '/../src/node_modules/modPromise').Promise,
    opt = require(__dirname + '/../src/node_modules/modOptions'),
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

describe('shortening a hyperlink', function() {
  var spy, notCalled;

  beforeEach(function() {
    spy = jasmine.createSpy();
    notCalled = jasmine.createSpy();

    this.addMatchers({
      toHaveLogged: function(expected) {
        var args = this.actual.mostRecentCall.args[0],
            messageTxt = args.message,
            client = args.client,
            url = args.url,
            messageTest = messageTxt === expected.message,
            clientTest = client === expected.client,
            urlTest = url === expected.url;

        this.message = function() {
          if (!messageTest) { return 'Expected message ' + messageTxt + ' to be ' + expected.message; }
          if (!clientTest) { return 'Expected client ' + client + ' to be ' + expected.client; }
          return 'Expected url ' + url + ' to be ' + expected.url;
        }

        return messageTest && clientTest && urlTest;
      }
    });
  })

  describe('verifying a hyperlink is legal', function() {

    it('should only accept URLs using the HTTP protocol', function() {

      expect(s.validateURL('ftp://jeffhorak.com')).toBe(false);
      expect(s.validateURL('telnet://jeffhorak.com')).toBe(false);
      expect(s.validateURL('http://jeffhorak.com')).toBe(true);
      expect(s.validateURL('https://jeffhorak.com')).toBe(true);

    });

    it('should reject invalid HTTP URLs', function() {

      expect(s.validateURL('http:www.jeffhorak.com')).toBe(false);
      expect(s.validateURL('http://www.jeffhorak')).toBe(false);
      expect(s.validateURL('http://ww.jeffhorak')).toBe(false);
      expect(s.validateURL('http://www.jeff<horak.com')).toBe(false);
      expect(s.validateURL('http://www.jeff horak.com')).toBe(false);
      expect(s.validateURL('http://jeffhorak')).toBe(false);

    });

    it('should accept an IPv4 address', function() {
      expect(s.validateURL('http://127.0.0.1')).toBe(true);
      expect(s.validateURL('https://127.0.0.1')).toBe(true);
    });

    it('should accept an IPv6 address', function() {
      expect(s.validateURL('http://0:0:0:0:0:0:0:1')).toBe(true);
      expect(s.validateURL('https://0:0:0:0:0:0:0:1')).toBe(true);
    });

    it('should only accept URLs shorter than 2048 characters in length', function() {
      // Over the limit
      expect(s.validateURL(['http://www.', new Array(2048).join('a'), '.com'].join(''))).toBe(false);
      // At the limit
      expect(s.validateURL(['http://www.', new Array(2033).join('a'), '.com'].join(''))).toBe(true);
    });

  });

  describe('rejecting input that does not validate', function() {

    beforeEach(function() {
      spyOn(db, 'getNextLinkID').andCallFake(function() {
        return resolveAPromise(1);
      });

      spyOn(db, 'insertLink').andCallFake(function() {
        return resolveAPromise();
      });

      spyOn(db, 'logError').andCallFake(function() {
        return resolveAPromise();
      });

      spyOn(db, 'logActivity').andCallFake(function() {
        return resolveAPromise();
      });
    });

    it('should reject the shortening promise and write to the error log if the input does not validate', function() {
      var client = '192.168.1.1',
          url = 'abc123';

      s.shorten({
        url: url,
        client: client
      }).then(notCalled, spy);

      expect(spy).toHaveBeenCalledWith('Oops. You\'ve entered an invalid URL.', 400);
      expect(db.logError).toHaveLogged({
        message: 'Failed URL validation',
        client: client,
        url: url
      });
      expect(db.logActivity).not.toHaveBeenCalled();
      expect(notCalled).not.toHaveBeenCalled();
    });

    it('should reject the shortening promise and write to the error log if the input is missing the URL', function() {
      var client = '192.168.1.1';
      s.shorten({
        client: client
      }).then(notCalled, spy);

      expect(spy).toHaveBeenCalledWith('Oops. You\'ve entered an invalid URL.', 400);
      expect(db.logError).toHaveLogged({
        message: 'Failed URL validation',
        client: client
      });
      expect(db.logActivity).not.toHaveBeenCalled();
      expect(notCalled).not.toHaveBeenCalled();
    });

    it('should reject the shortening promise and write to the error log if the input is missing the client', function() {
      var url = 'http://www.hp.com';
      s.shorten({
        url: url
      }).then(notCalled, spy);

      expect(spy).toHaveBeenCalledWith('Validation error', 400);
      expect(db.logError).toHaveLogged({
        message: 'Failed client validation',
        url: url
      });
      expect(db.logActivity).not.toHaveBeenCalled();
      expect(notCalled).not.toHaveBeenCalled();
    });
  });

  describe('throttling users', function() {

    beforeEach(function() {

      opt.throttleLimit = 1;
      opt.throttleTime = 50;

      spyOn(db, 'getNextLinkID').andCallFake(function() {
        return resolveAPromise(1);
      });

      spyOn(db, 'insertLink').andCallFake(function() {
        return resolveAPromise();
      });

      spyOn(db, 'logActivity').andCallFake(function() {
        return resolveAPromise();
      });

      spyOn(db, 'logError').andCallFake(function() {
        return resolveAPromise();
      });
    });

    it('should throttle users to a number of links in a predefined time period', function() {
      var url = 'http://github.com',
          client = '192.168.1.1';

      // Shorten a link
      s.shorten({
        url: url,
        client: client
      }).then(spy);

      // It should correctly shorten the link
      expect(spy).toHaveBeenCalledWith('http://kili.us/+/2', 1);
      expect(db.logError).not.toHaveBeenCalled();

      url = 'http://kili.us';
      client = '192.168.1.1';

      // Try shortening a second link with the same client
      s.shorten({
        url: url,
        client: client
      }).then(notCalled, spy);

      // Should reject because the throttling limit was reached
      expect(spy).toHaveBeenCalledWith('Pace yourself. You\'ve reached your daily shortening limit.', 429);
      expect(db.logError).toHaveLogged({
        message: 'User data throttle limit hit',
        client: client,
        url: url
      });

      db.logError.reset();
      url = 'http://jeffhorak.com';
      client = '192.168.1.2';

      // Try shortening a third link with a different client
      s.shorten({
        url: url,
        client: client
      }).then(spy);

      expect(spy).toHaveBeenCalledWith('http://kili.us/+/2', 1);
      expect(db.logError).not.toHaveBeenCalled();
    });

    it('should remove the throttling after the time period has elapsed', function() {

      runs(function() {
        // Shorten a link
        s.shorten({
          url: 'http://www.yahoo.com',
          client: '192.168.1.3'
        }).then(spy);

        expect(spy).toHaveBeenCalledWith('http://kili.us/+/2', 1);
        spy.reset();
      });

      waits(50);

      runs(function() {
        // Throttling for this user should have expired
        s.shorten({
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
        return resolveAPromise(++linkID);
      });

      spyOn(db, 'insertLink').andCallFake(function() {
        return resolveAPromise();
      });

      // Write 5 links
      for (; i <= 5; i++) {
        s.shorten({
          url: 'http://twitter.com',
          client: '192.168.1.4'
        }).then(spy, notCalled);

        expect(spy).toHaveBeenCalledWith('http://kili.us/+/' + (i + 1), i);
        expect(notCalled).not.toHaveBeenCalled();
      }

    });

  });

  xdescribe('writing to the activity log', function() {

    it('should log activity when a new link is shortened', function() {
      spyOn(db, 'getNextLinkID').andCallFake(function() {
        return resolveAPromise(1);
      });

      spyOn(db, 'insertLink').andCallFake(function() {
        return resolveAPromise();
      });

      spyOn(db, 'logActivity').andCallFake(function() {
        return resolveAPromise();
      });

      s.shorten({
        url: 'http://arstechnica.com',
        client: '192.168.1.6'
      }).then(spy, notCalled);

      expect(spy).toHaveBeenCalled();
      expect(notCalled).not.toHaveBeenCalled();
      expect(db.logActivity).toHaveBeenCalledWith('Link created for user'); // TODO
    });

  });

  xdescribe('handling database errors', function() {

    describe('errors while getting the next link ID', function() {

      var logMessage = 'Database error incrementing links counter',
          logError = 'Some error',
          code = 500;

      beforeEach(function() {
        spyOn(db, 'getNextLinkID').andCallFake(function() {
          return rejectAPromise({
            logMessage: logMessage,
            error: logError,
            code: code
          });
        });

        spyOn(db, 'insertLink').andCallFake(function() {
          return resolveAPromise();
        });

      });

      it('should write errors to the error log', function() {
        spyOn(db, 'logError').andCallFake(function() {
          return resolveAPromise();
        });

        s.shorten({
          url: 'http://espn.com',
          client: '192.168.1.5'
        }).then(notCalled, spy);

        expect(db.logError).toHaveBeenCalledWith(logError);
        expect(notCalled).not.toHaveBeenCalled();
        expect(spy).toHaveBeenCalledWith(logMessage, code);
      });

      it('should throw if it cannot write to the error log', function() {
        var errStr = 'Could not write to error log';

        spyOn(db, 'logError').andCallFake(function() {
          return rejectAPromise(errStr);
        });

        expect(s.shorten({
          url: 'http://nytimes.com',
          client: '192.168.1.5'
        }).then(notCalled, spy)).toThrow(errStr);

        expect(db.logError).toHaveBeenCalledWith(logError);
        expect(notCalled).not.toHaveBeenCalled();
        expect(spy).toHaveBeenCalledWith(logMessage, code);
      });

    });

    describe('errors while inserting a link into the database', function() {
      var logMessage = 'Database error inserting into links database',
          logError = 'Some error',
          code = 500;

      beforeEach(function() {
        spyOn(db, 'getNextLinkID').andCallFake(function() {
          return resolveAPromise(1);
        });

        spyOn(db, 'insertLink').andCallFake(function() {
          return rejectAPromise({
            logMessage:logMessage,
            error: logError,
            code: code
          });
        });

      });

      it('should write errors to the error log', function() {
        spyOn(db, 'logError').andCallFake(function() {
          return resolveAPromise();
        });

        s.shorten({
          url: 'http://cnn.com',
          client: '192.168.1.5'
        }).then(notCalled, spy);

        expect(db.logError).toHaveBeenCalledWith(logError);
        expect(notCalled).not.toHaveBeenCalled();
        expect(spy).toHaveBeenCalledWith(logMessage, code);
      });

      it('should throw if it cannot write to the error log', function() {
        var errStr = 'Could not write to error log';

        spyOn(db, 'logError').andCallFake(function() {
          return rejectAPromise(errStr);
        });

        expect(s.shorten({
          url: 'http://amazon.com',
          client: '192.168.1.5'
        }).then(notCalled, spy)).toThrow(errStr);

        expect(db.logError).toHaveBeenCalledWith(logError);
        expect(notCalled).not.toHaveBeenCalled();
        expect(spy).toHaveBeenCalledWith(logMessage, code);
      });

    });

    describe('errors while writing to the activity log', function() {
      var logMessage = 'Database error writing to activity log',
          logError = 'Some error',
          code = 500;

      beforeEach(function() {
        spyOn(db, 'getNextLinkID').andCallFake(function() {
          return resolveAPromise(1);
        });

        spyOn(db, 'insertLink').andCallFake(function() {
          return resolveAPromise();
        });

        spyOn(db, 'logActivity').andCallFake(function() {
          return rejectAPromise({
            logMessage: logMessage,
            logError: logError,
            code: code
          });
        });

      });

      it('should write errors to the error log', function() {
        spyOn(db, 'logError').andCallFake(function() {
          return resolveAPromise();
        });

        s.shorten({
          url: 'http://netflix.com',
          client: '192.168.1.7'
        }).then(notCalled, spy);

        expect(db.logError).toHaveBeenCalledWith(logError);
        expect(notCalled).not.toHaveBeenCalled();
        expect(spy).toHaveBeenCalledWith(logMessage, code);
      });

      it('should throw if it cannot write to the error log', function() {
        var errStr = 'Could not write to error log';

        spyOn(db, 'logError').andCallFake(function() {
          return rejectAPromise(errStr);
        });

        expect(s.shorten({
          url: 'http://intel.com',
          client: '192.168.1.7'
        }).then(notCalled, spy)).toThrow(errStr);

        expect(db.logError).toHaveBeenCalledWith(logError);
        expect(notCalled).not.toHaveBeenCalled();
        expect(spy).toHaveBeenCalledWith(logMessage, code);
      });
    });

  });

});