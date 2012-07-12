/**
 * Common testing functions in a single place
 * Author: Jeff Horak
 * Date: 7/6/12
 */

var Promise       = require(__dirname + '/../src/node_modules/modPromise').Promise;
exports.Promise   = Promise;

exports.db        = require(__dirname + '/../src/node_modules/modDatabase');
exports.fileFetch = require(__dirname + '/../src/node_modules/modFetch');
exports.logging   = require(__dirname + '/../src/node_modules/modLogging');
exports.handler   = require(__dirname + '/../src/node_modules/modRequestHandler');
exports.resolve   = require(__dirname + '/../src/node_modules/modResolve');
exports.shorten   = require(__dirname + '/../src/node_modules/modShorten');
exports.stats     = require(__dirname + '/../src/node_modules/modStats');
exports.transform = require(__dirname + '/../src/node_modules/modTransform');
exports.options   = require(__dirname + '/../src/node_modules/modOptions');


exports.resolveAPromise = function (retValue) {
  var promise = new Promise();

  if (retValue) {
    promise.resolve(retValue);
  } else {
    promise.resolve();
  }

  return promise;
};

exports.rejectAPromise = function(retValue) {
  var promise = new Promise();

  if (retValue) {
    promise.reject(retValue);
  } else {
    promise.reject();
  }

  return promise;
};

exports.equalObjectMatcher = function(expected) {
  var args = this.actual.wasCalled ? this.actual.mostRecentCall.args[0] : {},
      actualValue,
      key,
      hasError = false;

  for (key in args) {
    if (args.hasOwnProperty(key)) {

      actualValue = args[key];
      hasError = expected[key] !== actualValue;

      if (hasError) { break; }
    }
  }

  if (!hasError) {
    for (key in expected) {
      if (expected.hasOwnProperty(key)) {

        actualValue = args[key];
        hasError = expected[key] !== actualValue;

        if (hasError) { break; }

      }
    }
  }

  this.message = function() {
    if (hasError) {
      return 'Expected ' + key + ' ' + actualValue + ' to be ' + expected[key];
    }
  };

  return !hasError;
};