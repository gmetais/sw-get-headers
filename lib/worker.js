var clientsList = require('./workerClientsList');
var logger = require('./logger');


var corsExceptions = [];

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

    var mode = getCorsForUrl(event.request.url, event.request.referrer);
    // Credentials would probably need some more options (which domains to send credentials to)
    var credentials = (mode === 'same-origin') ? 'include' : 'omit';

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
function getCorsForUrl(url, referrer) {
    var urlHost = hostParser(url);
    var referrerHost = hostParser(referrer);

    if (urlHost === referrerHost) {
        return 'same-origin';
    }

    var isAnException = corsExceptions.some(function(exception) {
        return (url.indexOf(exception) !== -1);
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

