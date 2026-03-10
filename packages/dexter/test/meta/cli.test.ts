import { afterEach, describe, expect, it, spyOn } from "bun:test"
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { z } from "zod"

import { DexterError } from "../../src/meta/errors.ts"
import { command, createCLI } from "../../src/meta/index.ts"

function createGitRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "dexter-cli-"))
  mkdirSync(join(root, "meta"), { recursive: true })
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "repo" }))
  Bun.spawnSync(["git", "init", "-q"], { cwd: root })
  return root
}

describe("createCLI", () => {
  const originalCwd = process.cwd()

  afterEach(() => {
    process.chdir(originalCwd)
  })

  it("runs typed commands with repo context and parsed input", async () => {
    const root = createGitRepo()
    process.chdir(root)

    let seenRoot = ""
    let seenMode = ""
    let seenInput: unknown

    const cli = createCLI({
      description: "custom meta",
      commands: {
        inspect: command()
          .description("Inspect parsed inputs.")
          .args({
            name: "target",
            description: "Target value.",
            schema: z.string(),
          })
          .options({
            verbose: {
              description: "Enable verbose output.",
              schema: z.boolean().optional(),
            },
            retries: {
              description: "Retry count.",
              schema: z.coerce.number().default(0),
            },
          })
          .run((input, ctx) => {
            seenRoot = ctx.root
            seenMode = ctx.mode
            seenInput = input
            return "ok"
          })
          .build(),
      },
    })

    const log = spyOn(console, "log").mockImplementation(() => {})
    const exitCode = await cli.run(["inspect", "--json", "--verbose", "--retries=2", "alpha"])

    expect(exitCode).toBe(0)
    expect(seenRoot).toBe(realpathSync(root))
    expect(seenMode).toBe("json")
    expect(seenInput).toEqual({
      args: { target: "alpha" },
      options: { verbose: true, retries: 2 },
    })
    expect(log.mock.calls.flat().join("\n")).toContain('"ok"')
    log.mockRestore()
  })

  it("prints global help with command descriptions", async () => {
    const log = spyOn(console, "log").mockImplementation(() => {})

    const cli = createCLI({
      description: "custom meta",
      commands: {
        build: command({
          description: "Build the project.",
          run: () => undefined,
        }),
        db: {
          description: "Database utilities.",
          commands: {
            check: command({
              description: "Run checks.",
              run: () => undefined,
            }),
          },
        },
      },
    })

    const exitCode = await cli.run(["help"])

    const output = log.mock.calls.flat().join("\n")
    expect(output).toContain("custom meta")
    expect(output).toContain("build  Build the project.")
    expect(output).toContain("db  Database utilities.")
    expect(output).not.toContain("check  Run checks.")
    expect(exitCode).toBe(0)
    log.mockRestore()
  })

  it("prints namespace help through both help entrypoints", async () => {
    const log = spyOn(console, "log").mockImplementation(() => {})
    const cli = createCLI({
      commands: {
        db: {
          description: "Database utilities.",
          commands: {
            migrate: command({
              description: "Run migrations.",
              run: () => undefined,
            }),
            seed: command({
              description: "Seed the database.",
              run: () => undefined,
            }),
          },
        },
      },
    })

    const helpExitCode = await cli.run(["help", "db"])
    const namespaceExitCode = await cli.run(["db", "--help"])

    const output = log.mock.calls.flat().join("\n")
    expect(helpExitCode).toBe(0)
    expect(namespaceExitCode).toBe(0)
    expect(output).toContain("Database utilities.")
    expect(output).toContain("Usage: dexter db <command>")
    expect(output).toContain("migrate  Run migrations.")
    expect(output).toContain("seed  Seed the database.")
    log.mockRestore()
  })

  it("prints command-specific help", async () => {
    const root = createGitRepo()
    process.chdir(root)

    const log = spyOn(console, "log").mockImplementation(() => {})
    const cli = createCLI({
      commands: {
        release: command()
          .description("Create a release.")
          .args({
            name: "bump",
            description: "Version bump.",
            schema: z.enum(["patch", "minor", "major"]),
          })
          .options({
            signoff: {
              description: "Require signoff.",
              schema: z.boolean().optional(),
            },
          })
          .run(() => undefined)
          .build(),
      },
    })

    const exitCode = await cli.run(["release", "--help"])

    const output = log.mock.calls.flat().join("\n")
    expect(output).toContain("Usage: dexter release [options] <bump>")
    expect(output).toContain("bump  Version bump.")
    expect(output).toContain("--signoff (optional)  Require signoff.")
    expect(exitCode).toBe(0)
    log.mockRestore()
  })

  it("prints nested command help through the help command", async () => {
    const root = createGitRepo()
    process.chdir(root)

    const log = spyOn(console, "log").mockImplementation(() => {})
    const cli = createCLI({
      commands: {
        db: {
          description: "Database utilities.",
          commands: {
            migrate: command()
              .description("Run migrations.")
              .args({
                name: "target",
                description: "Migration target.",
                schema: z.string(),
              })
              .run(() => undefined)
              .build(),
          },
        },
      },
    })

    const exitCode = await cli.run(["help", "db", "migrate"])

    const output = log.mock.calls.flat().join("\n")
    expect(output).toContain("Usage: dexter db migrate <target>")
    expect(output).toContain("target  Migration target.")
    expect(exitCode).toBe(0)
    log.mockRestore()
  })

  it("rejects unknown options", async () => {
    const root = createGitRepo()
    process.chdir(root)

    const error = spyOn(console, "error").mockImplementation(() => {})
    const cli = createCLI({
      commands: {
        inspect: command({
          description: "Inspect parsed inputs.",
          run: () => undefined,
        }),
      },
    })

    const exitCode = await cli.run(["inspect", "--wat"])

    expect(exitCode).toBe(1)
    expect(error.mock.calls.flat().join("\n")).toContain("Unknown option: --wat")
    error.mockRestore()
  })

  it("rejects missing required positional arguments", async () => {
    const root = createGitRepo()
    process.chdir(root)

    const error = spyOn(console, "error").mockImplementation(() => {})
    const cli = createCLI({
      commands: {
        inspect: command()
          .description("Inspect parsed inputs.")
          .args({
            name: "target",
            description: "Target value.",
            schema: z.string(),
          })
          .run(() => undefined)
          .build(),
      },
    })

    const exitCode = await cli.run(["inspect"])

    expect(exitCode).toBe(1)
    expect(error.mock.calls.flat().join("\n")).toContain("Missing required argument: target")
    error.mockRestore()
  })

  it("rejects extra positional arguments", async () => {
    const root = createGitRepo()
    process.chdir(root)

    const error = spyOn(console, "error").mockImplementation(() => {})
    const cli = createCLI({
      commands: {
        inspect: command()
          .description("Inspect parsed inputs.")
          .args({
            name: "target",
            description: "Target value.",
            schema: z.string(),
          })
          .run(() => undefined)
          .build(),
      },
    })

    const exitCode = await cli.run(["inspect", "alpha", "beta"])

    expect(exitCode).toBe(1)
    expect(error.mock.calls.flat().join("\n")).toContain("Unexpected argument: beta")
    error.mockRestore()
  })

  it("rejects schema validation failures", async () => {
    const root = createGitRepo()
    process.chdir(root)

    const error = spyOn(console, "error").mockImplementation(() => {})
    const cli = createCLI({
      commands: {
        inspect: command({
          description: "Inspect parsed inputs.",
          options: {
            level: {
              description: "Strict level.",
              schema: z.enum(["low", "high"]),
            },
          },
          run: () => undefined,
        }),
      },
    })

    const exitCode = await cli.run(["inspect", "--level", "wrong"])

    expect(exitCode).toBe(1)
    expect(error.mock.calls.flat().join("\n")).toContain("Invalid value for option '--level'")
    error.mockRestore()
  })

  it("rejects missing required options", async () => {
    const root = createGitRepo()
    process.chdir(root)

    const error = spyOn(console, "error").mockImplementation(() => {})
    const cli = createCLI({
      commands: {
        inspect: command({
          description: "Inspect parsed inputs.",
          options: {
            level: {
              description: "Strict level.",
              schema: z.enum(["low", "high"]),
            },
          },
          run: () => undefined,
        }),
      },
    })

    const exitCode = await cli.run(["inspect"])

    expect(exitCode).toBe(1)
    expect(error.mock.calls.flat().join("\n")).toContain("Missing required option: --level")
    error.mockRestore()
  })

  it("rejects missing option values", async () => {
    const root = createGitRepo()
    process.chdir(root)

    const error = spyOn(console, "error").mockImplementation(() => {})
    const cli = createCLI({
      commands: {
        inspect: command({
          description: "Inspect parsed inputs.",
          options: {
            level: {
              description: "Strict level.",
              schema: z.enum(["low", "high"]),
            },
          },
          run: () => undefined,
        }),
      },
    })

    const exitCode = await cli.run(["inspect", "--level"])

    expect(exitCode).toBe(1)
    expect(error.mock.calls.flat().join("\n")).toContain("Missing value for option: --level")
    error.mockRestore()
  })

  it("supports boolean negation flags", async () => {
    const root = createGitRepo()
    process.chdir(root)

    let seenInput: unknown
    const log = spyOn(console, "log").mockImplementation(() => {})
    const cli = createCLI({
      commands: {
        inspect: command({
          description: "Inspect parsed inputs.",
          options: {
            verbose: {
              description: "Enable verbose output.",
              schema: z.boolean().default(true),
            },
          },
          run(input) {
            seenInput = input
            return "ok"
          },
        }),
      },
    })

    const exitCode = await cli.run(["inspect", "--no-verbose"])

    expect(exitCode).toBe(0)
    expect(seenInput).toEqual({ args: {}, options: { verbose: false } })
    log.mockRestore()
  })

  it("runs nested commands with parsed input", async () => {
    const root = createGitRepo()
    process.chdir(root)

    let seenInput: unknown
    const log = spyOn(console, "log").mockImplementation(() => {})
    const cli = createCLI({
      commands: {
        db: {
          description: "Database utilities.",
          commands: {
            migrate: command()
              .description("Run migrations.")
              .args({
                name: "target",
                description: "Migration target.",
                schema: z.string(),
              })
              .options({
                dryRun: {
                  description: "Preview without applying.",
                  schema: z.boolean().optional(),
                },
              })
              .run((input) => {
                seenInput = input
                return "ok"
              })
              .build(),
          },
        },
      },
    })

    const exitCode = await cli.run(["db", "migrate", "latest", "--dry-run"])

    expect(exitCode).toBe(0)
    expect(seenInput).toEqual({
      args: { target: "latest" },
      options: { dryRun: true },
    })
    log.mockRestore()
  })

  it("loads env through ctx.loadEnv and prints masked sources in CLI output", async () => {
    const root = createGitRepo()
    process.chdir(root)
    writeFileSync(
      join(root, ".env"),
      ["COOLIFY_URL=https://coolify.example", "COOLIFY_SECRET=env-secret"].join("\n"),
    )
    writeFileSync(join(root, ".env.local"), "COOLIFY_SECRET=local-secret\n")

    const previousUrl = process.env.COOLIFY_URL
    process.env.COOLIFY_URL = "https://process.example"

    const log = spyOn(console, "log").mockImplementation(() => {})
    const cli = createCLI({
      commands: {
        deploy: command({
          description: "Deploy the app.",
          run(_input, ctx) {
            const env = ctx.loadEnv("deploy", {
              coolifyUrl: {
                env: "COOLIFY_URL",
                type: "url",
                required: true,
              },
              coolifySecret: {
                env: "COOLIFY_SECRET",
                required: true,
                sensitive: true,
              },
            })

            return env.coolifyUrl
          },
        }),
      },
    })

    const exitCode = await cli.run(["deploy"])

    const output = log.mock.calls.flat().join("\n")
    expect(exitCode).toBe(0)
    expect(output).toContain("Environment:")
    expect(output).toContain("deploy")
    expect(output).toContain("COOLIFY_URL")
    expect(output).toContain("https://process.example")
    expect(output).toContain("[process]")
    expect(output).toContain("COOLIFY_SECRET")
    expect(output).toContain("••••")
    expect(output).toContain("[.env.local]")
    expect(output).not.toContain("local-secret")
    log.mockRestore()

    if (previousUrl === undefined) {
      delete process.env.COOLIFY_URL
    } else {
      process.env.COOLIFY_URL = previousUrl
    }
  })

  it("includes env load metadata in json output", async () => {
    const root = createGitRepo()
    process.chdir(root)
    writeFileSync(join(root, ".env.local"), "COOLIFY_SECRET=local-secret\n")

    const log = spyOn(console, "log").mockImplementation(() => {})
    const cli = createCLI({
      commands: {
        deploy: command({
          description: "Deploy the app.",
          run(_input, ctx) {
            ctx.loadEnv("deploy", {
              coolifySecret: {
                env: "COOLIFY_SECRET",
                required: true,
                sensitive: true,
              },
            })

            return { ok: true }
          },
        }),
      },
    })

    const exitCode = await cli.run(["deploy", "--json"])

    const output = log.mock.calls.flat().join("\n")
    const payload = JSON.parse(output) as {
      meta: {
        env: Array<{
          name: string
          fields: Array<{
            env: string
            source: string
            displayValue: string
          }>
        }>
      }
      result: {
        ok: boolean
      }
    }
    expect(exitCode).toBe(0)
    expect(payload.result.ok).toBe(true)
    expect(payload.meta.env[0]?.name).toBe("deploy")
    expect(payload.meta.env[0]?.fields[0]?.env).toBe("COOLIFY_SECRET")
    expect(payload.meta.env[0]?.fields[0]?.source).toBe(".env.local")
    expect(payload.meta.env[0]?.fields[0]?.displayValue).toBe("••••")
    expect(output).not.toContain("local-secret")
    log.mockRestore()
  })

  it("prints namespace help when invoking a namespace directly", async () => {
    const log = spyOn(console, "log").mockImplementation(() => {})
    const cli = createCLI({
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

    const exitCode = await cli.run(["db"])

    expect(exitCode).toBe(0)
    expect(log.mock.calls.flat().join("\n")).toContain("Usage: dexter db <command>")
    log.mockRestore()
  })

  it("returns a failing exit code for unknown nested commands", async () => {
    const error = spyOn(console, "error").mockImplementation(() => {})
    const cli = createCLI({
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

    const exitCode = await cli.run(["db", "prune"])

    expect(exitCode).toBe(1)
    expect(error.mock.calls.flat().join("\n")).toContain("Unknown command: db prune")
    error.mockRestore()
  })

  it("renders CLI output through renderCli", async () => {
    const root = createGitRepo()
    process.chdir(root)

    const log = spyOn(console, "log").mockImplementation(() => {})
    const cli = createCLI({
      commands: {
        inspect: command({
          description: "Inspect parsed inputs.",
          run: () => ({ ok: true }),
          renderCli: (result) => `status=${String(result.ok)}`,
        }),
      },
    })

    const exitCode = await cli.run(["inspect"])

    expect(exitCode).toBe(0)
    expect(log.mock.calls.flat().join("\n")).toContain("status=true")
    log.mockRestore()
  })

  it("prints DexterError messages and hints", async () => {
    const root = createGitRepo()
    process.chdir(root)

    const error = spyOn(console, "error").mockImplementation(() => {})
    const cli = createCLI({
      commands: {
        fail: command({
          description: "Fail loudly.",
          run: () => {
            throw new DexterError("bad", "boom", ["do the thing"])
          },
        }),
      },
    })

    const exitCode = await cli.run(["fail"])

    expect(exitCode).toBe(1)
    const output = error.mock.calls.flat().join("\n")
    expect(output).toContain("error: boom")
    expect(output).toContain("hint: do the thing")
    error.mockRestore()
  })
})
