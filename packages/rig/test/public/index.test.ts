import assert from "node:assert/strict"
import { describe, it } from "node:test"

import * as rig from "@vladpazych/rig"

describe("@vladpazych/rig", () => {
  it("exports the flat root surface", () => {
    assert.deepEqual(Object.keys(rig).sort(), [
      "env",
      "files",
      "logger",
      "process",
      "terminal",
      "version",
    ])
    assert.equal(typeof rig.env.load, "function")
    assert.equal(typeof rig.files.collect, "function")
    assert.equal(typeof rig.logger.with, "function")
    assert.equal(typeof rig.logger.info, "function")
    assert.equal(typeof rig.process.spawn, "function")
    assert.equal(typeof rig.process.run, "function")
    assert.equal("logs" in rig, false)
    assert.equal("pipe" in rig, false)
    assert.equal(typeof rig.terminal.with, "function")
    assert.equal("renderLine" in rig.terminal, false)
  })
})
