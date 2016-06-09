(function() {
    'use strict';

    var onPluggedCallbacks = [];
    var onRequestCallbacks = [];
    var onResponseCallbacks = [];

    const LOG_SILENT = 0;
    const LOG_ERRORS = 1;
    const LOG_WARNINGS = 2;
    const LOG_INFO = 3;
    var logLevel = LOG_WARNINGS;

    function registerServiceWorker(swPath, options) {
        if (options && options.logLevel >= 0) {
            logLevel = options.logLevel;
        }

        if (!('serviceWorker' in navigator)) {
            log('[Page] Your browser doesn\'t support service workers', LOG_WARNINGS);
            return;
        }

        if (navigator.serviceWorker.controller) {
            if (navigator.serviceWorker.controller.scriptURL.indexOf(swPath) >= 0) {
                log('[Page] The service worker is already active', LOG_INFO);
                openCommunicationWithWorker();
            } else {
                log('[Page] The page already has another service worker: ' + navigator.serviceWorker.controller.scriptURL, LOG_ERRORS);
            }
            return;
        }

        log('[Page] The service worker needs to be installed');
        navigator.serviceWorker.register(swPath)
            .then(navigator.serviceWorker.ready)
            .then(function (serviceWorkerRegistration) {
                log('[Page] The service worker is registered. It will work after the page changes or is refreshed.', LOG_WARNINGS);
        });
    }

    function openCommunicationWithWorker() {
        var messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = function(event) {
            if (event.data.error) {
                log('[Page] Receveived an error message from SW:', LOG_ERRORS);
                log(event.data.error, LOG_ERRORS);
            } else {
                log('[Page] Received a message from SW:', LOG_INFO);
                log(event.data, LOG_INFO);

                onDataReceivedFromSW(event.data);
            }
        };
        navigator.serviceWorker.controller.postMessage({
            type: 'hello',
            logLevel: logLevel
        }, [messageChannel.port2]);
    }

    function onDataReceivedFromSW(data) {
        if (data.type === 'plugged') {
            broadcast(onPluggedCallbacks);
        } else if (data.type === 'request') {
            broadcast(onRequestCallbacks, data.request);
        } else if (data.type === 'response') {
            broadcast(onResponseCallbacks, data.request, data.response);
        }
    }

    function broadcast(cbList, ...data) {
        cbList.forEach(function(cb) {
            cb(...data);
        });
    }

    function on(event, callback) {
        switch(event) {
            case 'plugged':
                onPluggedCallbacks.push(callback);
                break;
            case 'request':
                onRequestCallbacks.push(callback);
                break;
            case 'response':
                onResponseCallbacks.push(callback);
                break;
            default:
                log('[Page] Unknown event:', LOG_ERRORS);
                log(event, LOG_ERRORS);
                break;
        }
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

    module.exports = {
        registerServiceWorker: registerServiceWorker,
        on: on
    };
})();