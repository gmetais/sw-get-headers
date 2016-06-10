var logger = require('./logger');

(function() {
    'use strict';

    var onPluggedCallbacks = [];
    var onRequestCallbacks = [];
    var onResponseCallbacks = [];

    var plugged = false;
    var corsExceptions = [];

    function registerServiceWorker(swPath, options) {
        if (options && options.debug !== undefined) {
            logger.setDebug(options.debug);
        }

        if (options && options.corsExceptions !== undefined) {
            corsExceptions = options.corsExceptions;
        }

        if (!('serviceWorker' in navigator)) {
            logger.log('[Page] This browser doesn\'t support service workers');
            return;
        }

        if (navigator.serviceWorker.controller) {
            if (navigator.serviceWorker.controller.scriptURL.indexOf(swPath) >= 0) {
                logger.log('[Page] The service worker is already active');
                openCommunicationWithWorker();
            } else {
                logger.error('[Page] The page already has another service worker: ' + navigator.serviceWorker.controller.scriptURL);
            }
            return;
        }

        logger.log('[Page] The service worker needs to be installed');
        navigator.serviceWorker.register(swPath)
            .then(navigator.serviceWorker.ready)
            .then(function (serviceWorkerRegistration) {
                logger.log('[Page] The service worker is registered. It will work after the page changes or is refreshed.');
        });
    }

    function openCommunicationWithWorker() {
        var messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = function(event) {
            if (event.data.error) {
                logger.error('[Page] Receveived an error message from SW:');
                logger.error(event.data.error);
            } else {
                logger.log('[Page] Received a message from SW:');
                logger.log(event.data);

                onDataReceivedFromSW(event.data);
            }
        };
        navigator.serviceWorker.controller.postMessage({
            type: 'hello',
            debug: logger.getDebug(),
            corsExceptions: corsExceptions
        }, [messageChannel.port2]);
    }

    function isPlugged() {
        return plugged;
    }

    function onDataReceivedFromSW(data) {
        if (data.type === 'plugged') {
            plugged = true;
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
                logger.error('[Page] Unknown event:');
                logger.error(event);
                break;
        }
    }

    module.exports = {
        registerServiceWorker: registerServiceWorker,
        on: on,
        isPlugged: isPlugged
    };
})();