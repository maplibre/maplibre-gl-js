## Publish to NPM

1. Use [semantic version rules](https://classic.yarnpkg.com/en/docs/dependency-versions#toc-semantic-versioning) to define a version in `package.json`.
2. Update `CHANGELOG.md`.
3. Run `release.yml` by manual workflow dispatch. This builds the minified library, tags the commit based on the version in `package.json`, creates a GitHub release, uploads release assets, and publishes the build output to NPM.

The changelog should be updated on every PR - there is a placeholder at the top of the document - and heading should be renamed to the same version which is going to be set in the version tag during release.

The workflow expects `${{ secrets.NPM_ORG_TOKEN }}` organization secret in order to push to NPM registry.
