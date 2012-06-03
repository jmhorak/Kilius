/**
 * Author: Jeff Horak
 * Date: 6/1/12
 *
 * Testing for an async Promise module
 */

var p = require(__dirname + '/../src/node_modules/modPromise'),
    slice = Array.prototype.slice;

describe('Basic Promise features', function() {

  var promise,
      notCalledSpy,
      spy;

  beforeEach(function() {
    promise = new p.Promise();
    notCalledSpy = jasmine.createSpy();
    spy = jasmine.createSpy();
  });

  it('should resolve async functions returning all passed parameters', function() {
    var passArgs = [ new Date(), true, 12, 'abc', { a: 1, b: 2, c: 3 }, [1, 2, 3], function() { return '123' }, /[abc]/g ];

    runs(function() {
      expect(promise.state).toEqual('unfulfilled');

      promise.then(spy, notCalledSpy);

      // Our async function - call resolve with a bunch of arguments
      setTimeout(function() {
        promise.resolve.apply(promise, passArgs);
      }, 1);
    });

    waitsFor(function() {
      return spy.wasCalled || notCalledSpy.wasCalled;
    });

    runs(function() {
      var args = spy.mostRecentCall.args,
          i = 0,
          len = args.length;

      // Verify that the promise state is correct
      expect(promise.state).toEqual('resolved');
      expect(spy).toHaveBeenCalled();
      expect(notCalledSpy).not.toHaveBeenCalled();

      // Verify all the arguments
      // Should be the same number of arguments
      expect(passArgs.length).toEqual(len);
      for (; i < len; i++) {
        expect(args[i]).toEqual(passArgs[i]);
      }
    });
  });

  it('should silently resolve if a resolve callback is not given', function() {
    var isReady = false;

    runs(function() {
      expect(promise.state).toEqual('unfulfilled');

      promise.then(null, notCalledSpy);

      // Our async function - call resolve
      setTimeout(function() {
        promise.resolve('Something', 'Anything');
        isReady = true;
      }, 1);
    });

    waitsFor(function() {
      return isReady;
    });

    runs(function() {
      expect(promise.state).toEqual('resolved');
      expect(notCalledSpy).not.toHaveBeenCalled();
    });
  });

  it('should reject failed async functions returning all passed parameters', function() {
    var passArgs = [ new Date(), true, 12, 'abc', { a: 1, b: 2, c: 3 }, [1, 2, 3], function() { return '123' }, /[abc]/g ];

    runs(function() {
      expect(promise.state).toEqual('unfulfilled');

      promise.then(notCalledSpy, spy);

      // Our async function - call resolve with a bunch of arguments
      setTimeout(function() {
        promise.reject.apply(promise, passArgs);
      }, 1);
    });

    waitsFor(function() {
      return spy.wasCalled || notCalledSpy.wasCalled;
    });

    runs(function() {
      var args = spy.mostRecentCall.args,
          i = 0,
          len = args.length;

      // Verify that the promise state is correct
      expect(promise.state).toEqual('rejected');
      expect(spy).toHaveBeenCalled();
      expect(notCalledSpy).not.toHaveBeenCalled();

      // Verify all the arguments
      // Should be the same number of arguments
      expect(passArgs.length).toEqual(len);
      for (; i < len; i++) {
        expect(args[i]).toEqual(passArgs[i]);
      }
    });
  });

  it('should silently reject if a fail callback is not given', function() {
    var isReady = false;

    runs(function() {
      expect(promise.state).toEqual('unfulfilled');

      promise.then(notCalledSpy);

      // Our async function - call resolve
      setTimeout(function() {
        promise.reject('Something', 'Anything');
        isReady = true;
      }, 1);
    });

    waitsFor(function() {
      return isReady;
    });

    runs(function() {
      expect(promise.state).toEqual('rejected');
      expect(notCalledSpy).not.toHaveBeenCalled();
    });
});
});

describe('Chaining promises using when', function() {
  var promise1, promise2, promise3, spy, notCalledSpy;

  beforeEach(function() {
    promise1 = new p.Promise();
    promise2 = new p.Promise();
    promise3 = new p.Promise();

    spy = jasmine.createSpy();
    notCalledSpy = jasmine.createSpy();
  })

  it('should allow multiple promises to be chained together', function() {
    var isReady = false;

    runs(function() {
      // Each promise should start unfulfilled
      expect(promise1.state).toBe('unfulfilled');
      expect(promise2.state).toBe('unfulfilled');
      expect(promise3.state).toBe('unfulfilled');

      p.Promise.when(promise1, promise2, promise3).then(spy, notCalledSpy);

      setTimeout(function() {
        // Resolve promise 1
        promise1.resolve();
      },1);

      setTimeout(function() {
        // Resolve promise 2
        promise2.resolve();
      }, 1);

      setTimeout(function() {
        // Resolve promise 3
        promise3.resolve();
      }, 1);
    });

    waitsFor(function() {
      return spy.wasCalled || notCalledSpy.wasCalled;
    });

    runs(function() {
      expect(spy).toHaveBeenCalled();
      expect(notCalledSpy).not.toHaveBeenCalled();

      // Verify each promise is resolved
      expect(promise1.state).toBe('resolved');
      expect(promise2.state).toBe('resolved');
      expect(promise3.state).toBe('resolved');
    });
  });

  it('should accept an array of promises', function() {
    var isReady = false;

    runs(function() {
      // Each promise should start unfulfilled
      expect(promise1.state).toBe('unfulfilled');
      expect(promise2.state).toBe('unfulfilled');
      expect(promise3.state).toBe('unfulfilled');

      // Put the promises in an array
      p.Promise.when( [promise1, promise2, promise3] ).then(spy, notCalledSpy);

      setTimeout(function() {
        // Resolve promise 1
        promise1.resolve();
      },1);

      setTimeout(function() {
        // Resolve promise 2
        promise2.resolve();
      }, 1);

      setTimeout(function() {
        // Resolve promise 3
        promise3.resolve();
      }, 1);
    });

    waitsFor(function() {
      return spy.wasCalled || notCalledSpy.wasCalled;
    });

    runs(function() {
      expect(spy).toHaveBeenCalled();
      expect(notCalledSpy).not.toHaveBeenCalled();

      // Verify each promise is resolved
      expect(promise1.state).toBe('resolved');
      expect(promise2.state).toBe('resolved');
      expect(promise3.state).toBe('resolved');
    })
  });

  it('should call reject on the chained promise as soon as one promise fails', function() {
    var isReady = false;

    runs(function() {

      // Each promise should start unfulfilled
      expect(promise1.state).toBe('unfulfilled');
      expect(promise2.state).toBe('unfulfilled');
      expect(promise3.state).toBe('unfulfilled');

      p.Promise.when(promise1, promise2, promise3).then(notCalledSpy, spy);

      setTimeout(function() {
        promise1.reject();

        setTimeout(function() {
          promise2.resolve();
        }, 1);

        setTimeout(function() {
          promise3.resolve();
        }, 1);

      }, 1);
    });

    waitsFor(function() {
      return spy.wasCalled || notCalledSpy.wasCalled;
    });

    runs(function() {

      expect(spy).toHaveBeenCalled();
      expect(notCalledSpy).not.toHaveBeenCalled();

      // Verify the first promise is failed
      expect(promise1.state).toBe('rejected');
    });
  });

  it('should return results in the same order the promises are passed', function() {
    var isReady = false,
        results1 = { a: 1, b: 2, c: 3 },
        results2 = function() { return true;},
        results3 = 'A string argument';

    runs(function() {
      // Each promise should start unfulfilled
      expect(promise1.state).toBe('unfulfilled');
      expect(promise2.state).toBe('unfulfilled');
      expect(promise3.state).toBe('unfulfilled');

      p.Promise.when(promise1, promise2, promise3).then(spy, notCalledSpy);

      // Resolve the promises in reverse
      setTimeout(function() {
        promise3.resolve(results3);

        setTimeout(function() {
          promise2.resolve(results2);

          setTimeout(function() {
            promise1.resolve(results1);
          }, 1);

        }, 1);

      }, 1);
    });

    waitsFor(function() {
      return spy.wasCalled || notCalledSpy.wasCalled;
    });

    runs(function() {
      var args = spy.mostRecentCall.args;

      // Verify the arguments are in the correct order
      expect(args[0][0]).toEqual(results1);
      expect(args[1][0]).toEqual(results2);
      expect(args[2][0]).toEqual(results3);
    });
  });

  it('should resolve immediately if no promises are given', function() {

    p.Promise.when().then(spy, notCalledSpy);

    expect(spy).toHaveBeenCalled();
    expect(notCalledSpy).not.toHaveBeenCalled();
  });
})