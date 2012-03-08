/* Author: Jeff Horak
*/

var kilius = (function() {
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
    }
  };
})();

$(document).ready(function() {
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
      var resp = {},
          li = null,
          ul = null;

      if (oXHR.readyState === 4) {
        if (oXHR.status === 201) {
          resp = JSON.parse(oXHR.responseText);
          li = kilius.createListItem(resp.url, url.value, 7);
          ul = document.getElementById('shortList');

          // Insert as the new first item in the list
          if (ul && li) {
            ul.insertBefore(li, ul.firstChild);
          }

        } else {
          console.log("Error " + oXHR.status + " " + oXHR.statusText);
        }
      }
    }

    oXHR.send(JSON.stringify({ url: url.value }));
  });
});