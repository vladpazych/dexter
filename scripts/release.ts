import { fileURLToPath } from "node:url"

type Bump = "patch" | "minor" | "major"
type Version = {
  major: number
  minor: number
  patch: number
}

const PACKAGE_PATH = new URL("../package.json", import.meta.url)
const ROOT_DIR = fileURLToPath(new URL("..", import.meta.url))

function fail(message: string): never {
  console.error(`error: ${message}`)
  process.exit(1)
}

function runGit(args: string[]): string {
  const result = Bun.spawnSync(args, {
    cwd: ROOT_DIR,
    stdout: "pipe",
    stderr: "pipe",
  })

  const stdout = result.stdout.toString().trim()
  const stderr = result.stderr.toString().trim()

  if (result.exitCode !== 0) {
    fail(stderr.length > 0 ? stderr : `${args[0]} failed`)
  }

  return stdout
}

function maybeRunGit(args: string[]): {
  exitCode: number
  stdout: string
  stderr: string
} {
  const result = Bun.spawnSync(args, {
    cwd: ROOT_DIR,
    stdout: "pipe",
    stderr: "pipe",
  })

  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString().trim(),
    stderr: result.stderr.toString().trim(),
  }
}

function isBump(value: string): value is Bump {
  return value === "patch" || value === "minor" || value === "major"
}

function parseVersion(value: string): Version | null {
  const parts = value.split(".")
  if (parts.length !== 3) {
    return null
  }

  const [majorText, minorText, patchText] = parts
  if (
    majorText === undefined ||
    minorText === undefined ||
    patchText === undefined ||
    !/^\d+$/.test(majorText) ||
    !/^\d+$/.test(minorText) ||
    !/^\d+$/.test(patchText)
  ) {
    return null
  }

  return {
    major: Number(majorText),
    minor: Number(minorText),
    patch: Number(patchText),
  }
}

function formatVersion(version: Version): string {
  return `${version.major}.${version.minor}.${version.patch}`
}

function parseTagVersion(tag: string): string | null {
  if (!tag.startsWith("v")) {
    return null
  }

  const version = tag.slice(1)
  return parseVersion(version) === null ? null : version
}

export function bumpVersion(version: string, bump: Bump): string {
  const parsed = parseVersion(version)
  if (parsed === null) {
    throw new Error(`invalid version: ${version}`)
  }

  const nextVersion: Version =
    bump === "major"
      ? { major: parsed.major + 1, minor: 0, patch: 0 }
      : bump === "minor"
        ? { major: parsed.major, minor: parsed.minor + 1, patch: 0 }
        : {
            major: parsed.major,
            minor: parsed.minor,
            patch: parsed.patch + 1,
          }

  return formatVersion(nextVersion)
}

export function resolveReleaseBaseVersion(
  packageVersion: string,
  latestTag: string | null,
): string {
  if (parseVersion(packageVersion) === null) {
    throw new Error(`invalid version: ${packageVersion}`)
  }

  if (latestTag === null) {
    return packageVersion
  }

  const taggedVersion = parseTagVersion(latestTag)
  if (taggedVersion === null) {
    throw new Error(`invalid latest tag: ${latestTag}`)
  }

  if (packageVersion !== taggedVersion) {
    throw new Error(
      `package.json version ${packageVersion} does not match latest tag ${latestTag}`,
    )
  }

  return taggedVersion
}

function ensureCleanWorktree(): void {
  const status = runGit(["git", "status", "--short"])
  if (status.length > 0) {
    fail("worktree must be clean before bumping")
  }
}

function getLatestTag(): string | null {
  const result = maybeRunGit(["git", "describe", "--tags", "--abbrev=0"])
  if (result.exitCode === 0) {
    return result.stdout.length > 0 ? result.stdout : null
  }

  if (result.stderr.includes("No names found")) {
    return null
  }

  fail(result.stderr.length > 0 ? result.stderr : "git describe failed")
}

function parsePackageJson(input: unknown): {
  version: string
} {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    fail("package.json must be an object")
  }

  const packageJson = input as Record<string, unknown>
  const version = packageJson.version
  if (typeof version !== "string") {
    fail("package.json version must be a string")
  }

  return { version }
}

async function main(): Promise<void> {
  const bump = process.argv[2]
  if (bump === undefined || !isBump(bump)) {
    fail("usage: bun run scripts/release.ts <patch|minor|major>")
  }

  ensureCleanWorktree()

  const rawPackage = JSON.parse(await Bun.file(PACKAGE_PATH).text()) as unknown
  const pkg = parsePackageJson(rawPackage)
  const latestTag = getLatestTag()

  let baseVersion: string
  try {
    baseVersion = resolveReleaseBaseVersion(pkg.version, latestTag)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "failed to resolve release version"
    fail(message)
  }

  const nextVersion = bumpVersion(baseVersion, bump)
  const nextPackage = {
    ...(rawPackage as Record<string, unknown>),
    version: nextVersion,
  }

  await Bun.write(PACKAGE_PATH, JSON.stringify(nextPackage, null, 2) + "\n")

  const packagePath = fileURLToPath(PACKAGE_PATH)
  const tag = `v${nextVersion}`
  runGit(["git", "add", packagePath])
  runGit(["git", "commit", "-m", tag])
  runGit(["git", "tag", tag])

  console.log(`${baseVersion} -> ${nextVersion}`)
  console.log(`Tagged ${tag}. Push with: git push && git push --tags`)
}

if (import.meta.main) {
  await main()
}
