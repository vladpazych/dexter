# Rig

Rig is a small workspace for repo CLI tooling primitives. The published packages are `@vladpazych/rig` and `@vladpazych/rig-logger-sinks`; the rest of the repo exists to build, test, version, and release them cleanly for Node.

## Quick Start

- Read the package docs in [`packages/rig/README.md`](packages/rig/README.md)
- Inspect pending release intent with `npm run changeset:status`
- Run the full local validation loop with `npm run release:check`

## Packages

- [`@vladpazych/rig`](packages/rig/README.md): the published package with the stable `env`, `files`, `logger`, `process`, `terminal`, and `version` exports
- [`@vladpazych/rig-logger-sinks`](packages/rig-logger-sinks/README.md): standard Node sinks for Rig's runtime-agnostic `logger`

## Concepts

- The repo is an npm workspace and the supported release workflow runs on Node.
- `packages/rig` is the core package; `packages/rig-logger-sinks` is the companion sink package.
- Changesets owns versioning, changelog updates, npm publishing, and GitHub Releases.
- The root README explains the repository. The package README explains how to use Rig.

## Structure

- `packages/rig`: published package source
- `packages/rig-logger-sinks`: published companion sink package
- `packages/rig/CHANGELOG.md`: package release history
- `packages/rig-logger-sinks/CHANGELOG.md`: sink package release history
- `.changeset`: release intent and versioning metadata
- `.github/workflows`: CI and publish automation

## Development

```sh
npm install
npm run format:check
npm run lint
npm run typecheck
npm test
npm run pack:check
npm run changeset:add
npm run changeset:status
npm run release:check
```

## Release Flow

1. Add a changeset for package-facing changes with `npm run changeset:add`.
2. Merge the PR to `main`.
3. The release workflow opens or updates a `chore: version packages` PR.
4. Merge that PR to publish to npm, update the package changelog, tag the release, and create the GitHub Release.

## OSS

- [Security](SECURITY.md)
- [Rig changelog](packages/rig/CHANGELOG.md)
- [Logger sink changelog](packages/rig-logger-sinks/CHANGELOG.md)
- [License](LICENSE)
