import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

import { version } from "@vladpazych/rig"

describe("version", () => {
  it("matches the package manifest version", () => {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), "packages/rig/package.json"), "utf8"),
    ) as { version: string }

    assert.equal(version, packageJson.version)
  })
})
