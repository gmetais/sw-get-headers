var clientsList = require('./workerClientsList');

const LOG_SILENT = 0;
const LOG_ERRORS = 1;
const LOG_WARNINGS = 2;
const LOG_INFO = 3;
var logLevel = LOG_WARNINGS;

self.addEventListener('install', function (event) {
    log('[Service worker] Installed', LOG_INFO);
});

self.addEventListener('activate', function (event) {
    log('[Service worker] Activated. Let\'s do some cool things!', LOG_INFO);
});

self.addEventListener('message', function handler (event) {
    
    if (event.data && event.data.type === 'hello') {
        
        if (event.data.logLevel) {
            // TODO : find a solution to set log level before SW install and activate...
            logLevel = event.data.logLevel;
        }

        log('[Service worker] Just received the hello message', LOG_INFO);

        var clientId = event.source.id;
        clientsList.setClientPort(clientId, event.ports[0]);
        log('[Service worker] Messaging port registered correctly for the client', LOG_INFO);

        // Tell the client that the worker is ready
        sendToClient(clientId, {type: 'plugged'});

        log('[Service worker] Now flushing the message waiting list', LOG_INFO);
        var awaitingMessages = clientsList.flushWaitingList(clientId);
        awaitingMessages.forEach(function(data) {
            sendToClient(clientId, data);
        });
    } else {
        log('[Service worker] Just received this un-catched message: ', LOG_WARNING);
        log(event.data, LOG_WARNING);
    }
});

self.addEventListener('fetch', function(event) {
    log('[Service worker] Fetch event', LOG_INFO);
    log(event, LOG_INFO);

    var request = createRequestObject(event.request);

    log('[Service worker] Request sent', LOG_INFO);
    sendToClient(event.clientId, {
        type: 'request',
        request: request
    });

    event.respondWith(
        fetch(event.request.url, {mode: 'no-cors'})

        .then(function(response) {
            log('[Service worker] Response received', LOG_INFO);

            sendToClient(event.clientId, {
                type: 'response',
                request: request,
                response: createResponseObject(response)
            });

            return response;
        })

        .catch(function(error) {
            log('[Service worker] Fetch failed:', LOG_ERRORS);
            log(error, LOG_ERRORS);
        })
    );

});

function sendToClient(clientId, data) {
    self.clients.get(clientId).then(function(client) {
        var clientPort = clientsList.getClientPort(clientId);
        if (clientPort) {
            log('[Service worker] Client port is known. Sending the message', LOG_INFO);
            clientPort.postMessage(data);
        } else {
            log('[Service worker] No client messaging port is defined yet... Pushing the message in waiting list', LOG_INFO);
            clientsList.addToWaitingList(clientId, data);
        }
    });
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
        referrer: request.referrer,
        url: request.url,
        headers: formatHeaders(request.headers)
    };
}

function createResponseObject(response) {
    if (response.type === 'opaque') {
        return {
            opaque: true
        };
    }

    return {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        headers: formatHeaders(response.headers)
    };
}

function log(data, criticity = LOG_INFO) {
    if (criticity <= logLevel) {
        if (criticity === LOG_ERRORS) {
            console.error(data);
        } else if (criticity === LOG_WARNINGS) {
            console.warn(data);
        } else if (criticity === LOG_INFO) {
            console.info(data);
        } else {
            console.log(data);
        }
    }
}
