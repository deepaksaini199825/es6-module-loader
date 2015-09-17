  var fetchTextFromURL;
  if (typeof XMLHttpRequest != 'undefined') {
    fetchTextFromURL = function(url, authorization, fulfill, reject) {
      var xhr = new XMLHttpRequest();
      var sameDomain = true;
      var doTimeout = false;
      if (!('withCredentials' in xhr)) {
        // check if same domain
        var domainCheck = /^(\w+:)?\/\/([^\/]+)/.exec(url);
        if (domainCheck) {
          sameDomain = domainCheck[2] === window.location.host;
          if (domainCheck[1])
            sameDomain &= domainCheck[1] === window.location.protocol;
        }
      }
      if (!sameDomain && typeof XDomainRequest != 'undefined') {
        xhr = new XDomainRequest();
        xhr.onload = load;
        xhr.onerror = error;
        xhr.ontimeout = error;
        xhr.onprogress = function() {};
        xhr.timeout = 0;
        doTimeout = true;
      }
      function load() {
        fulfill(xhr.responseText);
      }
      function error() {
        reject(new Error('XHR error' + (xhr.status ? ' (' + xhr.status + (xhr.statusText ? ' ' + xhr.statusText  : '') + ')' : '') + ' loading ' + url));
      }

      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 200 || (xhr.status == 0 && xhr.responseText)) {
            load();
          } else {
            error();
          }
        }
      };
      xhr.open("GET", url, true);

      if (xhr.setRequestHeader) {
        xhr.setRequestHeader('Accept', 'application/x-es-module, */*');
        // can set "authorization: true" to enable withCredentials only
        if (authorization) {
          if (typeof authorization == 'string')
            xhr.setRequestHeader('Authorization', authorization);
          xhr.withCredentials = true;
        }
      }

      if (doTimeout)
        setTimeout(function() {
          xhr.send();
        }, 0);

      xhr.send(null);
    };
  }
  else if (typeof require != 'undefined') {
    var fs;
    fetchTextFromURL = function(url, authorization, fulfill, reject) {
      if (url.substr(0, 8) != 'file:///') {
        if (typeof fetch === 'function') {
          var requestHeaders = {};

          fetch.__fetchCache = fetch.__fetchCache || {};
          var cachedUrl = fetch.__fetchCache[url];

          if (cachedUrl && cachedUrl.lastModified) {
            requestHeaders['if-modified-since'] = cachedUrl.lastModified;
          }

          return fetch(url, {
            cache: 'default',
            headers: requestHeaders,
            method: 'GET'
          })
            .then(function (response) {
              // Happy path
              if (response.status === 304 || (response.status >= 200 && response.status < 300)) {
                if (response.status === 304 && cachedUrl && cachedUrl.responseText) {
                  return fulfill(cachedUrl.responseText);
                }

                return response.text().then(function (data) {
                  // Strip Byte Order Mark out if it's the leading char
                  var dataString = data + '';
                  if (dataString[0] === '\ufeff') {
                    dataString = dataString.substr(1);
                  }

                  fetch.__fetchCache[url] = {
                    lastModified: response.headers.get('last-modified'),
                    responseText: dataString
                  };

                  return fulfill(dataString);
                });
              }

              // Sad path
              return reject(new Error(response.statusText));
            })
            .catch(function (err) {
              return reject(err);
            });
        } else {
          throw new Error('Unable to fetch "' + url + '". Only file URLs of the form file:/// allowed running in Node.');
        }
      }
      fs = fs || require('fs');
      if (isWindows)
        url = url.replace(/\//g, '\\').substr(8);
      else
        url = url.substr(7);
      return fs.readFile(url, function(err, data) {
        if (err) {
          return reject(err);
        }
        else {
          // Strip Byte Order Mark out if it's the leading char
          var dataString = data + '';
          if (dataString[0] === '\ufeff')
            dataString = dataString.substr(1);

          fulfill(dataString);
        }
      });
    };
  }
  else {
    throw new TypeError('No environment fetch API available.');
  }

  SystemLoader.prototype.fetch = function(load) {
    return new Promise(function(resolve, reject) {
      fetchTextFromURL(load.address, undefined, resolve, reject);
    });
  };
