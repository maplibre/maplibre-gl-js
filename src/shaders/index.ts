// This file is intended for use in the GL-JS test suite
// It provides the shaders entry point for Node (tests and GL Native)
// In a browser environment, this file is replaced with ./src/shaders/shaders.js
// when Rollup builds the main bundle.
// See package.json#browser

/* eslint-disable import/unambiguous, import/no-commonjs, no-global-assign */

// HM TODO: this doesn't work, it needs to be added back when starting to understand how the tests work...
// Also we want to remove esm too...
//const fs = require('fs');

// enable ES Modules in Node
//require = require("esm")(module);

// enable requiring GLSL in Node
//require.extensions['.glsl'] = function (module, filename) {
//    const content = fs.readFileSync(filename, 'utf8');
//    module._compile(`module.exports = \`${content}\``, filename);
//};

//module.exports = require("./shaders.js");
export {};
