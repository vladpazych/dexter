/**
 * release — bump version, commit, tag, push.
 *
 * Usage: bun run meta/index.ts release patch|minor|major
 */

import type { HookContext } from "@vladpazych/dexter/meta"

const VALID_BUMPS = ["patch", "minor", "major"] as const

export async function release(args: string[], ctx: HookContext): Promise<void> {
  const bump = args[0]

  if (!bump || !VALID_BUMPS.includes(bump as (typeof VALID_BUMPS)[number])) {
    console.error(`Usage: release <${VALID_BUMPS.join("|")}>`)
    process.exit(1)
  }

  const pkgDir = `${ctx.root}/packages/dexter`
  const pkgPath = `${pkgDir}/package.json`

  // Read current version
  const pkg = JSON.parse(await Bun.file(pkgPath).text())
  const currentVersion: string = pkg.version
  const [major, minor, patch] = currentVersion.split(".").map(Number)

  // Bump
  let nextVersion: string = currentVersion
  switch (bump) {
    case "major":
      nextVersion = `${major! + 1}.0.0`
      break
    case "minor":
      nextVersion = `${major}.${minor! + 1}.0`
      break
    case "patch":
      nextVersion = `${major}.${minor}.${patch! + 1}`
      break
  }

  // Write updated package.json
  pkg.version = nextVersion
  await Bun.write(pkgPath, JSON.stringify(pkg, null, 2) + "\n")

  // Update plugin.json
  const pluginPath = `${pkgDir}/.claude-plugin/plugin.json`
  const plugin = JSON.parse(await Bun.file(pluginPath).text())
  plugin.version = nextVersion
  await Bun.write(pluginPath, JSON.stringify(plugin, null, 2) + "\n")

  // Commit + tag
  const tag = `v${nextVersion}`
  const commitResult = Bun.spawnSync(["git", "add", pkgPath, pluginPath], { cwd: ctx.root })
  if (commitResult.exitCode !== 0) {
    console.error("git add failed")
    process.exit(1)
  }

  const commitMsg = Bun.spawnSync(["git", "commit", "-m", tag], { cwd: ctx.root })
  if (commitMsg.exitCode !== 0) {
    console.error("git commit failed")
    process.exit(1)
  }

  const tagResult = Bun.spawnSync(["git", "tag", tag], { cwd: ctx.root })
  if (tagResult.exitCode !== 0) {
    console.error("git tag failed")
    process.exit(1)
  }

  console.log(`${currentVersion} → ${nextVersion}`)
  console.log(`Tagged ${tag}. Push with: git push && git push --tags`)
}
