/**
 * Unit tests for the Kili.us server logging module
 * Author: Jeff Horak
 * Date: 7/6/12
 */

/*globals describe beforeEach jasmine spyOn it expect*/

var logging = require(__dirname + '/../src/node_modules/modLogging'),
    db = require(__dirname + '/../src/node_modules/modDatabase/dbService.js'),
    helpers = require('./testing.helpers.js');

describe('the logging modules', function() {

  var payload = { message: 'Test123', client: 321 },
      errPayload = { message: 'Database error writing to the activity log', error: 'Error', code: 500 };

  beforeEach(function() {
    this.addMatchers({
      toHaveLogged: helpers.equalObjectMatcher
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

      spyOn(db, 'logActivity').andCallFake(function() {
        return helpers.rejectAPromise(errPayload);
      });

      logging.log(payload);

      expect(db.logActivity).toHaveBeenCalled();
      expect(db.logError).toHaveBeenCalled();

      expect(db.logActivity).toHaveLogged(payload);
      expect(db.logError).toHaveLogged(errPayload);
    });

  });

  describe('Logging errors', function() {

    it('should pass the payload to the database layer', function() {
      spyOn(db, 'logError').andCallFake(function() { return helpers.resolveAPromise(); });

      expect(function() {
        logging.error(errPayload);
      }).not.toThrow();

      expect(db.logError).toHaveBeenCalled();
      expect(db.logError).toHaveLogged(errPayload);
    });

    it('should throw the error if the database fails', function() {
      var message = 'Some error';

      spyOn(db, 'logError').andCallFake(function() {
        return helpers.rejectAPromise(message);
      });

      expect(function() {
        logging.error(errPayload);
      }).toThrow(message);

      expect(db.logError).toHaveBeenCalled();
      expect(db.logError).toHaveLogged(errPayload);
    });

  });
});

