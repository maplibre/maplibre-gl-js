/* eslint-disable import/unambiguous, import/no-commonjs, no-global-assign */

require('./stub_loader.js');
require('@mapbox/flow-remove-types/register.js');
const {registerFont} = require('canvas');
require = require("esm")(module, true);

const suite = require('./integration/lib/render.js');
const suiteImplementation = require('./suite_implementation.js');
const ignores = require('./ignores.json');
registerFont('./node_modules/npm-font-open-sans/fonts/Bold/OpenSans-Bold.ttf', {family: 'Open Sans', weight: 'bold'});

suite.run('js', ignores, suiteImplementation);
