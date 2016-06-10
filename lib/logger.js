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