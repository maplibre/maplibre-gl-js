# Publish a 5.x patch to npm

`main` holds the current major version. The `5.x` branch only gets security fixes for v5, and its releases are started by hand.

1. Merge the fixes into `5.x` with a PR.
2. Open a PR against `5.x` that bumps the version:
   - Run `npm version patch --no-git-tag-version`.
   - In [`CHANGELOG.md`](../CHANGELOG.md), rename the "main" header to the new version, and add an empty "main" block above it.
   - Double-check that all changes included in the release are [appropriately documented](../CONTRIBUTING.md#changelog-conventions).
3. Once merged, run [Release](https://github.com/maplibre/maplibre-gl-js/actions/workflows/release.yml) by manual workflow dispatch, with `5.x` as the branch. This creates a GitHub release, uploads release assets, and publishes the build output to npm under the `latest-5` tag, so `latest` stays on the current major version.
