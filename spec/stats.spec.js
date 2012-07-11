/**
 * Unit tests for the statistics service in Kili.us server
 * Author: Jeff Horak
 * Date: 7/6/12
 */

/*globals describe beforeEach jasmine spyOn it expect*/

var stats = require(__dirname + '/../src/node_modules/modStats'),
    Promise = require(__dirname + '/../src/node_modules/modPromise').Promise,
    db = require(__dirname + '/../src/node_modules/modDatabase'),
    options = require(__dirname + '/../src/node_modules/modOptions'),
    logging = require(__dirname + '/../src/node_modules/modLogging'),
    helper = require('./testing.helpers.js');

describe('the statistics module', function() {
  var spy,
      notCalled;

  beforeEach(function() {
    spy = jasmine.createSpy();
    notCalled = jasmine.createSpy();

    this.addMatchers({
      toHaveBeenCalledWithObject: helper.equalObjectMatcher
    });
  });

  describe('getting links for a user', function() {

    var payload = {
      page: 0,
      clientID: 'abc123'
    };

    it('should call to the database', function() {
      var dbPayload = {
        page: payload.page,
        clientID: payload.clientID,
        pageSize: options.statsPageLimit
      };

      spyOn(db, 'linksForUser').andCallFake(function() {
        return new Promise();
      });

      stats.linksForUser(payload);
      expect(db.linksForUser).toHaveBeenCalledWithObject(dbPayload);
    });

    it('should return a Promise', function() {
      var promise;
      spyOn(db, 'linksForUser').andCallFake(function() {
        return new Promise();
      });

      promise = stats.linksForUser(payload);

      expect(promise instanceof Promise).toBe(true);
    });

    describe('a successful transaction', function() {
      var results = 'results';

      beforeEach(function() {
        spyOn(db, 'linksForUser').andCallFake(function() {
          return helper.resolveAPromise(results);
        });

        spyOn(logging, 'log');
      });

      it('should resolve the Promise with the links for the user', function() {

        stats.linksForUser(payload).then(spy, notCalled);

        expect(spy).toHaveBeenCalledWith(results);
        expect(notCalled).not.toHaveBeenCalled();

      });

      it('should log activity', function() {

        stats.linksForUser(payload);

        expect(logging.log).toHaveBeenCalledWithObject({
          message: 'Fetched links for user',
          client: payload.clientID
        });

      });
    });

    describe('an unsuccessful transaction', function() {
      var defaultErr = { message: 'Database error', code: 500 },
          customErr = { message: 'User error', code: 404 };

      beforeEach(function() {
        spyOn(logging, 'error');
      });

      it('should reject the Promise', function() {
        spyOn(db, 'linksForUser').andCallFake(function() {
          return helper.rejectAPromise(customErr);
        });

        stats.linksForUser(payload).then(notCalled, spy);

        expect(spy).toHaveBeenCalledWith(customErr.message, customErr.code);
        expect(notCalled).not.toHaveBeenCalled();
      });

      it('should log the error provided by the database', function() {
        spyOn(db, 'linksForUser').andCallFake(function() {
          return helper.rejectAPromise(customErr);
        });

        stats.linksForUser(payload);
        expect(logging.error).toHaveBeenCalledWithObject(customErr);
      });

      it('should log a default error when the database returns nothing', function() {
        spyOn(db, 'linksForUser').andCallFake(function() {
          return helper.rejectAPromise();
        });

        stats.linksForUser(payload);
        expect(logging.error).toHaveBeenCalledWithObject(defaultErr);

      });
    });
  });
});


