

## API

```html
<script src="/swgetheaders-page.js"></script>
<script>
    var options = {
        debug: true
    };
    swgetheaders.registerServiceWorker('/swgetheaders-worker.js', options);
    swgetheaders.on('plugged', function() {
        console.log('The service worker is now activated and ready to listen to requests');
    });
    swgetheaders.on('request', function(request) {
        console.log('A request was just sent:');
        console.log(request);
    });
    swgetheaders.on('response', function(request, response) {
        console.log('A response just arrived. We have both the request and the response:');
        console.log(request);
        console.log(response);
    });
</script>
```