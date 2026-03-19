import assert from "node:assert/strict"
import { describe, it } from "node:test"

import * as sinks from "@vladpazych/rig-logger-sinks"

describe("@vladpazych/rig-logger-sinks", () => {
  it("exports the standard sink surface", () => {
    assert.deepEqual(Object.keys(sinks).sort(), [
      "consoleSink",
      "fileSink",
      "streamSink",
    ])
    assert.equal(typeof sinks.streamSink, "function")
    assert.equal(typeof sinks.consoleSink, "function")
    assert.equal(typeof sinks.fileSink, "function")
  })
})
