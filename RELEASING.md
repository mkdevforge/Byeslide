# Releasing Byeslide

Byeslide publishes to npm from GitHub Actions.

## npm Setup

Use npm trusted publishing. Do not create an npm automation token for this
workflow.

1. Open the `byeslide` package settings on npm.
2. Add a trusted publisher for GitHub Actions.
3. Use organization/user `mkdevforge`, repository `Byeslide`, and workflow file `publish-npm.yml`.
4. Leave the environment name blank unless the workflow is later moved behind a GitHub deployment environment.

The workflow has `id-token: write`, uses GitHub-hosted runners, and runs
`npm publish` without `NODE_AUTH_TOKEN`, so npm authenticates the publish with
OIDC. Trusted publishing also publishes provenance automatically for public
packages from public repositories.

## Publish

1. Update `package.json` to the version you want to publish.
2. Commit the version change.
3. Create a GitHub release whose tag matches the package version, for example `v0.1.0`.

The `Publish to npm` workflow runs tests, builds the starter template, checks
package contents with `npm pack --dry-run`, then runs `npm publish --access public`.
