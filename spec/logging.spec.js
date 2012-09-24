/**
 * Unit tests for the Kili.us server logging module
 * Author: Jeff Horak
 * Date: 7/6/12
 */

/*globals describe beforeEach jasmine spyOn it expect*/

var helpers = require('./testing.helpers.js'),
    logging = helpers.logging,
    db      = helpers.db;

describe('the logging modules', function() {

  var payload = { message: 'Test123', client: 321 },
      errPayload = { message: 'Database error writing to the activity log', error: 'Error', code: 500 };

  beforeEach(function() {
    this.addMatchers({
      toHaveLogged: helpers.equalObjectMatcher,
      toHavePayload: function(expected) {
        var args = this.actual.wasCalled ? this.actual.mostRecentCall.args[0] : {};

        this.message = function() {
          return "Expected " + expected + " to be a substring of " + args;
        };

        return args.indexOf(expected) >= 0;
      }
    });
  });

  describe('Logging activity', function() {

    beforeEach(function() {
      spyOn(db, 'logError').andCallFake(function() { return helpers.resolveAPromise(); });
    });

    it('should pass the payload to the database layer', function() {

      spyOn(db, 'logActivity').andCallFake(function() { return helpers.resolveAPromise(); });

      logging.log(payload);

      expect(db.logActivity).toHaveBeenCalled();
      expect(db.logError).not.toHaveBeenCalled();

      expect(db.logActivity).toHaveLogged(payload);
    });

    it('should try to log an error if the database fails', function() {

      spyOn(console, 'log');
      spyOn(console, 'error');
      spyOn(db, 'logActivity').andCallFake(function() {
        return helpers.rejectAPromise(errPayload);
      });

      logging.log(payload);

      expect(db.logActivity).toHaveBeenCalled();
      expect(db.logError).toHaveBeenCalled();

      expect(db.logActivity).toHaveLogged(payload);
      expect(db.logError).toHaveLogged(errPayload);
    });

    it('should write to stdout if the process was started as a service', function() {

      spyOn(console, 'log');
      spyOn(db, 'logActivity').andCallFake(function() { return helpers.resolveAPromise(); });

      logging.setServiceMode(true);
      logging.log(payload);

      expect(console.log).toHavePayload(payload.message);
    });

  });

  describe('Logging errors', function() {

    it('should pass the payload to the database layer', function() {
      spyOn(console, 'error');
      spyOn(db, 'logError').andCallFake(function() { return helpers.resolveAPromise(); });

      expect(function() {
        logging.error(errPayload);
      }).not.toThrow();

      expect(db.logError).toHaveBeenCalled();
      expect(db.logError).toHaveLogged(errPayload);
    });

    it('should throw the error if the database fails', function() {
      var message = 'Some error';
      spyOn(console, 'error');
      spyOn(db, 'logError').andCallFake(function() {
        return helpers.rejectAPromise(message);
      });

      expect(function() {
        logging.error(errPayload);
      }).toThrow(message);

      expect(db.logError).toHaveBeenCalled();
      expect(db.logError).toHaveLogged(errPayload);
    });

    it('should write to stderr', function() {

      spyOn(console, 'error');
      spyOn(db, 'logError').andCallFake(function() {
        return helpers.resolveAPromise();
      });

      logging.error(errPayload);

      expect(console.error).toHavePayload(errPayload.message);
    });

  });
});

