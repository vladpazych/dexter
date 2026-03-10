import { afterEach, describe, expect, it, spyOn } from "bun:test"
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { pathToFileURL } from "node:url"

import { runDexter } from "../src/cli.ts"

const localMetaImport = pathToFileURL(join(import.meta.dir, "..", "..", "dexter", "src", "meta", "index.ts")).href

function createRepo(configSource?: string, configFilename = "dexter.config.ts"): string {
  const root = mkdtempSync(join(tmpdir(), "dexter-node-run-"))
  mkdirSync(join(root, "meta"), { recursive: true })
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "repo", type: "module" }))
  Bun.spawnSync(["git", "init", "-q"], { cwd: root })
  if (configSource !== undefined) {
    writeFileSync(join(root, configFilename), configSource)
  }
  return root
}

describe("runDexter (node runtime)", () => {
  const originalCwd = process.cwd()

  afterEach(() => {
    process.chdir(originalCwd)
  })

  it("loads a TypeScript repo config through jiti and runs a command", async () => {
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

  it("prints global help outside a git repo", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dexter-node-global-help-"))
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
})
