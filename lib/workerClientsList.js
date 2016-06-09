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