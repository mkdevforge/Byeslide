# Releasing Byeslide

Byeslide publishes to npm from GitHub Actions.

## npm Setup

Preferred path after the first publish:

1. Open the `byeslide` package settings on npm.
2. Add a trusted publisher for GitHub Actions.
3. Use organization/user `mkdevforge`, repository `Byeslide`, and workflow file `publish-npm.yml`.

For the first publish, if npm does not let you configure trusted publishing before the package exists, create an npm automation token with publish access and add it to the GitHub repository as `NPM_TOKEN`.

## Publish

1. Update `package.json` to the version you want to publish.
2. Commit the version change.
3. Create a GitHub release whose tag matches the package version, for example `v0.1.0`.

The `Publish to npm` workflow runs tests, builds the starter template, checks package contents with `npm pack --dry-run`, then runs `npm publish --access public`.
