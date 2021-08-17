# Making a release with docker (recommended)

Until we have CI going, anyone with the necessary permissions on npmjs should be able to make a release, using the simple repeatable docker-based `./build/publish-release.sh` script.

1. Run `./build/publish-release.sh`
2. It will prompt you for a new version number, just increment the rc.X number for now
3. It will build a number of asset types, and test maplibre-gl
4. It will diff the tarball with the previous release of maplibre-gl on npm and ask you to confirm (makes it easy to spot build errors, etc), **note you may need to type y or n and press enter** at this phase to continue 🤷‍♂️
5. Publish the new version to npm. See [RELEASE-PROCESS.md](./RELEASE-PROCESS.md).
6. Update your package.json and git tags on the host machine even though the thing executes in docker 🧙🏿‍♂️. **You should commit the new package.json and push**.
7. Print the URL to the new release

### Without docker (not recommended)

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
- Publish the new version to npm. See [RELEASE-PROCESS.md](./RELEASE-PROCESS.md).
- Check `https://www.npmjs.com/package/maplibre-gl` for the new version, and ideally test the new version until we build more confidence from repitition, and automate this procedure (I use a simple jsfiddle pointing at an unpkg url for quick "does it load" final validation)
