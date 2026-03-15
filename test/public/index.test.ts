import { describe, expect, it } from "bun:test"

import * as dexter from "../../src/index.ts"

describe("@vladpazych/dexter", () => {
  it("exports the flat root surface", () => {
    expect(Object.keys(dexter).sort()).toEqual([
      "env",
      "files",
      "logs",
      "pipe",
      "terminal",
      "version",
    ])
    expect(typeof dexter.env.load).toBe("function")
    expect(typeof dexter.files.collect).toBe("function")
    expect(typeof dexter.logs.run).toBe("function")
    expect(typeof dexter.logs.withRun).toBe("function")
    expect("create" in dexter.logs).toBe(false)
    expect(typeof dexter.pipe.spawn).toBe("function")
    expect(typeof dexter.pipe.exec).toBe("function")
    expect("run" in dexter.pipe).toBe(false)
    expect(typeof dexter.terminal.with).toBe("function")
    expect("renderLine" in dexter.terminal).toBe(false)
  })
})
