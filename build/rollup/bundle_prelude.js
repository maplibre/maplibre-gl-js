/* eslint-disable */

var shared, worker, maplibregl;
// define gets called three times: one for each chunk. we rely on the order
// they're imported to know which is which
function define(_, chunk) {
    if (!shared) {
        shared = chunk;
    } else if (!worker) {
        worker = chunk;
    } else {
        var workerBundleString = 'var sharedChunk = {}; (' + shared + ')(sharedChunk); (' + worker + ')(sharedChunk);'

        var sharedChunk = {};
        shared(sharedChunk);
        maplibregl = chunk(sharedChunk, sharedChunk);
        maplibregl = sharedChunk;
        if (typeof window !== 'undefined') {
            sharedChunk.setWorkerUrl(window.URL.createObjectURL(new Blob([workerBundleString], { type: 'text/javascript' })));
        }
    }
}
