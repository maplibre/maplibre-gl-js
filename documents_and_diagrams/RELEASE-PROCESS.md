## Publish to NPM

1. Review [`CHANGELOG.md`](../CHANGELOG.md)
   - Double-check that all changes included in the release are [appropriately documented](../CONTRIBUTING.md#changelog-conventions).
   - To-be-released changes should be under a placeholder header. Update that header to the version number which is about to be released. This project uses [semantic versioning](https://docs.npmjs.com/about-semantic-versioning).
   - Commit any final changes to the changelog.
2. Bump the version number with `npm version VERSIONTYPE --no-git-tag-version`
  - e.g. if making a backwards-compatible release with new features, run `npm version minor --no-git-tag-version`
  - [`npm version`](https://docs.npmjs.com/cli/commands/npm-version) will increment the version in `package.json` and `package-lock.json`.
3. Run [`release.yml`](https://github.com/maplibre/maplibre-gl-js/actions/workflows/release.yml) by manual workflow dispatch. This builds the minified library, tags the commit based on the version in `package.json`, creates a GitHub release, uploads release assets, and publishes the build output to NPM.

The workflow expects `${{ secrets.NPM_ORG_TOKEN }}` organization secret in order to push to NPM registry.
