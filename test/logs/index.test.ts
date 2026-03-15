import { describe, expect, it } from "bun:test"
import { existsSync, mkdtempSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

import { logs } from "../../src/index.ts"

describe("logs", () => {
  it("writes run metadata, events, combined output, and per-section logs", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "dexter-logs-"))
    const run = logs.run({
      name: "binary",
      cwd,
      console: false,
    })
    const build = run.step("build")

    build.info("warming cache", { source: "prep" })

    const result = await build.exec({
      cmd: process.execPath,
      args: [
        "-e",
        "console.log(JSON.stringify({ level: 30, msg: 'compiled', time: 10 }))",
      ],
      source: "vite",
    })

    expect(result.exitCode).toBe(0)

    const closed = run.close()
    expect(closed.status).toBe("passed")
    expect(closed.files.manifest).not.toBeNull()
    expect(closed.files.events).not.toBeNull()
    expect(closed.files.combined).not.toBeNull()
    expect(closed.files.sections).not.toBeNull()

    const manifestPath = closed.files.manifest
    const eventsPath = closed.files.events
    const combinedPath = closed.files.combined
    const sectionPath = join(closed.files.sections ?? "", "build.log")

    expect(manifestPath).not.toBeNull()
    expect(eventsPath).not.toBeNull()
    expect(combinedPath).not.toBeNull()
    expect(existsSync(sectionPath)).toBe(true)
    expect(readFileSync(manifestPath ?? "", "utf8")).toContain(
      '"status": "passed"',
    )
    expect(readFileSync(eventsPath ?? "", "utf8")).toContain(
      '"type":"section:start"',
    )
    expect(readFileSync(eventsPath ?? "", "utf8")).toContain(
      '"message":"compiled"',
    )
    expect(readFileSync(combinedPath ?? "", "utf8")).toContain("compiled")
    expect(readFileSync(sectionPath, "utf8")).toContain("warming cache")
  })

  it("marks failing sections and sessions", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "dexter-logs-fail-"))
    const run = logs.run({
      name: "binary",
      cwd,
      console: false,
    })

    const result = await run.step("archive").exec({
      cmd: process.execPath,
      args: ["-e", "console.error('archive failed'); process.exit(2)"],
    })

    expect(result.exitCode).toBe(2)

    const closed = run.close()
    expect(closed.status).toBe("failed")
    expect(closed.sections[0]?.status).toBe("failed")
  })

  it("auto-closes with withRun and returns the task value and result", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "dexter-logs-with-run-"))

    const outcome = await logs.withRun(
      {
        name: "binary",
        cwd,
        console: false,
      },
      async (run) => {
        await run.step("build").exec({
          cmd: process.execPath,
          args: ["-e", "console.log('compiled')"],
          source: "vite",
        })

        return "ok"
      },
    )

    expect(outcome.value).toBe("ok")
    expect(outcome.result.status).toBe("passed")
    expect(outcome.result.files.manifest).not.toBeNull()
  })

  it("auto-closes with withRun when the task throws", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "dexter-logs-with-run-error-"))

    await expect(
      logs.withRun(
        {
          name: "binary",
          cwd,
          console: false,
        },
        async (run) => {
          run.step("build").error("boom")
          throw new Error("explode")
        },
      ),
    ).rejects.toThrow("explode")
  })

  it("exposes only step() on the manual run object", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dexter-logs-shape-"))
    const run = logs.run({
      name: "binary",
      cwd,
      console: false,
    })

    expect("section" in run).toBe(false)

    const step = run.step("build")
    expect("run" in step).toBe(false)
    run.close()
  })
})
