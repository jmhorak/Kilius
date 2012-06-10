/**
 * Unit tests for the options module
 *
 * Author: Jeff Horak
 * Date: 6/9/2012
 */

var p = require(__dirname + '/../src/node_modules/modPromise'),
    options;

describe('working with options', function() {

  var spy, notCalled,
      waitForSpy = function() {
        waitsFor(function() {
          return spy.wasCalled || notCalled.wasCalled;
        });
      };

  beforeEach(function() {
    spy = jasmine.createSpy();
    notCalled = jasmine.createSpy();

    options = require(__dirname + '/../src/node_modules/modOptions');
  });

  afterEach(function() {
    expect(spy).toHaveBeenCalled();
    expect(notCalled).not.toHaveBeenCalled();
  });

  describe('loading the options file from disk', function() {

    it('should resolve a promise after loading the file', function() {

      runs(function() {
        options.init(__dirname + '/optionTest/validData').then(spy, notCalled);
      });

      waitForSpy();

    });

    it('should reject a promise when it cannot load the file', function() {
      runs(function() {
        options.init(__dirname + '/optionTest/doesNotExist').then(notCalled, spy);
      });

      waitForSpy();

    });

    it('should only load JSON formatted data and reject the promise otherwise', function() {
      runs(function() {
        options.init(__dirname + '/optionTest/invalidData').then(notCalled, spy);
      });

      waitForSpy();

    });

  });

  describe('fetching options', function() {

    it('should return option values from the file', function() {
      runs(function() {
        options.init(__dirname + '/optionTest/validData').then(spy, notCalled);
      });

      waitForSpy();

      runs(function() {
        expect(options.database).toEqual('testDb');
        expect(options.databaseUser).toEqual('testUser');
        expect(options.databasePassword).toEqual('testPass');
        expect(options.throttleLimit).toEqual(2);
        expect(options.throttleTime).toEqual(10);
      });
    });

    describe('using default options', function() {
      var defaults = {
        database: 'Kilius',
        databaseUser: '',
        databasePassword: '',
        throttleLimit: 25,
        throttleTime: 86400000
      }, properties = [];

      for(var prop in defaults) {
        if (defaults.hasOwnProperty(prop)) {
          properties.push(prop);
        }
      }

      afterEach(function() {
        runs(function() {
          var i = 0,
              len = properties.length;

          for (; i < len; i++) {
            expect(options[properties[ i ]]).toEqual(defaults[properties[ i ]]);
          }
        });
      })

      it('should use default options if the file cannot be loaded', function() {
        runs(function() {
          debugger;
          options.init(__dirname + '/optionTest/doesNotExist').then(notCalled, spy);
        });

        waitForSpy();
      });

      it('should use default options if the file does not contain valid JSON data', function() {
        runs(function() {
          options.init(__dirname + '/optionTest/invalidData').then(notCalled, spy);
        });

        waitForSpy();
      });

      it('should use default options for any option not included in the JSON data', function() {
        runs(function() {
          options.init(__dirname + '/optionTest/incompleteData').then(spy, notCalled);
        });

        waitForSpy();
      });

    });

  });

});