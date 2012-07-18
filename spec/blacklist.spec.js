/**
 * Unit tests for client blacklisting module
 * Author: Jeff Horak
 * Date: 7/17/12
 */
/*globals describe expect it beforeEach jasmine spyOn */

var helper    = require('./testing.helpers.js'),
    blacklist = helper.blacklist,
    db        = helper.db,
    logging   = helper.logging,
    Promise   = helper.Promise;

describe('the blacklist module', function() {
  var spy,
      notCalled,
      message = 'An error occurred',
      code = 500,
      err = {
        message: message,
        code: code
      };

  beforeEach(function() {
    spy = jasmine.createSpy();
    notCalled = jasmine.createSpy();

    spyOn(logging, 'error');
  });

  describe('initializing the blacklist', function() {

    it('should populate the blacklist from the database', function() {
      spyOn(db, 'populateBlacklist').andReturn(new Promise());
      blacklist.initBlacklist();
      expect(db.populateBlacklist).toHaveBeenCalled();
    });

    it('should resolve the promise when the blacklist is returned from the database', function() {
      spyOn(db, 'populateBlacklist').andCallFake(function() {
        return helper.resolveAPromise([]);
      });

      blacklist.initBlacklist().then(spy, notCalled);

      expect(spy).toHaveBeenCalled();
      expect(notCalled).not.toHaveBeenCalled();
    });

    it('should reject the promise when an error is returned from the database', function() {

      spyOn(db, 'populateBlacklist').andCallFake(function() {
        return helper.rejectAPromise(err);
      });

      blacklist.initBlacklist().then(notCalled, spy);

      expect(spy).toHaveBeenCalledWith(message, code);
      expect(notCalled).not.toHaveBeenCalled();
    });

    it('should log an error after a database error', function() {
      var err = {
        message: 'An error occurred',
        code: 500
      };

      spyOn(db, 'populateBlacklist').andCallFake(function() {
        return helper.rejectAPromise(err);
      });

      blacklist.initBlacklist();
      expect(logging.error).toHaveBeenCalledWith(err);
    });
  });

  describe('determining if a client is blacklisted', function() {
    var client = 'abc123';

    beforeEach(function() {

      // Initialize the list with some data
      spyOn(db, 'populateBlacklist').andCallFake(function() {
        return helper.resolveAPromise([ { clientID: client } ]);
      });

      blacklist.initBlacklist();

    });

    it('should return true if a client is blacklisted', function() {
      expect(blacklist.isClientBlacklisted(client)).toBe(true);
    });

    it('should return false if a client is not blacklisted', function() {
      expect(blacklist.isClientBlacklisted('def456')).toBe(false);
    });
  });

  describe('adding a new blacklisted client', function() {
    var addedClient = 'abc123';

    beforeEach(function() {

      // Initialize an empty list
      spyOn(db, 'populateBlacklist').andCallFake(function() {
        return helper.resolveAPromise([]);
      });

      blacklist.initBlacklist();

    });

    it('should insert the record into the database', function() {
      spyOn(db, 'addToBlacklist').andReturn(new Promise());
      blacklist.addBlacklistedClient(addedClient);

      expect(db.addToBlacklist).toHaveBeenCalledWith(addedClient);
    });

    it('should mark the client as blacklisted', function() {
      spyOn(db, 'addToBlacklist').andCallFake(function() {
        return helper.resolveAPromise();
      });

      // Ensure the client is not blacklisted until we add them
      expect(blacklist.isClientBlacklisted(addedClient)).toBe(false);
      blacklist.addBlacklistedClient(addedClient);
      expect(blacklist.isClientBlacklisted(addedClient)).toBe(true);

    });

    it('should resolve the promise if successfully added', function() {
      spyOn(db, 'addToBlacklist').andCallFake(function() {
        return helper.resolveAPromise();
      });

      blacklist.addBlacklistedClient(addedClient).then(spy, notCalled);
      expect(spy).toHaveBeenCalled();
      expect(notCalled).not.toHaveBeenCalled();
    });

    it('should reject the promise if not successful', function() {
      spyOn(db, 'addToBlacklist').andCallFake(function() {
        return helper.rejectAPromise(err);
      });

      blacklist.addBlacklistedClient(addedClient).then(notCalled, spy);

      expect(spy).toHaveBeenCalledWith(message, code);
      expect(notCalled).not.toHaveBeenCalled();
    });

    it('should log an error if not successful in adding the client', function() {

      spyOn(db, 'addToBlacklist').andCallFake(function() {
        return helper.rejectAPromise(err);
      });

      blacklist.addBlacklistedClient(addedClient).then(notCalled, spy);

      expect(logging.error).toHaveBeenCalledWith(err);
    });
  });

  describe('removing a client from the blacklist', function() {
    var removedClient = 'abc123';

    beforeEach(function() {

      // Initialize a single item in the list
      spyOn(db, 'populateBlacklist').andCallFake(function() {
        return helper.resolveAPromise([ { clientID: removedClient } ]);
      });

      blacklist.initBlacklist();

    });

    it('should remove the record from the database', function() {
      spyOn(db, 'removeFromBlacklist').andReturn(new Promise());
      blacklist.removeBlacklistedClient(removedClient);
      expect(db.removeFromBlacklist).toHaveBeenCalled();
    });

    it('should no longer mark the client as blacklisted', function() {
      spyOn(db, 'removeFromBlacklist').andCallFake(function() {
        return helper.resolveAPromise();
      });

      expect(blacklist.isClientBlacklisted(removedClient)).toBe(true);
      blacklist.removeBlacklistedClient(removedClient);
      expect(blacklist.isClientBlacklisted(removedClient)).toBe(false);
    });

    it('should resolve the promise if successfully added', function() {
      spyOn(db, 'removeFromBlacklist').andCallFake(function() {
        return helper.resolveAPromise();
      });

      blacklist.removeBlacklistedClient(removedClient).then(spy, notCalled);

      expect(spy).toHaveBeenCalled();
      expect(notCalled).not.toHaveBeenCalled();
    });

    it('should reject the promise if not successful', function() {

      spyOn(db, 'removeFromBlacklist').andCallFake(function() {
        return helper.rejectAPromise(err);
      });

      blacklist.removeBlacklistedClient(removedClient).then(notCalled, spy);
      expect(spy).toHaveBeenCalledWith(message, code);
      expect(notCalled).not.toHaveBeenCalled();
    });

    it('should log an error if not successful in removing the client', function() {
      spyOn(db, 'removeFromBlacklist').andCallFake(function() {
        return helper.rejectAPromise(err);
      });

      blacklist.removeBlacklistedClient(removedClient);

      expect(logging.error).toHaveBeenCalledWith(err);
    });
  });
});