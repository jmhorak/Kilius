/**
 * Common testing functions in a single place
 * Author: Jeff Horak
 * Date: 7/6/12
 */

var Promise = require(__dirname + '/../src/node_modules/modPromise').Promise;

exports.resolveAPromise = function (retValue) {
  var promise = new Promise();

  if (retValue) {
    promise.resolve(retValue);
  } else {
    promise.resolve();
  }

  return promise;
}

exports.rejectAPromise = function(retValue) {
  var promise = new Promise();

  if (retValue) {
    promise.reject(retValue);
  } else {
    promise.reject();
  }

  return promise;
}

exports.matcher_toHaveLogged = function(expected) {
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