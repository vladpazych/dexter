import { afterEach, describe, expect, it, spyOn } from "bun:test"
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { pathToFileURL } from "node:url"

import { runDexter } from "../src/cli.ts"

const localMetaImport = pathToFileURL(join(import.meta.dir, "..", "src", "meta", "index.ts")).href
const localErrorsImport = pathToFileURL(join(import.meta.dir, "..", "src", "meta", "errors.ts")).href
const workspaceRoot = join(import.meta.dir, "..", "..", "..")
const localZodImport = pathToFileURL(join(import.meta.dir, "..", "node_modules", "zod", "index.js")).href

function createRepo(configSource?: string, configFilename = "dexter.config.ts"): string {
  const root = mkdtempSync(join(tmpdir(), "dexter-run-"))
  mkdirSync(join(root, "meta"), { recursive: true })
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "repo", type: "module" }))
  if (configSource !== undefined) {
    writeFileSync(join(root, configFilename), configSource)
  }
  Bun.spawnSync(["git", "init", "-q"], { cwd: root })
  return root
}

describe("runDexter", () => {
  const originalCwd = process.cwd()

  afterEach(() => {
    process.chdir(originalCwd)
  })

  it("loads repo config from dexter.config.ts and runs a command", async () => {
    const root = createRepo(`
      import { command, defineConfig } from ${JSON.stringify(localMetaImport)}
      import { z } from ${JSON.stringify(localZodImport)}

      export default defineConfig({
        commands: {
          hello: command({
            description: "Print repo root.",
            args: [{ name: "target", description: "Name.", schema: z.string() }] as const,
            run: (input, ctx) => {
              return { root: ctx.root, target: input.args.target }
            },
          }),
        },
      })
    `)
    process.chdir(root)

    const log = spyOn(console, "log").mockImplementation(() => {})
    const exitCode = await runDexter(["hello", "world"])

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

  it("loads repo config from dexter.config.mts", async () => {
    const root = createRepo(`
      import { command, defineConfig } from ${JSON.stringify(localMetaImport)}

      export default defineConfig({
        commands: {
          hello: command({
            description: "Print from mts config.",
            run: () => "from-mts",
          }),
        },
      })
    `, "dexter.config.mts")
    process.chdir(root)

    const log = spyOn(console, "log").mockImplementation(() => {})
    const exitCode = await runDexter(["hello"])

    expect(exitCode).toBe(0)
    expect(log.mock.calls.flat().join("\n")).toContain("from-mts")
    log.mockRestore()
  })

  it("loads repo config from dexter.config.mjs", async () => {
    const root = createRepo(`
      import { command, defineConfig } from ${JSON.stringify(localMetaImport)}

      export default defineConfig({
        commands: {
          hello: command({
            description: "Print from mjs config.",
            run: () => "from-mjs",
          }),
        },
      })
    `, "dexter.config.mjs")
    process.chdir(root)

    const log = spyOn(console, "log").mockImplementation(() => {})
    const exitCode = await runDexter(["hello"])

    expect(exitCode).toBe(0)
    expect(log.mock.calls.flat().join("\n")).toContain("from-mjs")
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
    writeFileSync(join(root, "meta", "index.ts"), "export default {}")
    process.chdir(root)

    const error = spyOn(console, "error").mockImplementation(() => {})
    const exitCode = await runDexter(["hello"])

    expect(exitCode).toBe(1)
    expect(error.mock.calls.flat().join("\n")).toContain("no dexter config found in repo root")
    error.mockRestore()
  })

  it("fails when dexter config does not default-export a config object", async () => {
    const root = createRepo(`export default 42`)
    process.chdir(root)

    const error = spyOn(console, "error").mockImplementation(() => {})
    const exitCode = await runDexter(["hello"])

    expect(exitCode).toBe(1)
    expect(error.mock.calls.flat().join("\n")).toContain("must default-export a dexter config")
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

  it("returns a failing exit code for unknown repo commands", async () => {
    const root = createRepo(`
      import { command, defineConfig } from ${JSON.stringify(localMetaImport)}

      export default defineConfig({
        commands: {
          known: command({
            description: "Known command.",
            run: () => undefined,
          }),
        },
      })
    `)
    process.chdir(root)

    const error = spyOn(console, "error").mockImplementation(() => {})
    const exitCode = await runDexter(["unknown"])

    expect(exitCode).toBe(1)
    expect(error.mock.calls.flat().join("\n")).toContain("Unknown command: unknown")
    error.mockRestore()
  })

  it("prints DexterError messages and hints from repo commands", async () => {
    const root = createRepo(`
      import { command, defineConfig } from ${JSON.stringify(localMetaImport)}
      import { DexterError } from ${JSON.stringify(localErrorsImport)}

      export default defineConfig({
        commands: {
          fail: command({
            description: "Fail.",
            run: () => {
              throw new DexterError("bad", "boom", ["do the thing"])
            },
          }),
        },
      })
    `)
    process.chdir(root)

    const error = spyOn(console, "error").mockImplementation(() => {})
    const exitCode = await runDexter(["fail"])

    expect(exitCode).toBe(1)
    const output = error.mock.calls.flat().join("\n")
    expect(output).toContain("error: boom")
    expect(output).toContain("hint: do the thing")
    error.mockRestore()
  })

  it("prints normal errors from repo commands", async () => {
    const root = createRepo(`
      import { command, defineConfig } from ${JSON.stringify(localMetaImport)}

      export default defineConfig({
        commands: {
          fail: command({
            description: "Fail.",
            run: () => {
              throw new Error("plain failure")
            },
          }),
        },
      })
    `)
    process.chdir(root)

    const error = spyOn(console, "error").mockImplementation(() => {})
    const exitCode = await runDexter(["fail"])

    expect(exitCode).toBe(1)
    expect(error.mock.calls.flat().join("\n")).toContain("plain failure")
    error.mockRestore()
  })

  it("passes json output mode through the full runtime path", async () => {
    const root = createRepo(`
      import { command, defineConfig } from ${JSON.stringify(localMetaImport)}

      export default defineConfig({
        commands: {
          inspect: command({
            description: "Inspect mode.",
            run: (_input, ctx) => ({ mode: ctx.mode }),
          }),
        },
      })
    `)
    process.chdir(root)

    const log = spyOn(console, "log").mockImplementation(() => {})
    const exitCode = await runDexter(["inspect", "--json"])

    expect(exitCode).toBe(0)
    expect(log.mock.calls.flat().join("\n")).toContain('"mode": "json"')
    log.mockRestore()
  })

  it("prints command-specific help from repo config", async () => {
    const root = createRepo(`
      import { command, defineConfig } from ${JSON.stringify(localMetaImport)}
      import { z } from ${JSON.stringify(localZodImport)}

      export default defineConfig({
        commands: {
          release: command({
            description: "Create a release.",
            args: [{ name: "bump", description: "Version bump.", schema: z.enum(["patch", "minor", "major"]) }] as const,
            options: {
              signoff: {
                description: "Require signoff.",
                schema: z.boolean().optional(),
              },
            },
            run: () => undefined,
          }),
        },
      })
    `)
    process.chdir(root)

    const log = spyOn(console, "log").mockImplementation(() => {})
    const exitCode = await runDexter(["release", "--help"])

    expect(exitCode).toBe(0)
    const output = log.mock.calls.flat().join("\n")
    expect(output).toContain("Usage: dexter release [options] <bump>")
    expect(output).toContain("--signoff (optional)  Require signoff.")
    log.mockRestore()
  })

  it("runs nested repo commands from dexter.config.ts", async () => {
    const root = createRepo(`
      import { command, defineConfig } from ${JSON.stringify(localMetaImport)}
      import { z } from ${JSON.stringify(localZodImport)}

      export default defineConfig({
        commands: {
          db: {
            description: "Database utilities.",
            commands: {
              migrate: command({
                description: "Run migrations.",
                args: [{ name: "target", description: "Migration target.", schema: z.string() }] as const,
                run: (input, ctx) => ({ root: ctx.root, target: input.args.target }),
              }),
            },
          },
        },
      })
    `)
    process.chdir(root)

    const log = spyOn(console, "log").mockImplementation(() => {})
    const exitCode = await runDexter(["db", "migrate", "latest"])

    expect(exitCode).toBe(0)
    const output = log.mock.calls.flat().join("\n")
    expect(output).toContain(realpathSync(root))
    expect(output).toContain('"target": "latest"')
    log.mockRestore()
  })

  it("prints namespace help from repo config", async () => {
    const root = createRepo(`
      import { command, defineConfig } from ${JSON.stringify(localMetaImport)}

      export default defineConfig({
        commands: {
          db: {
            description: "Database utilities.",
            commands: {
              migrate: command({
                description: "Run migrations.",
                run: () => undefined,
              }),
            },
          },
        },
      })
    `)
    process.chdir(root)

    const log = spyOn(console, "log").mockImplementation(() => {})
    const exitCode = await runDexter(["help", "db"])

    expect(exitCode).toBe(0)
    const output = log.mock.calls.flat().join("\n")
    expect(output).toContain("Usage: dexter db <command>")
    expect(output).toContain("migrate  Run migrations.")
    log.mockRestore()
  })

  it("returns a failing exit code for unknown nested repo commands", async () => {
    const root = createRepo(`
      import { command, defineConfig } from ${JSON.stringify(localMetaImport)}

      export default defineConfig({
        commands: {
          db: {
            description: "Database utilities.",
            commands: {
              migrate: command({
                description: "Run migrations.",
                run: () => undefined,
              }),
            },
          },
        },
      })
    `)
    process.chdir(root)

    const error = spyOn(console, "error").mockImplementation(() => {})
    const exitCode = await runDexter(["db", "prune"])

    expect(exitCode).toBe(1)
    expect(error.mock.calls.flat().join("\n")).toContain("Unknown command: db prune")
    error.mockRestore()
  })

  it("runs through the installed workspace binary", () => {
    const result = Bun.spawnSync([join(workspaceRoot, "node_modules", ".bin", "dexter"), "version"], {
      cwd: workspaceRoot,
      stdout: "pipe",
      stderr: "pipe",
    })

    expect(result.success).toBe(true)
    expect(result.stdout.toString().trim()).toBe("0.1.13")
  })

  it("dispatches repo commands through the installed workspace binary", () => {
    const root = createRepo(`
      import { command, defineConfig } from ${JSON.stringify(localMetaImport)}

      export default defineConfig({
        commands: {
          hello: command({
            description: "Print from binary.",
            run: () => "from-binary",
          }),
        },
      })
    `)

    const result = Bun.spawnSync([join(workspaceRoot, "node_modules", ".bin", "dexter"), "hello"], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
    })

    expect(result.success).toBe(true)
    expect(result.stdout.toString().trim()).toBe("from-binary")
  })
})
