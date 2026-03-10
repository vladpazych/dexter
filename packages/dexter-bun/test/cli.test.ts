import { afterEach, describe, expect, it, spyOn } from "bun:test"
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { pathToFileURL } from "node:url"

import { runDexter } from "../src/cli.ts"

const localMetaImport = pathToFileURL(join(import.meta.dir, "..", "..", "dexter", "src", "meta", "index.ts")).href
const localErrorsImport = pathToFileURL(join(import.meta.dir, "..", "..", "dexter", "src", "meta", "errors.ts")).href

function createRepo(configSource?: string, configFilename = "dexter.config.ts"): string {
  const root = mkdtempSync(join(tmpdir(), "dexter-run-"))
  mkdirSync(join(root, "meta"), { recursive: true })
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "repo", type: "module" }))
  Bun.spawnSync(["git", "init", "-q"], { cwd: root })
  if (configSource !== undefined) {
    writeFileSync(join(root, configFilename), configSource)
  }
  return root
}

describe("runDexter (bun runtime)", () => {
  const originalCwd = process.cwd()

  afterEach(() => {
    process.chdir(originalCwd)
  })

  it("loads repo config from dexter.config.ts and runs a command", async () => {
    const root = createRepo(`
      import { command, defineConfig } from ${JSON.stringify(localMetaImport)}

      export default defineConfig({
        commands: {
          hello: command()
            .description("Print repo root.")
            .run((_input, ctx) => ({ root: ctx.root, target: "world" }))
            .build(),
        },
      })
    `)
    process.chdir(root)

    const log = spyOn(console, "log").mockImplementation(() => {})
    const exitCode = await runDexter(["hello"])

    expect(exitCode).toBe(0)
    const output = log.mock.calls.flat().join("\n")
    expect(output).toContain(realpathSync(root))
    expect(output).toContain('"target": "world"')
    log.mockRestore()
  })

  it("loads repo config from dexter.config.js", async () => {
    const root = createRepo(`
      import { command, defineConfig } from ${JSON.stringify(localMetaImport)}

      export default defineConfig({
        commands: {
          hello: command({
            description: "Print from js config.",
            run: () => "from-js",
          }),
        },
      })
    `, "dexter.config.js")
    process.chdir(root)

    const log = spyOn(console, "log").mockImplementation(() => {})
    const exitCode = await runDexter(["hello"])

    expect(exitCode).toBe(0)
    expect(log.mock.calls.flat().join("\n")).toContain("from-js")
    log.mockRestore()
  })

  it("prints global help outside a git repo", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dexter-global-help-"))
    process.chdir(dir)

    const log = spyOn(console, "log").mockImplementation(() => {})
    const exitCode = await runDexter(["help"])

    expect(exitCode).toBe(0)
    expect(log.mock.calls.flat().join("\n")).toContain("dexter.config.*")
    log.mockRestore()
  })

  it("fails when no supported root config exists", async () => {
    const root = createRepo()
    process.chdir(root)

    const error = spyOn(console, "error").mockImplementation(() => {})
    const exitCode = await runDexter(["hello"])

    expect(exitCode).toBe(1)
    expect(error.mock.calls.flat().join("\n")).toContain("no dexter config found in repo root")
    error.mockRestore()
  })

  it("loads only META_ variables implicitly before importing dexter config", async () => {
    const root = createRepo(`
      import { command, defineConfig } from ${JSON.stringify(localMetaImport)}

      const metaValue = process.env.META_REGION ?? "missing"
      const normalValue = process.env.COOLIFY_SECRET ?? "missing"

      export default defineConfig({
        commands: {
          inspect: command({
            description: metaValue,
            run: () => ({ metaValue, normalValue }),
          }),
        },
      })
    `)
    writeFileSync(join(root, ".env"), ["META_REGION=eu-west-1", "COOLIFY_SECRET=top-secret"].join("\n"))
    process.chdir(root)

    const previousMetaRegion = process.env.META_REGION
    const previousCoolifySecret = process.env.COOLIFY_SECRET
    delete process.env.META_REGION
    delete process.env.COOLIFY_SECRET

    const log = spyOn(console, "log").mockImplementation(() => {})
    const exitCode = await runDexter(["inspect"])

    const output = log.mock.calls.flat().join("\n")
    expect(exitCode).toBe(0)
    expect(output).toContain('"metaValue": "eu-west-1"')
    expect(output).toContain('"normalValue": "missing"')
    log.mockRestore()

    if (previousMetaRegion === undefined) {
      delete process.env.META_REGION
    } else {
      process.env.META_REGION = previousMetaRegion
    }

    if (previousCoolifySecret === undefined) {
      delete process.env.COOLIFY_SECRET
    } else {
      process.env.COOLIFY_SECRET = previousCoolifySecret
    }
  })

  it("prints DexterError messages and hints from repo commands", async () => {
    const root = createRepo(`
      import { command, defineConfig } from ${JSON.stringify(localMetaImport)}
      import { DexterError } from ${JSON.stringify(localErrorsImport)}

      export default defineConfig({
        commands: {
          explode: command({
            description: "Explode with hints.",
            run: () => {
              throw new DexterError("bad", "boom", ["try again", "or don\\'t"])
            },
          }),
        },
      })
    `)
    process.chdir(root)

    const error = spyOn(console, "error").mockImplementation(() => {})
    const exitCode = await runDexter(["explode"])

    expect(exitCode).toBe(1)
    const output = error.mock.calls.flat().join("\n")
    expect(output).toContain("error: boom")
    expect(output).toContain("hint: try again")
    expect(output).toContain("hint: or don't")
    error.mockRestore()
  })
})
