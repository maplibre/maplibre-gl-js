## Publish to NPM

To publish this library to NPM, create a tag and push it to GitHub. Make sure that the version in ```package.json``` matches the version you define in the tag. A workflow will do all the necessary steps:

```bash
git checkout main
git tag -a v1.14.1 -m "version 1.14.1"
git push origin v1.14.1
```

Do not use `git push --tags` as it can accidentally push tags from other repositories.

## Workflow Description

The logic is split in two jobs
* First jobs perform tests. It runs on Windows runner since Linux runners don't have GPU, which is required by many tests.
* Second job runs on Linux and creates builds minified library, creates github release, uploads release assets,
  updates version in npm package and submits package in the npm registry.

Pushing a tag triggers the publishing workflow, but it can also be triggered manually.
The workflow searches for the most recent version tag matching [semantic version rules](https://classic.yarnpkg.com/en/docs/dependency-versions#toc-semantic-versioning),
and must be prefixed with a `v`

There can be release versions such as `v1.14.0`, and release candidates, e.g. `v1.14.0-rc.1`.

In case of release version the action parses `CHANGELOG.md` and creates release notes based on current and last version.
Release candidate versions do not generate release notes.

The changelog should be updated on every PR - there is a placeholder at the top of the document - and heading should be renamed to the same version which is going to be set in the version tag during release.

The workflow expects `${{ secrets.NPM_ORG_TOKEN }}` organization secret in order to push to NPM registry.
