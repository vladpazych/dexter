import { describe, expect, it } from "bun:test"

import * as dexter from "../../src/index.ts"

describe("@vladpazych/dexter", () => {
  it("exports the minimal root surface", () => {
    expect(Object.keys(dexter).sort()).toEqual(["env", "files", "pipe", "terminal", "version"])
    expect(typeof dexter.env.load).toBe("function")
    expect(typeof dexter.files.collect).toBe("function")
    expect(typeof dexter.pipe.spawn).toBe("function")
    expect(typeof dexter.terminal.with).toBe("function")
  })
})
