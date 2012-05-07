/*
   Author: Jeff Horak
   Created: 5/2/12
   Description: kili.us implementation using Knockout.js
 */

/**
 * Opacity binding, makes something opaque or transparent
 * @type {Object}
 */
ko.bindingHandlers.opacity = {
  /**
   * Initialize the element
   * @param element
   * @param valueAccessor
   */
  init: function(element, valueAccessor) {
    if (valueAccessor()) {
      $(element).addClass('opaque');
    } else {
      $(element).addClass('transparent');
    }
  },

  /**
   * Based on the value, switch between opaque and transparent
   * @param element
   * @param valueAccessor
   */
  update: function(element, valueAccessor) {
    if (valueAccessor()) {
      $(element).removeClass('transparent').addClass('opaque');
    } else {
      $(element).removeClass('opaque').addClass('transparent');
    }
  }
};

/**
 * Flash copy binding
 * @type {Object}
 */
ko.bindingHandlers.copyElement = {
  /**
   * Initialize the flash copy clipboard
   * @param element
   * @param valueAccessor
   * @param allBindings
   * @param viewModel
   */
  init: function(element, valueAccessor, allBindings, viewModel) {
    viewModel.clip = new ZeroClipboard.Client();
    viewModel.clip.setText(viewModel.shortLink);
    viewModel.clip.setHandCursor(true);
    viewModel.clip.setCSSEffects(true);
  },

  /**
   * Update the position of the flash element
   * @param element
   * @param valueAccessor
   * @param allBindings
   * @param viewModel
   */
  update: function(element, valueAccessor, allBindings, viewModel) {
    if (valueAccessor()) {

      if (!viewModel.clip.domElement) {
        viewModel.clip.glue(element);
      }

      viewModel.clip.reposition();
      viewModel.positionStale(false);
    }
  }
}

/**
 * Constructor for a shortened link
 * @param content
 * @constructor
 */
function KiliusLink(content) {
  var self = this;

  // Static content
  self.shortLink = content.short;
  self.longLink = content.long;
  self.hits = content.hits;
  self.date = content.date;
  self.clip = null;

  // Observables
  self.positionStale = ko.observable(false);

  // Computed
  self.updatePosition = ko.computed(function() {
    return self.positionStale();
  }).extend({ throttle: 300 });

  self.displayShortLink = ko.computed(function() {
    var link = self.shortLink;
    return link.substring(link.indexOf('kili'));
  });
}

/**
 * The view model for the application
 * @constructor
 */
function KiliusModel() {
  var self = this;

  // Data
  self.links = ko.observableArray([]);
  self.newLink = ko.observable();
  self.errorMsg = ko.observable('');
  self.user = 'k'; // TODO: Use a real user

  // Does the client support animations and flash?
  self.supportAnimation = $('html').hasClass('cssanimations');
  self.supportFlash = (function() {
    var mimeType = navigator.mimeTypes['application/x-shockwave-flash'];
    if (mimeType) {
      return !!mimeType.enabledPlugin;
    }

    return false;
  })();

  // Animations
  self.animations = {
    ready: ko.observable(true),
    main:  { play: ko.observable(true) },
    table: { play: ko.observable(false) },
    rows: { play: ko.observable(false) }
  };

  // Computed animation properties
  self.animations.enabled = ko.computed(function() {
    return self.supportAnimation && self.animations.ready();
  });

  self.animations.main.shown = ko.computed(function() {
    return !self.supportAnimation || self.animations.main.play();
  });

  self.animations.table.shown = ko.computed(function() {
    return !self.supportAnimation || self.animations.table.play();
  });

  self.animations.rows.shown = ko.computed(function() {
    return !self.supportAnimation || self.animations.rows.play();
  });

  // Operations
  self.postLink = function() {
    // TODO: Validate

    // AJAX call to POST new URL
    $.ajax({
      url: '/+/',
      type: 'POST',
      data: JSON.stringify({ url: self.newLink() }),
      contentType: 'application/json',
      processData: false,

      /**
       * AJAX error handler
       * @param jqXHR {Object} - The jQuery AJAX object
       * @param textStatus {String} - Status string
       * @param errorThrown {String} - Error returned
       */
      error: function(jqXHR, textStatus, errorThrown) {
        // Check if there is a message in the response text
        var msg = (jqXHR.responseText ? JSON.parse(jqXHR.responseText) : null);

        if (typeof msg === 'object') {
          msg = msg.message;
        }

        // No message, create one
        if (!msg) {
          msg = ['The Kili.us server reported a problem: ',
                  textStatus ? textStatus[0].toUpperCase() + textStatus.slice(1) : 'Error',
                  ' - ',
                  errorThrown ? errorThrown : 'General Error'].join('');
        }

        // Set the error message
        self.errorMsg(msg);
      },

      /**
       * Callback on AJAX request success
       * @param data {Object} - The object returned from the server
       * @param textStatus {String} - String status text
       * @param jqXHR {Object} - jQuery AJAX object
       */
      success: function(data, textStatus, jqXHR) {
        if (jqXHR.status === 201) {
          // Add the new link to the beginning of the links array
          self.links.unshift(new KiliusLink({
            short: jqXHR.getResponseHeader('Location'),
            long: self.newLink(),
            hits: 0,
            date: new Date()
          }));

          // Clear existing link
          self.newLink('');

          // Clear the error message
          self.errorMsg('');

          self.repositionCopyLinks();

        } else {
          // Expecting a 201 response
          self.errorMsg('The server did not reply to the request in the correct format');
        }
      }
    });
  };

  /**
   * Reposition the Copy flash links onscreen
   */
  self.repositionCopyLinks = function() {
    $.each(self.links(), function(index, value) {
      value.positionStale(true);
    });
  };

  // Animation Events
  $('#banner').bind('webkitTransitionEnd transitionend MSTransitionEnd oTransitionEnd', function() {
    self.animations.table.play(true);
  });
  $('.link-table-container').bind('webkitTransitionEnd transitionend MSTransitionEnd oTransitionEnd', function(evt) {
    if (evt.target === this) {
      self.animations.rows.play(true);

      // Create and overlay Flash copy movie
      self.repositionCopyLinks();
    }
  });

  // All AJAX communication uses JSON
  $.ajaxSetup({
    dataType: 'json'
  });

  // Fetch the history for this user
  $.getJSON('/' + self.user + '/history', function(json) {
    var links = json.history || [];

    // Ensure the links list is sorted by date
    links.sort(function(a, b) {
      a.date - b.date;
    });

    // Populate the links list
    $.each(links, function(index, value) {
      self.links.push(new KiliusLink(value));
    });
  });

  // Register handler to reposition copy links whenever the window size changes
  $(window).resize(self.repositionCopyLinks);
}

$(document).ready(function() {

  // Defer until the UI is completely set-up
  setTimeout(function() {
    var kilius = new KiliusModel();
    ko.applyBindings(kilius);

    // Set ZeroClipboard's path
    ZeroClipboard.setMoviePath('/flash/ZeroClipboard.swf');
  }, 1);
});