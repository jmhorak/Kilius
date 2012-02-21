/* Author: Jeff Horak
*/

$(document).ready(function() {
  // Register the click handler for the submit button
  $('#submit-btn').click(function() {
    var oXHR = new XMLHttpRequest(),
        url = document.getElementById('url-input');

    if (url.checkValidity && !url.checkValidity()) {
      // Bad URL
      return;
    }

    oXHR.open('POST', '/service/shorten', true);
    oXHR.setRequestHeader('Content-Type', 'application/json');
    oXHR.onreadystatechange = function(oEvent) {
      if (oXHR.readyState === 4) {
        if (oXHR.status === 200) {
          console.log("Success " + oXHR.responseText);
        } else {
          console.log("Error " + oXHR.status + " " + oXHR.statusText);
        }
      }
    }

    oXHR.send(JSON.stringify({ url: url.value }));
  });
});