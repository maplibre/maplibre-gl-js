/* eslint-disable */

var maplibregl = {};
var modules = {};
function define(moduleName, _dependencies, moduleFactory) {
    modules[moduleName] = moduleFactory;

    // to get the list of modules see generated dist/maplibre-gl-dev.js file (look for `define(` calls)
    if (moduleName !== 'index') {
        return;
    }

    // we assume that when an index module is initializing then other modules are loaded already
    var workerBundleString = 'var sharedModule = {}; (' + modules.shared + ')(sharedModule); (' + modules.worker + ')(sharedModule);'

    var sharedModule = {};
    // the order of arguments of a module factory depends on rollup (it decides who is whose dependency)
    // to check the correct order, see dist/maplibre-gl-dev.js file (look for `define(` calls)
    // we assume that for our 3 chunks it will generate 3 modules and their order is predefined like the following
    modules.shared(sharedModule);
    modules.index(maplibregl, sharedModule);

    if (typeof window !== 'undefined') {
        maplibregl.setWorkerUrl(window.URL.createObjectURL(new Blob([workerBundleString], { type: 'text/javascript' })));
    }

    return maplibregl;
};

