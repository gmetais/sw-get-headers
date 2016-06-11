require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
},{}],"swgetheaders":[function(require,module,exports){
var logger = require('./logger');

(function() {
    'use strict';

    var onPluggedCallbacks = [];
    var onRequestCallbacks = [];
    var onResponseCallbacks = [];

    var plugged = false;
    var corsExceptions = [];
    var sameDomainOnly = false;

    function registerServiceWorker(swPath, options) {
        if (options && options.debug !== undefined) {
            logger.setDebug(options.debug);
        }

        if (options && options.corsExceptions !== undefined) {
            corsExceptions = options.corsExceptions;
        }

        if (options && options.sameDomainOnly !== undefined) {
            sameDomainOnly = options.sameDomainOnly;
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
            corsExceptions: corsExceptions,
            sameDomainOnly: sameDomainOnly
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
},{"./logger":1}]},{},[]);
