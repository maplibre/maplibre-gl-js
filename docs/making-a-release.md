Until we draft more formal docs, get CI going, and develop our own
release process suited to our needs, here are the steps Seth
is following to make the `v1.13.0-rc` releases from his local machine:

- verify that `yarn --version` >= 1.22
- `git clone https://github.com/maplibre/maplibre-gl-js.git`
- `cd maplibre-gl-js`
- `yarn install`
- `yarn test` (note: this appears to sporadically sometimes fail with a JSON parse error of `babylon/package.json`, not sure why its not deterministic in this respect)
- `yarn prepublishOnly` (this will be run automatically by `yarn publish` too, but it can help to debug this relatively-complex step separately until it works on your machine reliably, and you're happy with the result)
- Update `package.json` to increment the `-rc.____` version, note that we don't use yarns auto-increment feature in `yarn publish` presently, because it struggles with patch release incrementing, and the `-rc.` approach is important to a smooth first `v1.13.0`
- `npm publish`, note that we are using npm publish here, not yarn, I have yet to get `yarn publish` working
- Check `https://www.npmjs.com/package/maplibre-gl` for the new version, and ideally test the new version until we build more confidence from repitition, and automate this procedure (I use a simple jsfiddle pointing at an unpkg url for quick "does it load" final validation)
