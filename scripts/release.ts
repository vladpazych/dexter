import { fileURLToPath } from "node:url"

const VALID_BUMPS = new Set(["patch", "minor", "major"])
const PACKAGE_PATH = new URL("../packages/dexter/package.json", import.meta.url)
const ROOT_DIR = fileURLToPath(new URL("..", import.meta.url))

function fail(message: string): never {
  console.error(`error: ${message}`)
  process.exit(1)
}

function run(args: string[]): void {
  const result = Bun.spawnSync(args, {
    cwd: ROOT_DIR,
    stderr: "pipe",
  })

  if (result.exitCode === 0) {
    return
  }

  const stderr = result.stderr.toString().trim()
  fail(stderr.length > 0 ? stderr : `${args[0]} failed`)
}

const bump = process.argv[2]
if (bump === undefined || !VALID_BUMPS.has(bump)) {
  fail("usage: bun run scripts/release.ts <patch|minor|major>")
}

const pkg = JSON.parse(await Bun.file(PACKAGE_PATH).text()) as { version: string }
const [major, minor, patch] = pkg.version.split(".").map(Number)
if (major === undefined || minor === undefined || patch === undefined) {
  fail(`invalid version: ${pkg.version}`)
}

const nextVersion =
  bump === "major" ? `${major + 1}.0.0` : bump === "minor" ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`

pkg.version = nextVersion
await Bun.write(PACKAGE_PATH, JSON.stringify(pkg, null, 2) + "\n")

const packagePath = fileURLToPath(PACKAGE_PATH)
const tag = `v${nextVersion}`
run(["git", "add", packagePath])
run(["git", "commit", "-m", tag])
run(["git", "tag", tag])

console.log(`${major}.${minor}.${patch} -> ${nextVersion}`)
console.log(`Tagged ${tag}. Push with: git push && git push --tags`)
