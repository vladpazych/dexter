---
name: publish
description: "Publish @vladpazych/dexter to npm. Bump version, write release notes, push, create GitHub Release. Triggers: /publish, publish, release, npm publish. NOT: code changes, test fixes."
argument-hint: "<patch|minor|major>"
---

# Publish

Release @vladpazych/dexter: bump version, curate release notes, push to trigger npm publish, create GitHub Release.

## Steps

1. Read the bump level from `$ARGUMENTS`. Validate it is `patch`, `minor`, or `major`. If missing, ask.

2. Run release preflight:

   - `git status --short`
   - `git describe --tags --abbrev=0`
   - read `package.json` version

   Stop if the worktree is dirty. Stop if `package.json` version does not match the latest tag. The latest tag is the release baseline.

3. Get commits since last tag:

   ```
   git log $(git describe --tags --abbrev=0)..HEAD --oneline
   ```

4. Write release notes. Group changes by theme, not by commit. Use this format:

   ```
   ## What's new

   - **Feature name** — one-line description
   - **Fix name** — one-line description

   ## Internal

   - CI/tooling/refactor changes (if any)
   ```

   Omit sections with no entries. Omit version bump commits. Keep it concise — 3-10 bullet points.

5. Show the user the latest tag, current package version, next version, and release notes. Wait for approval before proceeding.

6. Run `bun run scripts/release.ts <level>` to bump version, commit, and tag. The script re-checks that the worktree is clean and that `package.json` matches the latest tag before bumping.

7. Push: `git push && git push --tags`. This triggers the npm publish workflow.

8. Create GitHub Release using the curated notes:

   ```
   gh release create v<version> --title "v<version>" --notes "<release notes>"
   ```

9. Report: link to the GitHub Release and the npm publish workflow run.
