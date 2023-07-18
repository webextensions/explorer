import {
    getMany,
    setMany // eslint-disable-line no-unused-vars
} from 'idb-keyval';

let getRequests = {
    pendingRequests: [],
    timeOfFirstPendingRequest: null
};

const flushPendingGetRequests = async function () {
    const pendingRequests = getRequests.pendingRequests;
    const keys = pendingRequests.map(function (request) {
        return request.requestId;
    });
    getRequests = {
        timeOfFirstPendingRequest: null,
        pendingRequests: []
    };
    const values = await getMany(keys);
    for (let i = 0; i < pendingRequests.length; i++) { // eslint-disable-line unicorn/no-for-loop
        const thisRequest = pendingRequests[i];
        const response = values[i];
        thisRequest.callback(response);
    }
};

// getBatched:
//     Receive multiple get requests (can be for different keys). Merge all requests received within a certain time
//     period (batchDuration) into a single get request. Trigger that single get request. Return the results to the
//     individual requests.
const getBatched = async function (key, batchDuration) {
    let promiseResolve,
        promiseReject;
    const pendingPromise = new Promise((resolve, reject) => {
        promiseResolve = resolve;
        promiseReject = reject;
    });

    const thisRequest = {
        requestId: key,
        callback: function (response) {
            if (typeof response === 'undefined') {
                promiseReject();
            } else {
                promiseResolve(response);
            }
        }
    };
    getRequests.pendingRequests.push(thisRequest);
    if (getRequests.timeOfFirstPendingRequest === null) {
        getRequests.timeOfFirstPendingRequest = Date.now();
        setTimeout(async function () {
            await flushPendingGetRequests();
        }, batchDuration);
    }

    const response = await pendingPromise;
    return response;
};

const setBatched = async function (key, value, batchDuration) { // eslint-disable-line no-unused-vars
};

export {
    getBatched,
    setBatched
};
