(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var Logger = function() {

    var debug = false;

    function log(message) {
        if (debug) {
            console.info(message);
        }
    }

    function error(message) {
        console.error(message);
    }

    function getDebug() {
        return debug;
    }

    function setDebug(value) {
        debug = value;
    }

    return {
        log: log,
        error: error,
        getDebug: getDebug,
        setDebug: setDebug
    };
};

module.exports = new Logger();
},{}],2:[function(require,module,exports){
var clientsList = require('./workerClientsList');
var logger = require('./logger');


var corsExceptions = [];
var sameDomainOnly = false;

self.addEventListener('activate', function (event) {
    logger.log('[Service worker] Activated');
});

self.addEventListener('message', function handler (event) {
    
    if (event.data && event.data.type === 'hello') {
        
        if (event.data.debug) {
            // TODO : find a solution to set debug mode before SW install and activate...
            logger.setDebug(true);
        }

        corsExceptions = event.data.corsExceptions;
        sameDomainOnly = event.data.sameDomainOnly;

        logger.log('[Service worker] Hello message received');

        var clientId = event.source.id;
        clientsList.setClientPort(clientId, event.ports[0]);
        logger.log('[Service worker] Client\'s messaging port registered');

        // Tell the client that the worker is ready
        sendToClient(clientId, {type: 'plugged'});

        logger.log('[Service worker] Flushing the message waiting list');
        var awaitingMessages = clientsList.flushWaitingList(clientId);
        awaitingMessages.forEach(function(data) {
            sendToClient(clientId, data);
        });

    } else {
        logger.log('[Service worker] Un-catched message:');
        logger.log(event.data);
    }
});

self.addEventListener('fetch', function(event) {
    logger.log('[Service worker] Fetch event');

    var request = createRequestObject(event.request);

    logger.log('[Service worker] Request sent');
    sendToClient(event.clientId, {
        type: 'request',
        request: request
    });

    var mode = getCorsForUrl(event.request);
    // Credentials would probably need some more options (which domains to send credentials to)
    var credentials = (mode === 'same-origin') ? 'include' : 'omit';

    if (sameDomainOnly && mode !== 'same-origin') {
        logger.log('[Service worker] Request blocked by sameDomainOnly option');
        return;
    }

    event.respondWith(

        fetch(new Request(event.request, {mode: mode, credentials: credentials}))

        .then(function(response) {
            logger.log('[Service worker] Response received');

            sendToClient(event.clientId, {
                type: 'response',
                request: request,
                response: createResponseObject(response)
            });

            return response;
        })

        .catch(function(error) {
            logger.error('[Service worker] Fetch failed:');
            logger.error(error);

            var response = new Response(new Blob(), {
                status: 409,
                statusText: '[Service worker problem] Remove the CORS exception for this request'
            });

            sendToClient(event.clientId, {
                type: 'response',
                request: request,
                response: createResponseObject(response)
            });
        })
    );

});

function sendToClient(clientId, data) {
    self.clients.get(clientId).then(function(client) {
        var clientPort = clientsList.getClientPort(clientId);
        if (clientPort) {
            logger.log('[Service worker] Sending message to client');
            clientPort.postMessage(data);
        } else {
            logger.log('[Service worker] Client messaging port not defined yet... Pushing message in waiting list');
            clientsList.addToWaitingList(clientId, data);
        }
    });
}

// Checks if the request should be fetched with the mode 'cors', 'np-cors' or 'same-origin'
function getCorsForUrl(request) {
    var urlHost = hostParser(request.url);
    var referrerHost = hostParser(request.referrer);

    if (request.mode === 'navigate') {
        return 'navigate';
    }

    if (urlHost === referrerHost || request.referrer === '') {
        return 'same-origin';
    }

    var isAnException = corsExceptions.some(function(exception) {
        return (request.url.indexOf(exception) !== -1);
    });

    return isAnException ? 'cors' : 'no-cors';
}

function hostParser(url) {
    var match = url.match(/^(https?\:\/\/[^\/]*)(\/|$)/);
    return match && match[1];
}

function formatHeaders(headersObject) {
    var headers = [];
    for (var pair of headersObject.entries()) {
        headers.push({
            name: pair[0],
            value: pair[1]
        });
    }

    return headers;
}

function createRequestObject(request) {
    return {
        method: request.method,
        url: request.url,
        referrer: request.referrer,
        headers: formatHeaders(request.headers)
    };
}

function createResponseObject(response) {
    
    if (response.type === 'opaque') {
        // Happens on cross-origin requests. If the server returns an "Access-Control-Allow-Origin" header, you can 
        // add the domain in the "corsExceptions" option.
        return {
            opaque: true
        };
    }

    var result = {
        status: response.status,
        statusText: response.statusText
    };

    if (response.url) {
        result.url = response.url;
    }

    var headers = formatHeaders(response.headers);
    if (headers.length > 0) {
        result.headers = headers;
    }

    return result;
}


},{"./logger":1,"./workerClientsList":3}],3:[function(require,module,exports){
var WorkerClientsList = function() {

    var clientsList = {};

    function setClientPort(clientId, port) {
        if (!clientsList[clientId]) {
            clientsList[clientId] = {};
        }
        clientsList[clientId].port = port;
    }

    function getClientPort(clientId) {
        if (clientsList[clientId]) {
            return clientsList[clientId].port;
        }
        return null;
    }

    function addToWaitingList(clientId, data) {
        if (!clientsList[clientId]) {
            clientsList[clientId] = {
                waitingList: []
            };
        }
        clientsList[clientId].waitingList.push(data);
    }

    function flushWaitingList(clientId) {
        var result = [];
        if (clientsList[clientId] && clientsList[clientId].waitingList) {
            result = clientsList[clientId].waitingList;
            clientsList[clientId].waitingList =[];
        }
        return result;
    }

    return {
        setClientPort: setClientPort,
        getClientPort: getClientPort,
        addToWaitingList: addToWaitingList,
        flushWaitingList: flushWaitingList
    };
};

module.exports = new WorkerClientsList();
},{}]},{},[2]);
