# Service Worker Get Headers

Being able to see headers information on every request can be very useful in your browser's network console. But it could sometimes be interesting to access these headers informations from the page, in JavaScript. XMLHttpRequests allow that, but most requests on a page are not XHR.

Examples of things that it could help you with:
- read file size on images, stylesheets, scripts, fonts, ...
- detect misconfigured server (caching, compression, keep-alive, ...)
- read caching and expiring informations

*This project is currenlty more a "proof of concept" than a library you can rely on. Please use with extra caution and PLEASE report any bug you see.*


## How it works

It uses [Service Workers](https://developer.mozilla.org/fr/docs/Web/API/Service_Worker_API) to spy on every request made, read the headers, than send the information back to the page's JavaScript.

**Your website needs to be on HTTPS.** It works on localhost regardless of protocol.

For security reasons, many limitations have been built in browsers regarding reading headers on **cross-domain** requests. Have a look at the [Cross domain problems](#cross-domain-problems) chapter.


## Compatible browsers

This library will only work on browsers that support Service Workers: Chrome, FireFox and Opera. Edge should arrive soon. Have a look on [CanIUse](http://caniuse.com/#feat=serviceworkers).


## Install

First you need to download the two scripts `swgetheaders-page.js` and `swgetheaders-worker.js` and put them in your workspace.

#### The page-side script

The `swgetheaders-page.js` is the library that your code will control. Just call it as a normal script on your page like this:
```html
<script src="/some-path/swgetheaders-page.js"></script>
```
You can (and probably should) concat it with your other scripts.

#### The worker-side script
The `swgetheaders-worker.js` is the service worker. It needs to be hosted on the same origin as the page.

Add this line of code on your page to load the worker:
```js
swgetheaders.registerServiceWorker('/some-path/swgetheaders-worker.js');
```

Please note that the worker will not be available on the first page load, but only after a page change or a reload. This is due to some limitations in Service Workers.


## Usage

You can subscribe to 2 kind of events:

#### The `plugged` event
```js
swgetheaders.on('plugged', function() {
    console.log('The service worker is now activated and ready to listen to requests');
});
```
The worker is installed + the communication channel between the page and the worker is open. In most case, this appends lately on the page load and the worker has already spied some network requests. It automatically puts their headers in a waiting list and sends them to the page once the communication channel is open, so you will probably be flooded by previous requests just after this `plugged` event is sent.

The status of the worker can also be asked at any time like this: `swgetheaders.isPlugged()`


#### The `response` event
```js
swgetheaders.on('response', function(request, response) {
    console.log('A response just arrived: ', response);
});
```

The worker catched a network response. The callback method takes two arguments:

- First argument: the `request` object that looks like below:
```json
{
  "method": "GET",
  "url": "http://localhost:8080/examples/assets/justAScript.js?q=1465589915112",
  "referrer": "http://localhost:8080/examples/checkGzip.html",
  "headers": [
    {
      "name": "accept",
      "value": "*/*"
    },
    {
      "name": "user-agent",
      "value": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2762.0 Safari/537.36"
    }
  ]
}
```

- Second argument: the `response` object that looks like this:
```json
{
  "status": 200,
  "statusText": "OK",
  "url": "http://localhost:8080/examples/assets/justAScript.js?q=1465589915112",
  "headers": [
    {
      "name": "date",
      "value": "Fri, 10 Jun 2016 20:18:35 GMT"
    },
    {
      "name": "last-modified",
      "value": "Thu, 09 Jun 2016 16:36:16 GMT"
    },
    {
      "name": "server",
      "value": "ecstatic-0.7.6"
    },
    {
      "name": "content-type",
      "value": "application/javascript; charset=utf-8"
    },
    {
      "name": "cache-control",
      "value": "max-age=3600"
    },
    {
      "name": "connection",
      "value": "keep-alive"
    },
    {
      "name": "content-length",
      "value": "133"
    }
  ]
}
```


## Options

When calling the `registerServiceWorker` method, you can add some options:

```js
var options = {
    sameDomainOnly: false,
    corsExceptions: [
        'code.jquery.com',
        'platform.twitter.com'
    ],
    debug: true
};

swgetheaders.registerServiceWorker('/some-path/swgetheaders-worker.js', options);
```

#### `sameOriginOnly`

When set to `true`, restricts spying to the same-origin requests. All third-party domains will be ignored. Default is `false`.

#### `corsExceptions`

By default, the library fetches every cross-domain in `no-cors` mode, to avoid the request to be blocked by the browser's cross-origin limitations. The problem is that the `no-cors` responses are "opaque", which means that headers are not accessible.

If some of the cross-domain requests on your page respond with the `Access-Control-Allow-Origin` header, use this option to tell the library that it can call them with the `cors` mode. This means that the response headers will be readable (not all of the headers). Have a look at the [Cross domain problems](#cross-domain-problems) chapter for more information.

This option needs to be an array of strings. When the browser makes a request to an URL, the URL will be checked with a simple `indexOf` on each of the specified exceptions, like this: `if (url.indexOf(exception) >= 0) {cors}`. So you can enter here domain names, file names, full paths, ...

#### `debug`

When set to `true`, the library will be much more verbose. Default is `false`.

## Full example

```js
// Needed because the library uses browserify
var swgetheaders = require('swgetheaders');

// Register the service worker (with some options)
swgetheaders.registerServiceWorker('/swgetheaders-worker.js', {
    debug: true,
    corsExceptions: [
        'code.jquery.com',
        'platform.twitter.com'
    ]
});

swgetheaders.on('plugged', function() {
    console.log('The service worker is now activated and ready to listen to requests');
});

swgetheaders.on('response', function(request, response) {
    console.log('A response just arrived. We have both the request and the response:', request, response);
});
```


## Cross domain problems

CORS restrictions are a bit annoying.

#### Opaque response
When making a cross-domain request, the service-worker can't access the response headers (neither the response code). The library will fire a `response` event, but the response object will only be: `{"opaque": true}`.

#### Access-Control-Allow-Origin
If the cross-origin server responds with the `Access-Control-Allow-Origin: *` header (or your domain instead if `*`), then we can have more information than the opaque response. Sadly, it seems that not all headers are available. Just a few of them, such as Expire, Cache-Control, Content-Type, Last-Modified. If you have more information about which headers are concerned, please open an issue or email me.

To gain access to cross-origin headers, the library needs you to specify an exception with the `corsExceptions` option. Double check the result, because if a request is sent with the exception and the server doesn't respond with the `Access-Control-Allow-Origin` header, then your request fails with an error: `Fetch API cannot load https://platform.twitter.com/widgets.js. No 'Access-Control-Allow-Origin' header is present on the requested resource.` 

If you don't need to spy on cross-origin requests, it's probably safer to use the `sameOriginOnly` option.

#### Cookies
Service workers disallow sending cookies along with cross-origin requests. This is the same security rules that applies on XMLHttpRequest. It might work if the server responds with a `Access-Control-Allow-Credentials` header, but this library is not compatible with that for the moment.

Only same-origin cookies are sent.


## What's next?

This library is still in very early stage. It could be made available as an npm module. It could also be enhanced to allow to modify the headers before sending the request.

If you want me to go on enhancing the library, please add a star to the project on GitHub. The more stars, the more I'll do!


# Author
Gaël Métais. I'm a webperf freelance. Follow me on Twitter [@gaelmetais](https://twitter.com/gaelmetais), I tweet about Web Performances and Front-end!

If you understand French, you can visit [my website](http://www.gaelmetais.com) (will be soon in English too).
