/* eslint-disable no-global-assign */
/* eslint-disable import/no-commonjs */
/* eslint-disable flowtype/require-valid-file-annotation */

module.exports =  {
    "test_page": "test/integration/testem/testem_page.html",
    "src_files": [
        "dist/maplibre-gl.js",
        "test/integration/dist/query-test.js"
    ],
    "launch_in_dev": [],
    "launch_in_ci": [ "Chrome" ],
    "browser_args": {
        "Chrome": {
            "mode": "ci",
            "args": [ "--headless", "--disable-gpu", "--remote-debugging-port=9222" ]
        }
    },
};
