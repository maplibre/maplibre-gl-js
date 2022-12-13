## Publish to NPM

1. Review [`CHANGELOG.md`](../CHANGELOG.md) and double checkx that all changes included in the release are [appropriately documented](https://github.com/maplibre/maplibre-gl-js/blob/main/CONTRIBUTING.md#changelog-conventions).
2. Use [semantic version rules](https://docs.npmjs.com/about-semantic-versioning) to define a version. The command [`npm version`](https://docs.npmjs.com/cli/commands/npm-version) will bump the version and create a commit (e.g. if making a backwards-compatible release with new features, `npm version minor`).
3. Run [`release.yml`](https://github.com/maplibre/maplibre-gl-js/actions/workflows/release.yml) by manual workflow dispatch. This builds the minified library, tags the commit based on the version in `package.json`, creates a GitHub release, uploads release assets, and publishes the build output to NPM.

The changelog should be updated on every PR - there is a placeholder at the top of the document - and heading should be renamed to the same version which is going to be set in the version tag during release.

The workflow expects `${{ secrets.NPM_ORG_TOKEN }}` organization secret in order to push to NPM registry.
