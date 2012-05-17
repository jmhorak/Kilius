/**
 * Unit tests for the transform service
 */

var transform = require(__dirname + '/../src/node_modules/modTransform/transformService.js');

describe('Transformation service', function() {

  beforeEach(function() {
    transform.init();
  });

  describe('parsing given language strings', function() {

    describe('parsing invalid input', function() {

      it('should return null when passed undefined', function() {
        expect(transform.parseURI(undefined)).toBeNull();
      });

      it('should return null when passed null', function() {
        expect(transform.parseURI(null)).toBeNull();
      });

      it('should return null when passed an object', function() {
        expect(transform.parseURI( { a: 1 } )).toBeNull();
      });

      it('should return null when passed an array', function() {
        expect(transform.parseURI( [ 1, 2 ] )).toBeNull();
      });

      it('should return null when passed a number', function() {
        expect(transform.parseURI( 2 )).toBeNull();
      });

      it('should return null when passed a boolean', function() {
        expect(transform.parseURI( true )).toBeNull();
      });

      it('should return null when passed a function', function() {
        expect(transform.parseURI( function() { return true; } )).toBeNull();
      });

      it('should return null when passed a regex', function() {
        expect(transform.parseURI( /[abc]/ )).toBeNull();
      });

      it('should return null when passed an invalid language string', function() {
        // Contains invalid characters
        expect(transform.parseURI( 'Hello World' )).toBeNull();
        expect(transform.parseURI( '/-/abc12' )).toBeNull();
        expect(transform.parseURI( '/+/ZZAA' )).toBeNull();
        expect(transform.parseURI( '/+/SY12_' )).toBeNull();

        // Contains valid characters, just missing /+/
        expect(transform.parseURI( 'bC' )).toBeNull();
        expect(transform.parseURI( '1' )).toBeNull();

        // Just /+/
        expect(transform.parseURI('/+/')).toBeNull();
      });
    });

    describe('parsing legal input strings', function() {

      var prefix = '/+/';

      it('should remove the /+/ prefix from passed in strings', function() {
        var numbersOnly = '2287',
            upperCase = 'XKL',
            lowerCase = 'xkl',
            mixedCase = 'xKL',
            mixed = '1x2K6l';

        expect(transform.parseURI( prefix + numbersOnly )).toEqual(numbersOnly);
        expect(transform.parseURI( prefix + upperCase )).toEqual(upperCase);
        expect(transform.parseURI( prefix + lowerCase )).toEqual(lowerCase);
        expect(transform.parseURI( prefix + mixedCase )).toEqual(mixedCase);
        expect(transform.parseURI( prefix + mixed )).toEqual(mixed);
      });

      it('should have an upper limit of 8 characters + /+/ prefix', function() {
        var max = 'rr90Mlnp';

        expect(transform.parseURI( prefix + max )).toEqual(max);
        expect(transform.parseURI( prefix + max + 'g' )).toBeNull();
      });

      it('should have a lower limit of 1 character + /+/ prefix', function() {
        var min = "1";

        expect(transform.parseURI( prefix + min )).toEqual(min);
        expect(transform.parseURI( prefix )).toBeNull();
      });
    });
  });

  describe('converting between URI and link ID', function() {
    var Zs = (function() { var s = ''; for (var i = 0; i < 7; i++) { s += 'Z'} return s; })(),
        max = 53459728531455,
        min = 0;

    describe('converting a URI to a link ID', function() {
      it('should run the transform', function() {
        expect(transform.uriToLinkID('/+/1')).toEqual(min);
        expect(transform.uriToLinkID('/+/2')).toEqual(min+1);

        // URI strings are parsed right-to-left
        expect(transform.uriToLinkID('/+/z' + Zs)).toEqual(max-1);
        expect(transform.uriToLinkID('/+/Z' + Zs)).toEqual(max);
      });
    });

    describe('converting a link ID to a URI', function() {
      it('should run the transform', function() {
        expect(transform.linkIDToURI(min)).toEqual('1');
        expect(transform.linkIDToURI(min+1)).toEqual('2');

        expect(transform.linkIDToURI(max-1)).toEqual('z' + Zs);
        expect(transform.linkIDToURI(max)).toEqual('Z' + Zs);
      });
    });

    it('should be able to convert between the two', function() {
      var getRandom = function() { return Math.floor(Math.random() * (max - min + 1)) + min },
          linkID = 0,
          uri = '',
          i = 0;

      // These tests are completely random and generated, so run a bunch
      for (; i < 2500; i++) {
        linkID = getRandom();
        uri = transform.linkIDToURI(linkID);
        expect(transform.uriToLinkID('/+/' + uri)).toEqual(linkID);
      }
    });
  });
});