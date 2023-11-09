## Publish to NPM

1. Review [`CHANGELOG.md`](../CHANGELOG.md)
   - Double-check that all changes included in the release are [appropriately documented](../CONTRIBUTING.md#changelog-conventions).
   - To-be-released changes should be under the "main" header.
   - Commit any final changes to the changelog.
2. Run [`release.yml`](https://github.com/maplibre/maplibre-gl-js/actions/workflows/release.yml) by manual workflow dispatch and set the version number in the input. This builds the minified library, tags the commit based on the version in `package.json`, creates a GitHub release, uploads release assets, and publishes the build output to NPM.

The workflow expects `${{ secrets.NPM_ORG_TOKEN }}` organization secret in order to push to NPM registry.
