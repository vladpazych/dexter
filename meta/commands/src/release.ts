/**
 * release — bump version, commit, and tag.
 */

import { DexterError, command } from "@vladpazych/dexter/cli"
import { z } from "zod"

const VALID_BUMPS = ["patch", "minor", "major"] as const

type ReleaseResult = {
  currentVersion: string
  nextVersion: string
  tag: string
}

const PACKAGE_DIRS = [
  "packages/dexter",
  "packages/dexter-bun",
  "packages/dexter-node",
] as const

function ensureSuccess(result: ReturnType<typeof Bun.spawnSync>, step: string): void {
  if (result.exitCode === 0) {
    return
  }

  const stderr = result.stderr?.toString().trim() ?? ""
  const message = stderr.length > 0 ? `${step} failed: ${stderr}` : `${step} failed`
  throw new DexterError("release-command-failed", message)
}

export const release = command()
  .description("Bump the package version, create a commit, and tag the release.")
  .args({
    name: "bump",
    description: "Version increment to apply.",
    schema: z.enum(VALID_BUMPS),
  })
  .run(async (input, ctx): Promise<ReleaseResult> => {
    const { bump } = input.args
    const pkgPaths = PACKAGE_DIRS.map((dir) => `${ctx.root}/${dir}/package.json`)
    const primaryPkgPath = pkgPaths[0]

    const pkg = JSON.parse(await Bun.file(primaryPkgPath).text()) as { version: string }
    const currentVersion = pkg.version
    const versionParts = currentVersion.split(".").map(Number)
    const major = versionParts[0]
    const minor = versionParts[1]
    const patch = versionParts[2]

    if (major === undefined || minor === undefined || patch === undefined) {
      throw new DexterError("invalid-version", `Invalid version in ${primaryPkgPath}: ${currentVersion}`)
    }

    let nextVersion = currentVersion
    switch (bump) {
      case "major":
        nextVersion = `${major + 1}.0.0`
        break
      case "minor":
        nextVersion = `${major}.${minor + 1}.0`
        break
      case "patch":
        nextVersion = `${major}.${minor}.${patch + 1}`
        break
    }

    for (const pkgPath of pkgPaths) {
      const currentPkg = JSON.parse(await Bun.file(pkgPath).text()) as { version: string }
      currentPkg.version = nextVersion
      await Bun.write(pkgPath, JSON.stringify(currentPkg, null, 2) + "\n")
    }

    const tag = `v${nextVersion}`
    ensureSuccess(Bun.spawnSync(["git", "add", ...pkgPaths], { cwd: ctx.root, stderr: "pipe" }), "git add")
    ensureSuccess(Bun.spawnSync(["git", "commit", "-m", tag], { cwd: ctx.root, stderr: "pipe" }), "git commit")
    ensureSuccess(Bun.spawnSync(["git", "tag", tag], { cwd: ctx.root, stderr: "pipe" }), "git tag")

    return { currentVersion, nextVersion, tag }
  })
  .renderCli((result) => {
    return `${result.currentVersion} -> ${result.nextVersion}\nTagged ${result.tag}. Push with: git push && git push --tags`
  })
  .build()
