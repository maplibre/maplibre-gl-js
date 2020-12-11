# MapLibre GL

**MapLibre GL** is a community led fork derived from [mapbox-gl-js](https://github.com/mapbox/mapbox-gl-js) prior to their switch to a non-OSS license.

[<img width="200" alt="MapLibre" src="https://user-images.githubusercontent.com/223277/101580282-7534f700-397e-11eb-8b58-687f52e2a8cf.png">](http://maplibre.org)

### Migrating from mapbox-gl

If you depend on mapbox-gl directly, simply replace `mapbox-gl` with `maplibre-gl` in `package.json`:
```diff
  "dependencies": {
-    "mapbox-gl": "^1.13.0"
+    "maplibre-gl": ">=1.13.0-rc.1"
  }
```

Want an example? [Try out MapLibre GL on CodePen](https://codepen.io/snickell/pen/dypOWzj)

If you use mapbox-gl via bindings (react, vue, etc), you may need to wait a little longer as we develop an easy migration path for each binding. Contributions welcome!

### Roadmap

This project's initial plans are outlined in the [Roadmap](https://github.com/maplibre/maplibre-gl-js/projects/2) project. The primary goal is consistency and backwards-compatability with previous releases and continued bug-fixes and maintenance going forward.

### Getting Involved

Join the #maplibre slack channel at OSMUS: get an invite at https://osmus-slack.herokuapp.com/

### Avoid Fragmentation

If you depend on a free software alternative to `mapbox-gl-js`, please consider joining our effort! Anyone with a stake in a healthy community led fork is welcome to help us figure out our next steps. We welcome contributors and leaders! MapLibre GL already represents the combined efforts of a few early fork efforts, and we all benefit from "one project" rather than "our way". If you know of other forks, please reach out to them and direct them here.

### Thank you Mapbox 🙏🏽

We'd like to acknowledge the amazing work Mapbox has contributed to open source. The open source community is sad to part ways with them, but we simultaneously feel grateful for everything they already contributed. `mapbox-gl-js` 1.x is an open source achievment which now lives on as `maplibre-gl`. We're proud to develop on the shoulders of giants, thank you Mapbox 🙇🏽‍♀️

## License

MapLibre GL is licensed under the [3-Clause BSD license](./LICENSE.txt).
