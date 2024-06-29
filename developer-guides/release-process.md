# Publish to npm

1. Review [`CHANGELOG.md`](../CHANGELOG.md)
   - Double-check that all changes included in the release are [appropriately documented](../CONTRIBUTING.md#changelog-conventions).
   - To-be-released changes should be under the "main" header.
   - Commit any final changes to the changelog.
2. Run [Create bump version PR](https://github.com/maplibre/maplibre-gl-js/actions/workflows/create-bump-version-pr.yml) by manual workflow dispatch and set the version number in the input. This will create a PR that changes the changelog and `package.json` file to review and merge.
3. Once merged, an automatic process will kick in and creates a GitHub release, uploads release assets, and publishes the build output to npm.

The workflow expects `${{ secrets.NPM_ORG_TOKEN }}` organization secret in order to push to npm registry.
