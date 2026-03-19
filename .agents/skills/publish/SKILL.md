---
name: publish
description: "Publish Rig packages through the Changesets release flow. Validate, review the version PR, merge, and verify npm/GitHub release output. Triggers: /publish, publish, release, npm publish. NOT: code changes, test fixes."
---

# Publish

Release Rig packages through Changesets. Do not bypass the version PR or hand-roll version bumps.

## Steps

1. Run release preflight:
   - `git status --short`
   - `npm run release:check`
   - `npm run changeset:status`

   Stop if the worktree is dirty or validation fails.

2. Review pending package versions from Changesets. For this repo, expect the release line to come from the pending `.changeset/*.md` files, not from manual bump arguments.

3. Create the versioning commit locally:

   ```
   npm run version-packages
   ```

   This consumes pending changesets, updates package versions, and updates package changelogs.

4. Review the versioned diff. Focus on:
   - package versions
   - internal dependency ranges
   - package changelogs
   - lockfile changes

5. Show the user the version changes and the generated changelog summaries. Wait for approval before committing or pushing.

6. Commit the versioning changes with:

   ```
   git add .
   git commit -m "chore: version packages"
   ```

7. Push the branch. If this is `main`, the release workflow will publish automatically. If this is a feature branch, open or update the PR so the `chore: version packages` commit can land on `main`.

8. After the workflow runs on `main`, verify:
   - npm publish succeeded for the intended packages
   - the GitHub Release exists
   - tags match the published versions

9. Report the published package versions and link the user to the GitHub Release and workflow run.
