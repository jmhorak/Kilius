/**
 *  Unit tests for the database layer
 *  @tests dbService.js
 */

var db = require(__dirname + '/../src/node_modules/modDatabase/dbService.js'),
    m = require(__dirname + '/../src/node_modules/mongodb'),
    mongo = null,
    testingDB = 'kilius-testing',
    collections = ['counter', 'links', 'errLog', 'actLog'];

describe('Database operations', function() {

  beforeEach(function() {
     mongo = new m.Db(testingDB, new m.Server('localhost', 27017, { poolSize: 10 }));
  });

  describe('initializing the database', function() {

    it('should create collections if they do not exist', function() {
      var idx = 0,
          dropped = 0,
          tested = 0;

      runs(function() {
        // Drop all collections then initialize the database
        mongo.open(function(err, dbInstance) {

          for (; idx < collections.length; idx++) {

            mongo.collectionNames(collections[idx], function(err, items) {
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
            });
          }
        });
      });

      waitsFor(function() {
        return dropped === collections.length;
      });

      runs(function() {

        db.initDatabase(testingDB, function() {
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
              })
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
          }

          // Now examine each collection
          for (; i < collections.length; i++) {
            verifyCollections[ collections[i] ]();
          }
        });
      });

      waitsFor(function() {
        return tested === collections.length;
      });

      runs(function() {
        mongo.close();
        db.close();
      });

    });

    it('should initialize collections', function() {
      var bContinue = false;

      runs(function() {
        expect(function() {
          db.initDatabase(testingDB, function(err, result) {
            var i = 0;

            expect(err).toBeNull();
            expect(result).not.toBeNull();

            for (; i < collections.length; i++) {
              expect(result.collection( collections[i] ) instanceof m.Collection).toBe(true);
            }

            db.close();
            bContinue = true;

          });
        }).not.toThrow();
      });

      waitsFor(function() {
        return bContinue;
      });
    });

  });

  describe('reading and writing to the database', function() {

    beforeEach(function() {
      // Initialize the database
      var spy = jasmine.createSpy();

      runs(function() {
        db.initDatabase(testingDB, spy);
      });

      waitsFor(function() {
        return spy.wasCalled;
      });
    });

    afterEach(function() {
      mongo.close();
      db.close();
    })

    describe('writing to the logs', function() {

      it('should write error messages to the errLog database', function() {
        var client = 'my client',
            date = new Date,
            msg = 'there was an error',
            code = 500,
            spy = jasmine.createSpy(),
            bContinue = false;

        runs(function() {
          db.logError({ client: client, date: date, msg: msg, code: code }, spy);
        });

        waitsFor(function() {
          return spy.wasCalled;
        });

        runs(function() {
          // Expect no errors when writing to the database
          expect(spy.mostRecentCall.args[0]).toBeNull();

          // Check if the item is in the database
          mongo.open(function(err, connection) {
            var errLog = mongo.collection('errLog');
            errLog.find({ client: client }).toArray(function(err, result) {
              expect(err).toBeNull();
              expect(result.length).toBe(1);

              expect(result[0].client).toEqual(client);
              expect(result[0].date).toEqual(date);
              expect(result[0].msg).toEqual(msg);
              expect(result[0].code).toEqual(code);

              bContinue = true;
            });
          });
        });

        waitsFor(function() {
          return bContinue;
        });
      });

      it('should write activities to the actLog database', function() {
        var client = 'my client',
            date = new Date,
            msg = 'there was activity',
            spy = jasmine.createSpy(),
            bContinue = false;

        runs(function() {
          db.logActivity({ client: client, date: date, msg: msg }, spy);
        });

        waitsFor(function() {
          return spy.wasCalled;
        });

        runs(function() {
          expect(spy.mostRecentCall.args[0]).toBeNull();

          // Check if the item is in the database
          mongo.open(function(err, connection) {
            var actLog = mongo.collection('actLog');
            actLog.find({ client: client }).toArray(function(err, result) {
              expect(err).toBeNull();
              expect(result.length).toBe(1);

              expect(result[0].client).toEqual(client);
              expect(result[0].date).toEqual(date);
              expect(result[0].msg).toEqual(msg);

              bContinue = true;
            });
          });
        });

        waitsFor(function() {
          return bContinue;
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
        var bContinue = false;

        if (fixturesLoaded) return ;

        runs(function() {

          mongo.open(function(err, connection) {
            var links = mongo.collection('links');
            links.insert(fixtures, { safe: true }, function(err) {

              // Make sure the insert worked correctly
              expect(err).toBeNull();
              bContinue = true;

            });
          });
        });

        waitsFor(function() {
          // Loaded fixture data
          return bContinue;
        });

        runs(function() {
          fixturesLoaded = true;
        });
      };

      function removeFixtureData() {
        var bContinue = false;

        runs(function() {

          var links = mongo.collection('links');
          links.remove({}, { safe: true }, function() {
            bContinue = true;
          });
        });

        waitsFor(function() {
          // Removed fixture data
          return bContinue;
        });

        runs(function() {
          fixturesLoaded = false;
        });
      };

      it('should write the link hit information', function() {
        var hitsAdded = 0, hitsChecked = 0, hitsPerFixture = 2;

        runs(loadFixtureData);

        waitsFor(function() {
          return fixturesLoaded;
        })

        runs(function() {
          var i = 0, j = 0, k = 0;

          for (; i < fixtures.length; i++) {
            for (j = 0; j < hitsPerFixture; j++) {
              db.addNewLinkHit( i+1, { userID: ++k }, function(err, result) {
                hitsAdded++;
                expect(err).toBeNull();
              });
            }
          }
        });

        waitsFor(function() {
          // Added all the hits
          return hitsAdded === (hitsPerFixture * fixtures.length);
        });

        runs(function() {
          var links = mongo.collection('links'),
              i = 1,
              // Check each link, it should have two hits
              checkHits = function(linkID ) {
                links.find({ linkID: linkID }).toArray(function(err, results) {
                  var hitID = linkID*2;
                  expect(err).toBeNull();
                  expect(results.length).toBe(1);
                  expect(results[0].hits).toBeTruthy();
                  expect(results[0].hits.length).toBe(2);

                  expect(results[0].hits[0].userID).toBe(hitID-1);
                  expect(results[0].hits[1].userID).toBe(hitID);

                  hitsChecked++;
                });
              };

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
        })

      });

      it('should return the resolved link information', function() {
        var hitsAdded = 0;

        runs(loadFixtureData);

        waitsFor(function() {
          return fixturesLoaded;
        });

        runs(function() {
          var i = 0, j = 0, k = 0,
              checkCallback = function(index) {
                return function(err, result) {
                  expect(err).toBeNull();
                  expect(result).toEqual(fixtures[index].longLink);
                  hitsAdded++;
                };
              };

          for (; i < fixtures.length; i++) {
            db.addNewLinkHit( i+1, { userID: ++k }, checkCallback(i));
          }
        });

        waitsFor(function() {
          return hitsAdded === fixtures.length;
        });

        runs(removeFixtureData);

        waitsFor(function() {
          return !fixturesLoaded;
        });
      });

      it('should error when the same link ID is passed twice', function() {

      });
    });

    describe('getting the next available link ID', function() {
      var startingCounter = 0;

      beforeEach(function() {
        var opened = false;

        runs(function() {
          mongo.open(function(err, connection) {
            var counter = mongo.collection('counter');
            counter.find({'tbl': 'links'}).toArray(function(err, result) {
              expect(err).toBeNull();
              expect(result.length).toBe(1);
              expect(result[0]).toBeTruthy();
              expect(typeof result[0].c).toEqual('number');

              startingCounter = result[0].c;
              opened = true;
            });
          });
        });

        waitsFor(function() {
          return opened;
        });
      });

      afterEach(function() {
        mongo.close();
      });

      it('should increment the link counter by one', function() {
        var checksRun = 0, prev = startingCounter,
            counter = mongo.collection('counter'),
            checkResult = function(last) {
              return function(err, result) {

                expect(err).toBeNull();

                counter.find({'tbl': 'links'}).toArray(function(err, result) {
                  expect(err).toBeNull();
                  expect(result).toBeTruthy();
                  expect(result.length).toBe(1);
                  expect(typeof result[0].c).toEqual('number');
                  expect(result[0].c).toEqual(last+1);
                  prev = result[0].c;
                });
              }
            },
            waitGuard = function(runNumber) {
              return function() {
                return (runNumber + startingCounter === prev);
              }
            }

        // Run 10 tests, checking that the value in the database is incremented
        for (; checksRun < 10; checksRun++) {
          runs(function() {
            db.getNextLinkID( checkResult(prev) );
          });
          waitsFor(waitGuard(checksRun+1));
        }
      });

      it('should return the next link ID', function() {
        var checksRun = 0, prev = startingCounter,
            checkResult = function(last) {
              return function(err, result) {
                expect(err).toBeNull();
                expect(result).toBeTruthy();
                expect(typeof result).toEqual('number');

                if (prev) {
                  expect(result).toEqual(last + 1);
                  prev = result;
                } else {
                  prev = result;
                }
              }
            },
            waitGuard = function(runNumber) {
              return function() {
                return (runNumber + startingCounter === prev);
              }
            }

        // Run 10 tests, checking that the value returned is one greater each time
        for (; checksRun < 10; checksRun++) {
          runs(function() {
            db.getNextLinkID( checkResult(prev) );
          });
          waitsFor(waitGuard(checksRun+1));
        }
      });

    });

    /*clientID: client,
                linkID: result.c,
                shortLink: shortLink,
                longLink: longLink,
                createDate: new Date,
                hits: []
                */
    describe('writing a new link', function() {
      var fixtures = [
          // Full data
        { clientID: '127.0.0.1', linkID: 1, shortLink: 'http://kili.us/+/1', longLink: 'http://www.google.com', createDate: new Date(), hits: [] },
          // Missing client ID
        { linkID: 2, shortLink: 'http://kili.us/+/2', longLink: 'http://www.yahoo.com', createDate: new Date(), hits: [] },
          // Missing date
        { clientID: '127.0.0.1', linkID: 3, shortLink: 'http://kili.us/+/3', longLink: 'http://www.microsoft.com', hits: [] },
          // Missing hits
        { clientID: '127.0.0.1', linkID: 4, shortLink: 'http://kili.us/+/4', longLink: 'http://jeffhorak.com', createDate: new Date() },
          // Bare minimum
        { linkID: 5, shortLink: 'http://kili.us/+/5', longLink: 'https://github.com/jmhorak' }
      ];

      beforeEach(function() {
        var open = false;

        this.addMatchers({
          isWithinTenSeconds: function(expected) {
            return Math.abs(this.actual - expected) < 10000;
          }
        });

        runs(function() {
          mongo.open(function(err, connection) {
            expect(err).toBeNull();
            open = true;
          });
        });

        waitsFor(function() {
          return open;
        });
      });

      afterEach(function() {
        var removed = false;

        runs(function() {
          var links = mongo.collection('links');
          links.remove({}, { safe: true }, function() {
            removed = true;
          });
        });

        waitsFor(function() {
          return removed;
        });

        runs(function() {
          mongo.close();
        });
      })

      it('should insert the link', function() {
        var written = 0, verified = 0,
            verify = function(index, data, mixin) {
              var fixture = fixtures[index], field;

              if (mixin) {
                for (field in mixin) {
                  if (mixin.hasOwnProperty(field)) {
                    fixture[field] = mixin[field];
                  }
                }
              }

              expect(data).toBeTruthy();
              expect(data.length).toBe(1);
              expect(fixture.clientID).toEqual(data[0].clientID);
              expect(fixture.linkID).toEqual(data[0].linkID);
              expect(fixture.longLink).toEqual(data[0].longLink);
              expect(fixture.shortLink).toEqual(data[0].shortLink);
              expect(fixture.createDate).isWithinTenSeconds(data[0].createDate);
              expect(fixture.hits).toEqual(data[0].hits);
            }

        runs(function() {
          var i = 0;
          for (; i < fixtures.length; i++) {
            db.insertLink(fixtures[i], function(err, result) {
              expect(err).toBeNull();
              written++;
            });
          }
        });

        waitsFor(function() {
          return written === fixtures.length;
        });

        runs(function() {
          // Check the contents of the database to see if the fixtures have been written
          var links = mongo.collection('links'),
              defaultClientID = 'Unknown',
              defaultCreateDate = new Date,
              defaultHits = [],

              findAndVerify = function(index, mixin) {
                links.find({ 'linkID': index }).toArray(function(err, result) {
                  // Link 1 has all the fields, easy to verify
                  expect(err).toBeNull();
                  verify(index-1, result, mixin);
                  verified++;
                });
              }

          findAndVerify(1);
          findAndVerify(2, { clientID: defaultClientID });
          findAndVerify(3, { createDate: defaultCreateDate });
          findAndVerify(4, { hits: defaultHits });
          findAndVerify(5, { clientID: defaultClientID, createDate: defaultCreateDate, hits: defaultHits });
        });

        waitsFor(function() {
          return verified === fixtures.length;
        });
      });

      it('should return true after the link is inserted', function() {
        var written = 0;

        runs(function() {
          var i = 0;
          for (; i < fixtures.length; i++) {
            db.insertLink(fixtures[i], function(err, result) {
              expect(err).toBeNull();
              expect(result).toBe(true);
            });
          }
        });
      });

      it('should return an error if the link ID is missing', function() {

      });

      it('should return an error if the long link is missing', function() {

      });

      it('should return an error if the short link is missing', function() {

      });

    });

    /*describe('fetching the links created by a particular user', function() {

      it('should it return an ordered list links for the given user', function() {
        expect(false).toBeTruthy();
      });

    });*/
  });

});