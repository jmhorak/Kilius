/* Author: Jeff Horak
*/

var kilius = (function() {
  var hasListItems = false,
      initAnimFinished = false,
      showUserHistory = function() {
        if (hasListItems && initAnimFinished) {
          $('div#userShortenedList').slideDown(200);
        }
      };

  return {
    createListItem: function(sLink, lLink, h) {
      var li = document.createElement('li'),
          div = document.createElement('div'),
          copy = document.createElement('span'),
          shortLink = document.createElement('a'),
          longLink = document.createElement('a'),
          hits = document.createElement('span');

      li.setAttribute('class', 'historyLink');
      li.appendChild(div);
      div.setAttribute('class', 'shortContainer');
      div.appendChild(copy);
      copy.setAttribute('class', 'copyLink');
      copy.appendChild(document.createTextNode('Copy'));
      div.appendChild(shortLink);
      shortLink.setAttribute('href', sLink);
      shortLink.setAttribute('class', 'shortLink');
      shortLink.appendChild(document.createTextNode(sLink.substring(sLink.indexOf('kili'))));
      li.appendChild(longLink);
      longLink.setAttribute('href', lLink);
      longLink.setAttribute('class', 'longLink');
      longLink.appendChild(document.createTextNode(lLink));
      li.appendChild(hits);
      hits.setAttribute('class', 'hitCount');
      hits.appendChild(document.createTextNode(h));

      return li;
    },

    fetchUserHistory: function(user, cb) {
      var oXHR = new XMLHttpRequest();

      oXHR.open('GET', ['/' + user + '/history'].join(''), true);
      oXHR.onreadystatechange = function(oEvent) {
        if (this.readyState === 4) {
          if (this.status === 200) {
            cb(JSON.parse(this.responseText).history);
          }
        }
      };

      oXHR.send();
    },

    onAnimationFinished: function() {
      initAnimFinished = true;
      showUserHistory();
    },

    onUserHistoryBuilt: function() {
      hasListItems = true;
      showUserHistory();
    }
  };
})();

$(document).ready(function() {

  kilius.fetchUserHistory('k', function(history) {
    var sl = $('#shortList');

    // Clear the short list container
    $('#shortList > li').remove();

    // Now push the new history elements into that list
    for (var idx = 0; idx < history.length; idx++) {
      sl.append(kilius.createListItem(history[idx].short, history[idx].long, history[idx].hits));
    }

    if (history.length > 0) {
      kilius.onUserHistoryBuilt();
    }
  });

  // Register the click handler for the submit button
  $('#submit-btn').click(function() {
    var oXHR = new XMLHttpRequest(),
        url = document.getElementById('url-input');

    if (url.checkValidity && !url.checkValidity()) {
      // Bad URL
      return;
    }

    oXHR.open('POST', '/+/', true);
    oXHR.setRequestHeader('Content-Type', 'application/json');
    oXHR.onreadystatechange = function(oEvent) {
      var li = null,
          ul = null;

      if (this.readyState === 4) {
        if (this.status === 201) {
          li = kilius.createListItem(this.getResponseHeader('Location'), url.value, 0);
          ul = document.getElementById('shortList');

          // Insert as the new first item in the list
          if (ul && li) {
            ul.insertBefore(li, ul.firstChild);
            kilius.onUserHistoryBuilt();
          }
        } else {
          console.log("Error " + this.status + " " + this.statusText);
        }
      }
    }

    oXHR.send(JSON.stringify({ url: url.value }));
  });

  setTimeout(function() {
    document.querySelector('h1#logo').className = 'toBlack';
    $('#main, #banner').fadeIn(1150, function() {
      kilius.onAnimationFinished();
    });
  }, 400);
});