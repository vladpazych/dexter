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

function ensureSuccess(result: ReturnType<typeof Bun.spawnSync>, step: string): void {
  if (result.exitCode === 0) {
    return
  }

  const stderr = result.stderr?.toString().trim() ?? ""
  const message = stderr.length > 0 ? `${step} failed: ${stderr}` : `${step} failed`
  throw new DexterError("release-command-failed", message)
}

export const release = command({
  description: "Bump the package version, create a commit, and tag the release.",
  args: [
    {
      name: "bump",
      description: "Version increment to apply.",
      schema: z.enum(VALID_BUMPS),
    },
  ] as const,
  async run(input, ctx): Promise<ReleaseResult> {
    const { bump } = input.args
    const pkgDir = `${ctx.root}/packages/dexter`
    const pkgPath = `${pkgDir}/package.json`

    const pkg = JSON.parse(await Bun.file(pkgPath).text()) as { version: string }
    const currentVersion = pkg.version
    const versionParts = currentVersion.split(".").map(Number)
    const major = versionParts[0]
    const minor = versionParts[1]
    const patch = versionParts[2]

    if (major === undefined || minor === undefined || patch === undefined) {
      throw new DexterError("invalid-version", `Invalid version in ${pkgPath}: ${currentVersion}`)
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

    pkg.version = nextVersion
    await Bun.write(pkgPath, JSON.stringify(pkg, null, 2) + "\n")

    const tag = `v${nextVersion}`
    ensureSuccess(Bun.spawnSync(["git", "add", pkgPath], { cwd: ctx.root, stderr: "pipe" }), "git add")
    ensureSuccess(Bun.spawnSync(["git", "commit", "-m", tag], { cwd: ctx.root, stderr: "pipe" }), "git commit")
    ensureSuccess(Bun.spawnSync(["git", "tag", tag], { cwd: ctx.root, stderr: "pipe" }), "git tag")

    return { currentVersion, nextVersion, tag }
  },
  renderCli(result) {
    return `${result.currentVersion} -> ${result.nextVersion}\nTagged ${result.tag}. Push with: git push && git push --tags`
  },
})
