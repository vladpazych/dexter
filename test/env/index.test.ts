import { describe, expect, it } from "bun:test"
import { mkdtempSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

import { env } from "../../src/index.ts"

describe("env", () => {
  it("loads typed env values from explicit env input", () => {
    const config = env.load(
      {
        port: {
          env: "APP_PORT",
          type: "port",
          required: true,
        },
        debug: {
          env: "APP_DEBUG",
          type: "boolean",
          default: false,
        },
      },
      {
        env: {
          APP_PORT: "3000",
        },
      },
    )

    expect(config.port).toBe(3000)
    expect(config.debug).toBe(false)
  })

  it("inspects env with bound root and report metadata", () => {
    const root = mkdtempSync(join(tmpdir(), "dexter-env-"))
    writeFileSync(join(root, ".env"), "API_URL=https://example.com\n")

    const bound = env.with({ root })
    const result = bound.inspect({
      apiUrl: {
        env: "API_URL",
        type: "url",
        required: true,
      },
    })

    expect(result.config.apiUrl).toBe("https://example.com")
    expect(result.report.fields[0]?.source).toBe(".env")
  })
})
