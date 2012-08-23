/**
 *  Unit tests for the database layer
 *  @tests dbService.js
 */

/*globals describe expect beforeEach afterEach it runs waitsFor jasmine */

var helper      = require('./testing.helpers.js'),
    db          = helper.db,
    options     = helper.options,
    Promise     = helper.Promise,
    m           = require(__dirname + '/../src/node_modules/mongodb'),
    mongo       = null,
    testingDB   = 'kilius-testing',
    collections = ['counter', 'links', 'errLog', 'actLog'];

describe('Database operations', function() {

  beforeEach(function() {
    mongo = new m.Db(
        testingDB,
        new m.Server(options.databaseHost, options.databasePort, { poolSize: 10 })
    );
    options.database = testingDB;
  });

  describe('initializing the database', function() {

    it('should create collections if they do not exist', function() {
      var idx = 0,
          dropped = 0,
          tested = 0,
          spy = jasmine.createSpy();

      runs(function() {
        // Drop all collections then initialize the database
        mongo.open(function(err, dbInstance) {

          function dropCollection(err, items) {
            var name = '';

            if (items.length) {
              name = items[0].name;
              mongo.dropCollection( name.slice(name.indexOf('.')+1) , function(err, result) {
                expect(err).toBeFalsy();
                dropped++;
              });
            } else {
              dropped++;
            }
          }

          for (; idx < collections.length; idx++) {

            mongo.collectionNames(collections[idx], dropCollection);
          }
        });
      });

      waitsFor(function() {
        return dropped === collections.length;
      });

      runs(function() {

        db.initDatabase().then(function() {
          var i = 0,
              col = null;

          var verifyEmptyCollection = function(collection) {
            collection.find().count(function(err, count) {
              expect(err).toBeFalsy();
              expect(count).toBe(0);
              tested++;
            });
          };

          var verifyCollections = {

            'counter': function() {
              mongo.collection('counter').find().toArray(function(err, docs) {
                // The counter collection should be initialized with a value
                expect(err).toBeFalsy();
                expect(docs.length).toBe(1);
                expect(docs[0].tbl).toEqual('links');
                expect(docs[0].c).toBe(0);
                tested++;
              });
            },

            'errLog': function() {
              var errLog = mongo.collection('errLog');

              errLog.options(function(err, options) {
                expect(options.capped).toBe(true);
                expect(options.size).toBe(10485760);

                verifyEmptyCollection(errLog);
              });
            },

            'actLog': function() {
              var actLog = mongo.collection('actLog');

              actLog.options(function(err, options) {
                expect(options.capped).toBe(true);
                expect(options.size).toBe(52428800);

                verifyEmptyCollection(actLog);
              });
            },

            'links': function() {
              verifyEmptyCollection( mongo.collection('links') );
            }
          };

          // Now examine each collection
          for (; i < collections.length; i++) {
            verifyCollections[ collections[i] ]();
          }
        }, spy);
      });

      waitsFor(function() {
        return tested === collections.length || spy.wasCalled;
      });

      runs(function() {
        expect(spy).not.toHaveBeenCalled();

        mongo.close();
        db.close();
      });

    });

  });

  describe('reading and writing to the database', function() {

    beforeEach(function() {
      // Initialize the database
      var spy = jasmine.createSpy(),
          notCalled = jasmine.createSpy();

      runs(function() {
        db.initDatabase().then(spy, notCalled);
      });

      waitsFor(function() {
        return spy.wasCalled || notCalled.wasCalled;
      });

      runs(function() {
        expect(spy).toHaveBeenCalled();
        expect(notCalled).not.toHaveBeenCalled();
      });
    });

    afterEach(function() {
      mongo.close();
      db.close();
    });

    describe('writing to the logs', function() {

      it('should write error messages to the errLog database', function() {
        var client = 'my client',
            date = new Date(),
            msg = 'there was an error',
            code = 500,
            spy = jasmine.createSpy(),
            notCalled = jasmine.createSpy(),
            isReady = false;

        runs(function() {
          db.logError({ client: client, date: date, msg: msg, code: code }).then(spy, notCalled);
        });

        waitsFor(function() {
          return spy.wasCalled || notCalled.wasCalled;
        });

        runs(function() {
          // Expect no errors when writing to the database
          expect(spy).toHaveBeenCalled();
          expect(notCalled).not.toHaveBeenCalled();

          // Check if the item is in the database
          mongo.open(function(err, connection) {
            var errLog = mongo.collection('errLog');

            expect(err).toBeNull();

            errLog.find({ client: client }).toArray(function(err, result) {
              expect(err).toBeNull();
              expect(result.length).toBe(1);

              expect(result[0].client).toEqual(client);
              expect(result[0].date).toEqual(date);
              expect(result[0].msg).toEqual(msg);
              expect(result[0].code).toEqual(code);

              isReady = true;
            });
          });
        });

        waitsFor(function() {
          return isReady;
        });
      });

      it('should write activities to the actLog database', function() {
        var client = 'my client',
            date = new Date(),
            msg = 'there was activity',
            spy = jasmine.createSpy(),
            notCalled = jasmine.createSpy(),
            isReady = false;

        runs(function() {
          db.logActivity({ client: client, date: date, msg: msg }).then(spy, notCalled);
        });

        waitsFor(function() {
          return spy.wasCalled || notCalled.wasCalled;
        });

        runs(function() {
          expect(spy).toHaveBeenCalled();
          expect(notCalled).not.toHaveBeenCalled();

          // Check if the item is in the database
          mongo.open(function(err, connection) {
            var actLog = mongo.collection('actLog');

            expect(err).toBeNull();

            actLog.find({ client: client }).toArray(function(err, result) {
              expect(err).toBeNull();
              expect(result.length).toBe(1);

              expect(result[0].client).toEqual(client);
              expect(result[0].date).toEqual(date);
              expect(result[0].msg).toEqual(msg);

              isReady = true;
            });
          });
        });

        waitsFor(function() {
          return isReady;
        });
      });

    });

    describe('resolving a link', function() {

      var fixtures = [
            { linkID: 1, longLink: 'http://www.google.com', hits: [] },
            { linkID: 2, longLink: 'http://www.microsoft.com', hits: [] },
            { linkID: 3, longLink: 'http://jeffhorak.com', hits: [] },
            { linkID: 4, longLink: 'http://github.com', hits: [] }
          ], fixturesLoaded = false;

      function loadFixtureData() {
        var isReady = false;

        if (fixturesLoaded) { return; }

        runs(function() {

          mongo.open(function(err, connection) {
            var links = mongo.collection('links');
            links.insert(fixtures, { safe: true }, function(err) {

              // Make sure the insert worked correctly
              expect(err).toBeNull();
              isReady = true;

            });
          });
        });

        waitsFor(function() {
          // Loaded fixture data
          return isReady;
        });

        runs(function() {
          fixturesLoaded = true;
        });
      }

      function removeFixtureData() {
        var isReady = false;

        runs(function() {

          var links = mongo.collection('links');
          links.remove({}, { safe: true }, function() {
            isReady = true;
          });
        });

        waitsFor(function() {
          // Removed fixture data
          return isReady;
        });

        runs(function() {
          fixturesLoaded = false;
        });
      }

      beforeEach(function() {
        this.addMatchers({
          toBeOneOf: function(expected) {
            var actual = this.actual,
                i = 0,
                len = expected.length,
                hasError = true;

            for (; i < len && hasError; i++) {
              hasError = actual === expected[i];
            }

            this.message = function() {
              if (hasError) {
                return 'Expected ' + actual + ' to be in set <' + expected.join(', ') + '>';
              }
            };

            return !hasError;
          }
        });
      });

      it('should write the link hit information', function() {
        var hitsChecked = 0, hitsPerFixture = 2,
            spy = jasmine.createSpy(),
            notCalled = jasmine.createSpy();

        runs(loadFixtureData);

        waitsFor(function() {
          return fixturesLoaded;
        });

        runs(function() {
          var i = 0, j = 0, k = 0;

          for (; i < fixtures.length; i++) {
            for (j = 0; j < hitsPerFixture; j++) {
              db.addNewLinkHit( i+1, { userID: ++k }).then(spy, notCalled);
            }
          }
        });

        waitsFor(function() {
          // Added all the hits
          return spy.callCount === (hitsPerFixture * fixtures.length) || notCalled.wasCalled;
        });

        runs(function() {
          var links = mongo.collection('links'),
              i = 1;

          // Check each link, it should have two hits
          function checkHits(linkID ) {
            links.find({ linkID: linkID }).toArray(function(err, results) {
              var hitID = linkID*2;
              expect(err).toBeNull();
              expect(results.length).toBe(1);
              expect(results[0].hits).toBeTruthy();
              expect(results[0].hits.length).toBe(2);

              expect(results[0].hits[0].userID).toBeOneOf([hitID-1, hitID]);
              expect(results[0].hits[1].userID).toBeOneOf([hitID-1, hitID]);

              hitsChecked++;
            });
          }

          expect(spy).toHaveBeenCalled();
          expect(notCalled).not.toHaveBeenCalled();

          for (; i <= fixtures.length; i++) {
            checkHits(i);
          }
        });

        waitsFor(function() {
          // Checked all the hits
          return hitsChecked === fixtures.length;
        });

        runs(removeFixtureData);

        waitsFor(function() {
          return !fixturesLoaded;
        });

      });

      it('should return the resolved link information', function() {
        var spy = jasmine.createSpy(),
            notCalled = jasmine.createSpy();

        runs(loadFixtureData);

        waitsFor(function() {
          return fixturesLoaded;
        });

        runs(function() {
          var i = 0, j = 0;

          for (; i < fixtures.length; i++) {
            db.addNewLinkHit( i+1, { userID: ++j }).then(spy, notCalled);
          }
        });

        waitsFor(function() {
          return spy.callCount === fixtures.length || notCalled.wasCalled;
        });

        runs(function() {
          var i = 0, len = fixtures.length;

          expect(spy).toHaveBeenCalled();
          expect(notCalled).not.toHaveBeenCalled();

          // Results could come back in any order, just make sure it appears
          //   somewhere in the results
          function spyWasCalledWithLongLink(link) {
            var j = 0;
            for (; j < len; j++) {
              if (spy.argsForCall[j][0] === link) { return true; }
            }

            return false;
          }

          // Verify callback data
          for (; i < len; i++) {
            expect(spyWasCalledWithLongLink(fixtures[i].longLink)).toBe(true);
          }

          removeFixtureData();
        });

        waitsFor(function() {
          return !fixturesLoaded;
        });
      });

      it('should reject the promise when the link is not found', function() {
        var spy = jasmine.createSpy(),
            notCalled = jasmine.createSpy();

        runs(function() {
          db.addNewLinkHit(20, { }).then(
              notCalled, spy
          );
        });

        waitsFor(function() {
          return notCalled.wasCalled || spy.wasCalled;
        });

        runs(function() {
          expect(notCalled).not.toHaveBeenCalled();
          expect(spy).toHaveBeenCalledWith({
            message: 'Missing or invalid URI',
            error: 'Long link for id 20 not found',
            code: 404
          });
        });

      });
    });

    describe('getting the next available link ID', function() {
      var startingCounter = 0;

      beforeEach(function() {
        var isReady = false;

        runs(function() {
          mongo.open(function(err, connection) {
            var counter = mongo.collection('counter');
            counter.update({'tbl': 'links'}, {$set: {c: 0} }, { safe: true }, function() {
              isReady = true;
            });
          });
        });

        waitsFor(function() {
          return isReady;
        });
      });

      afterEach(function() {
        mongo.close();
      });

      it('should increment the link counter by one', function() {
        var isReady = false,
            counter = mongo.collection('counter'),
            notCalled = jasmine.createSpy();

        runs(function() {

          function getLinkAndCheckResult(runNumber) {
            db.getNextLinkID().then(function(result) {

              // Check the result
              expect(runNumber+1).toEqual(result);

              // Check that value in the database was incremented
              counter.find({'tbl': 'links'}).toArray(function(err, dbResult) {
                expect(err).toBeNull();
                expect(dbResult).toBeTruthy();
                expect(dbResult.length).toBe(1);
                expect(typeof dbResult[0].c).toEqual('number');
                expect(dbResult[0].c).toEqual(result);

                // Do 10 runs
                if (runNumber < 10) {
                  getLinkAndCheckResult(runNumber+1);
                } else {
                  // Finished
                  isReady = true;
                }

              });
            }, notCalled);
          }

          getLinkAndCheckResult(0);

        });

        waitsFor(function() {
          return isReady || notCalled.wasCalled;
        });

        runs(function() {
          // Make sure there were no failures
          expect(notCalled).not.toHaveBeenCalled();
        });
      });

      it('should return the next link ID', function() {
        var promises = new Array(10),
            spy = jasmine.createSpy(),
            notCalled = jasmine.createSpy(),
            len = 10;

        runs(function() {
          var i = 0;

          for (; i < len; i++) {
            promises[i] = db.getNextLinkID();
          }

          Promise.when(promises).then(spy, notCalled);
        });

        waitsFor(function() {
          return spy.wasCalled || notCalled.wasCalled;
        });

        runs(function() {
          var i = 0;

          expect(spy).toHaveBeenCalled();
          expect(notCalled).not.toHaveBeenCalled();

          // Verify the next ID was returned
          for (; i < len; i++) {
            expect(spy.mostRecentCall.args[i][0]).toBe(i+1);
          }
        });
      });

    });

    describe('writing a new link', function() {
      var fixtures = [
        { linkID: 1, shortLink: 'http://kili.us/+/1', longLink: 'http://www.google.com' },
        { linkID: 2, shortLink: 'http://kili.us/+/2', longLink: 'http://www.yahoo.com' },
        { linkID: 3, shortLink: 'http://kili.us/+/3', longLink: 'http://www.microsoft.com' },
        { linkID: 4, shortLink: 'http://kili.us/+/4', longLink: 'http://jeffhorak.com' },
        { linkID: 5, shortLink: 'http://kili.us/+/5', longLink: 'https://github.com/jmhorak' }
          ],
          len = fixtures.length;

      afterEach(function() {
        // Drop the links collection and recreate it
        var isReady = false,
            isErr = false,
            doErr = function() { isErr = true; },

            promiseOpen = new Promise().then(function() {

              var links = mongo.collection('links');
              links.drop(function(err) {
                if (err) {
                  promiseDrop.reject(err);
                } else {
                  promiseDrop.resolve();
                }
              });
            }, doErr),

            promiseDrop = new Promise().then(function() {

              mongo.createCollection('links', function(err) {
                if (err) {
                  promiseCreate.reject(err);
                } else {
                  promiseCreate.resolve();
                }
              });
            }, doErr),

            promiseCreate = new Promise().then(function() {
              isReady = true;
            }, doErr);

        runs(function() {
          mongo.open(function(err, connection) {
            if (err) {
              promiseOpen.reject(err);
            } else {
              promiseOpen.resolve();
            }
          });
        });

        waitsFor(function() {
          return isReady || isErr;
        });

        runs(function() {
          expect(isReady).toBe(true);
          expect(isErr).toBe(false);

          mongo.close();
        });
      });

      it('should insert the link', function() {
        var i = 0,
            promises = new Array(len+1),
            spy = jasmine.createSpy(),
            notCalled = jasmine.createSpy();

        runs(function() {
          // Insert each of the links
          for (; i < len; i++) {
            promises[i] = db.insertLink(fixtures[i]);
          }

          promises[len] = new Promise();

          mongo.open(function(err, connection) {
            if (err) {
              promises[len].reject(err);
            } else {
              promises[len].resolve(connection);
            }
          });

          Promise.when(promises).then(spy, notCalled);
        });

        waitsFor(function() {
          return spy.wasCalled || notCalled.wasCalled;
        });

        runs(function() {
          var i = 0;

          expect(spy).toHaveBeenCalled();
          expect(notCalled).not.toHaveBeenCalled();

          // Reset everything for verification
          spy.reset();
          notCalled.reset();
          promises = new Array(len);

          // Check that the links are in the database
          function verifyLink(id) {

            var links = mongo.collection('links');
            promises[id-1] = new Promise();

            links.find({ linkID: id }).toArray(function(err, result) {
              if (err) {
                promises[id-1].reject(err);
              } else {
                expect(result.length).toBe(1);
                expect(result[0].linkID).toEqual(fixtures[id-1].linkID);
                expect(result[0].shortLink).toEqual(fixtures[id-1].shortLink);
                expect(result[0].longLink).toEqual(fixtures[id-1].longLink);
                promises[id-1].resolve();
              }
            });
          }

          for (; i < len; i++) {
            verifyLink(i+1);
          }

          Promise.when(promises).then(spy, notCalled);
        });

        waitsFor(function() {
          return spy.wasCalled || notCalled.wasCalled;
        });

        runs(function() {
          // Close the database connection
          mongo.close();
        });
      });

      it('should return true after the link is inserted', function() {
        var spy = jasmine.createSpy('insert links'),
            notCalled = jasmine.createSpy('insert links error'),
            promises = new Array(len);

        runs(function() {
          var i = 0;

          for (; i < len; i++) {
            promises[i] = db.insertLink(fixtures[i]);
          }

          Promise.when(promises).then(spy, notCalled);
        });

        waitsFor(function() {
          return spy.wasCalled || notCalled.wasCalled;
        });

        runs(function() {
          var i = 0;

          expect(spy).toHaveBeenCalled();
          expect(notCalled).not.toHaveBeenCalled();

          for (; i < len; i++) {
            expect(spy.argsForCall[0][i][0]).toBe(true);
          }
        });
      });

    });

    describe('fetching the links created by a particular user', function() {

      var fixtures = [
            { clientID: 1, createDate: new Date(2010, 3, 2), linkID: 1, shortLink: 'http://kili.us/+/1', longLink: 'http://www.google.com', hits: 20 },
            { clientID: 2, createDate: new Date(2012, 6, 2), linkID: 2, shortLink: 'http://kili.us/+/2', longLink: 'http://www.yahoo.com', hits: 1 },
            { clientID: 2, createDate: new Date(2008, 4, 2), linkID: 3, shortLink: 'http://kili.us/+/3', longLink: 'http://www.microsoft.com', hits: 3 },
            { clientID: 1, createDate: new Date(2011, 3, 2), linkID: 4, shortLink: 'http://kili.us/+/4', longLink: 'http://jeffhorak.com', hits: 15 },
            { clientID: 1, createDate: new Date(2012, 1, 2), linkID: 5, shortLink: 'http://kili.us/+/5', longLink: 'https://github.com/jmhorak', hits: 8 }
              ],
              len = fixtures.length;

      // Add fixtures to the database
      beforeEach(function() {
        var isReady = false;

        runs(function() {

          mongo.open(function(err, connection) {

            var links = mongo.collection('links');
            links.insert(fixtures, { safe: true }, function(err, result) {
              isReady = true;
            });

          });
        });

        waitsFor(function() {
          return isReady;
        });
      });

      // Remove all fixtures from the database
      afterEach(function() {
        var isReady = false;

        runs(function() {

          var links = mongo.collection('links');
          links.remove({}, { safe: true }, function(err, result) {
            isReady = true;
          });

        });

        waitsFor(function() {
          return isReady;
        });

        runs(function() {
          mongo.close();
        });
      });

      describe('searching for a user that doesn\'t exist', function() {
        it('should return an empty set for an undefined user', function() {
          var spy = jasmine.createSpy('fetch links for user'),
              notCalled = jasmine.createSpy('fetch links for user error');

          runs(function() {
            db.linksForUser({ clientID: 3, pageSize: 2, page: 0 }).then(spy, notCalled);
          });

          waitsFor(function() {
            return spy.wasCalled || notCalled.wasCalled;
          });

          runs(function() {
            expect(spy).toHaveBeenCalled();
            expect(notCalled).not.toHaveBeenCalled();

            expect(spy.mostRecentCall.args[0]).toEqual([]);
          });
        });
      });

      describe('searching for a user with valid link data', function() {
        var spy, notCalled;

        beforeEach(function() {
          spy = jasmine.createSpy('fetch links for user');
          notCalled = jasmine.createSpy('fetch links for user error');
        });

        afterEach(function() {
          expect(spy).toHaveBeenCalled();
          expect(notCalled).not.toHaveBeenCalled();
        });

        it('should return an array sorted by date descending', function() {

          runs(function() {
            db.linksForUser({ clientID: 1, pageSize: 10, page: 0 }).then(spy, notCalled);
          });

          waitsFor(function() {
            return spy.wasCalled || notCalled.wasCalled;
          });

          runs(function() {
            var args = spy.mostRecentCall.args,
                // Should return [ link 5, link 4, link 1 ]
                matches = [4, 3, 0],
                i = 0,
                len = matches.length;

            expect(args[0].length).toBe(3);

            for (; i < len; i++) {
              // These properties should be returned
              expect(args[0][i].shortLink).toEqual(fixtures[matches[i]].shortLink);
              expect(args[0][i].longLink).toEqual(fixtures[matches[i]].longLink);
              expect(args[0][i].hits).toEqual(fixtures[matches[i]].hits);
              expect(args[0][i].createDate).toEqual(fixtures[matches[i]].createDate);

              // These properties should not be returned
              expect(args[0][i].clientID).toBeUndefined();
              expect(args[0][i].linkID).toBeUndefined();
            }
          });
        });

        it('should return an array limited to the specified size', function() {

          runs(function() {
            db.linksForUser({ clientID: 1, pageSize: 1, page: 0 }).then(spy, notCalled);
          });

          waitsFor(function() {
            return spy.wasCalled || notCalled.wasCalled;
          });

          runs(function() {

            // Expect only one result returned
            expect(spy.mostRecentCall.args[0].length).toBe(1);
          });
        });

        it('should allow skipping ahead to a specific page', function() {

          runs(function() {
            // At one document per page, page 2 is the 3rd result
            db.linksForUser({ clientID: 1, pageSize: 1, page: 2 }).then(spy, notCalled);
          });

          waitsFor(function() {
            return spy.wasCalled || notCalled.wasCalled;
          });

          runs(function() {
            var link = spy.mostRecentCall.args[0][0];

            // Should contain only link 1
            expect(link.longLink).toEqual(fixtures[0].longLink);
            expect(link.shortLink).toEqual(fixtures[0].shortLink);
            expect(link.hits).toEqual(fixtures[0].hits);
            expect(link.createDate).toEqual(fixtures[0].createDate);
          });
        });
      });
    });
  });

});