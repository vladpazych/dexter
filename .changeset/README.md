# Changesets

This repo uses Changesets for versioning, changelog updates, npm publishing, and GitHub Releases.

## Local flow

```sh
npm run changeset:add
npm run changeset:status
```

When a PR with a changeset lands on `main`, the release workflow creates or updates a `Version packages` PR.
Merging that PR publishes packages, updates changelogs, tags the release, and creates the GitHub Release.

## Writing a good changeset

- Write for users, not maintainers.
- Describe the externally visible change.
- Keep the summary short and concrete.
- Choose the smallest correct semver bump.
- Do not mention internal refactors unless they change package behavior.

Examples:

- `Add process.run() for neutral child-process execution.`
- `Fix files.collect() ordering when walking ancestors.`
- `Remove logs and replace pipe with process.`
