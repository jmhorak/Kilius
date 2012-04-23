/* Author: Jeff Horak
*/

// Add forEach to older browsers
Array.prototype.forEach = Array.prototype.forEach || function(callback, thisArg) {
  for (var idx = 0, len = this.length; idx < len; idx++) {
    if (thisArg) {
      callback.call(thisArg, this[idx]);
    }
  }
};

/**
 * A user history record
 *
 * @param content - Constuctor object for creating the history record
 */
var HistoryEntry = function(content) {
  this.shortLink = content.short;
  this.longLink = content.long;
  this.hits = content.hits;
  this.clip = null;
  this.copyCell = null;

  this.createRow = function() {
    // Content elements
    var copyCellContent = document.createElement('div'),
        shortLinkContent = document.createElement('a'),
        longLinkContent = document.createElement('a'),

        // Create the cells within the row
        copyCell = document.createElement('td'),
        shortLinkCell = document.createElement('td'),
        longLinkCell = document.createElement('td'),
        hitsCell = document.createElement('td'),

        // Create the row within the table
        row = document.createElement('tr');

    // Set the data within the Copy cell
    copyCellContent.textContent = 'Copy';
    copyCellContent.setAttribute('class', 'copy-cell');

    // Set the data within the shortened link cell
    shortLinkContent.setAttribute('href', this.shortLink);
    shortLinkContent.setAttribute('class', 'table-link');
    // Remove the 'http://' from the link
    shortLinkContent.textContent = this.shortLink.substring(this.shortLink.indexOf('kili'));

    // Set the data within the long link cell
    longLinkContent.setAttribute('href', this.longLink);
    longLinkContent.setAttribute('class', 'table-link');
    longLinkContent.textContent = this.longLink;

    // Set the data within the hit cell
    hitsCell.textContent = this.hits;
    hitsCell.setAttribute('class', 'right-align');

    // Add CSS to short and long link cells
    shortLinkCell.setAttribute('class', 'short-link-cell');
    longLinkCell.setAttribute('class', 'long-link-cell');

    // Now create the row
    copyCell.appendChild(copyCellContent);
    this.copyCell = copyCell;
    shortLinkCell.appendChild(shortLinkContent);
    longLinkCell.appendChild(longLinkContent);

    row.appendChild(copyCell);
    row.appendChild(shortLinkCell);
    row.appendChild(longLinkCell);
    row.appendChild(hitsCell);

    return row;
  };

  this.reposition = function() {
    var that = this;

    if (!kilius.isEmpty(this.clip)) {
      this.clip.reposition();
    } else {
      // Set up the clipboard
      this.clip = new ZeroClipboard.Client();
      this.clip.setText(this.shortLink);

      // Adjust the clipboard item after the DOM has a chance to update
      setTimeout(function() {
        that.clip.glue(that.copyCell);
        that.clip.reposition();
      }, 0);
    }
  };

  this.destroy = function() {
    if (this.clip) this.clip.destroy();
  }
}

var kilius = (function() {

  /**
   * Fetch the new link and determine if it is valid
   *
   * @returns Object { valid: bool, address: the url to post to the server }
   */
  function getNewLink() {
    var input = $('#url-input')[0],
        url = input ? input.value : '',
        valid = !kilius.isEmpty(url);

    // If the URL HTML-input type is supported, this function will be defined and the browser
    //   can do some input validation for us
    if (input.checkValidity) {
      valid &= input.checkValidity();
    }

    return {
      valid: valid,
      address: url
    }
  };

  function clearLink() {
    $('#url-input').val('');
  };

  /**
   * Show an error message to the user
   *
   * @param message {String} The message to display, if empty use a default
   */
  function showError(message) {
    // If no message provided, use the default
    if (kilius.isEmpty(message)) { message = 'An error occurred'; }
    $('section.err').text(message).removeClass('hidden');
  };

  /**
   * Hides the error message
   */
  function hideError() {
    $('section.err').addClass('hidden');
  };

  return {

    init: function() {

      // Set ZeroClipboard's path
      ZeroClipboard.setMoviePath('/flash/ZeroClipboard.swf');

      // Initialize all sub-components
      kilius.comms.init();
      kilius.dom.init();
    },

    populateHistoryForCurrentUser: function() {
      // TODO: Provide an actual user
      kilius.comms.populateUserHistory('k');
    },

    // Misc function for determing if something exists
    isEmpty: function(x) {
      return x === '' || x === undefined || x === null;
    },

    comms: (function() {
      function ajaxRequest(request, cb) {
        $.ajax({
          url: request.url,
          type: request.type,
          data: JSON.stringify(request.data || {}),
          contentType: 'application/json',
          processData: false,

          error: function(jqXHR, textStatus, errorThrown) {
            // Handle error
            var err = [
              'The Kili.us server reported a problem: ',
              textStatus ? textStatus[0].toUpperCase() + textStatus.slice(1) : 'Error',
              ' - ',
              errorThrown ? errorThrown : 'General Error'
            ].join('');

            showError(err);
          },

          success: cb
        })
      };

      return {
        init: function() {
          // Only accept JSON from the server
          $.ajaxSetup({
            dataType: 'json'
          });
        },

        populateUserHistory: function(user) {
          ajaxRequest({
            url: ['/' + user + '/history'].join(''),
            type: 'GET'
          }, function(data, textStatus, jqXHR) {
            var history = kilius.isEmpty(data) ? [] : (data.history || []);

            if (jqXHR.status === 200) {
              kilius.dom.clearHistoryEntries();

              for (var idx = history.length-1; idx >= 0; idx--) {
                kilius.dom.insertRow(new HistoryEntry(history[idx]));
              }
            } else {
              showError('The server did not reply to the request in the correct format');
            }
          });
        },

        postNewLink: function() {
          var url = getNewLink();

          if (!url.valid) {
            // Bad URL
            showError('Enter a valid URL');
            return;
          }

          // Dismiss any existing error message
          hideError();

          ajaxRequest({
            url: '/+/',
            type: 'POST',
            data: { url: url.address }
          }, function(data, textStatus, jqXHR) {
            var entry = null;

            if (jqXHR.status === 201) {

              entry = new HistoryEntry({
                short: jqXHR.getResponseHeader('Location'),
                long: url.address,
                hits: 0
              });

              kilius.dom.insertRow(entry);
              clearLink();
            } else {
              showError('The server did not reply to the request in the correct format');
            }
          });
        }
      }
    })(),

    dom: (function() {
      var hasListItems = false,
          showTable = false,
          showRowItems = false,
          supportAnimations = false,
          historyEntries = [];

      function displayTable() {
        if (hasListItems && showTable) {
          $('.link-history-table').removeClass('hidden');
          $('.link-table-container').removeClass('fadeOut fromTop').addClass('fadeIn toBottom');
        }
      };
      function hideTable() {
        $('.link-table-container').removeClass('toBottom fadeIn').addClass('fromTop fadeOut');
        $('.link-history-table').removeClass('hidden');
      };
      function updateClipboardElements() {
        historyEntries.forEach(function(entry) {
          entry.reposition();
        })
      };

      return {
        init: function() {
          // Setup some event handlers
          $('#submit-btn').click(kilius.comms.postNewLink);
          $('form.content').submit(function() {
            kilius.comms.postNewLink();
            return false; // Don't acutally do a submit
          });

          $(window).resize(updateClipboardElements);

          supportAnimations = $('html').hasClass('cssanimations');

          function onLogoAnimationFinished() {
            showTable = true;
            displayTable();
          };

          var onTableAnimationFinished = function() {
            showRowItems = true;
            //$('tbody').removeClass('hidden');

            // Hack, animation is blown away when tbody updates from being hidden
            setTimeout(function() {
              $('tbody tr').removeClass('fadeOut').addClass('fadeIn');

              // Add the flash overlays
              updateClipboardElements();
            }, 0);
          };

          $('#banner').bind('webkitTransitionEnd transitionend MSTransitionEnd oTransitionEnd', onLogoAnimationFinished);
          $('.link-table-container').bind('webkitTransitionEnd transitionend MSTransitionEnd oTransitionEnd', function(evt) {
            if (evt.srcElement === this) onTableAnimationFinished();
          });


          // Start the initial animation - change the logo color to black and fade in the controls
          $('h1#logo').attr('class','toBlack');
          $('#main, #banner').attr('class', 'fadeIn');

          if (!supportAnimations) {
            // CSS Animations aren't supported, just skip the fluff and get to the end state
            onLogoAnimationFinished();
            onTableAnimationFinished();
          }
        },

        insertRow: function(entry) {
          var tbody = $('.link-history').first(),
              row = entry ? entry.createRow() : {},
              rowClass = row.getAttribute('class');

          // Insert the link as the new first item in the list
          if (!kilius.isEmpty(row) && !kilius.isEmpty(tbody)) {

            // Normalize the rowClass to an empty string or the existing class plus a space
            if (kilius.isEmpty(rowClass)) { rowClass = ''; } else { rowClass += ' '; }

            // If not showing row items yet, add the fadeOut class to the row, otherwise fadeIn
            row.setAttribute('class', rowClass + (showRowItems ? 'fadeIn' :'fadeOut'));

            tbody.prepend(row);
            historyEntries.push(entry);

            hasListItems = true;
            displayTable();

            if (showRowItems) {
              updateClipboardElements();
            }
          }
        },

        clearHistoryEntries: function(hide) {
          // Destroy history entries
          historyEntries.forEach(function(entry) {
            entry.destroy();
          });

          // Delete reference
          historyEntries = [];
          hasListItems = false;

          // Remove DOM elements
          $('.link-history > tr').remove();

          // Optionally hide the table
          if (hide) {
            hideTable();
          }
        }
      }
    })()
  }
})();

$(document).ready(function() {
  kilius.init();
  kilius.populateHistoryForCurrentUser();
});
