import { describe, expect, it } from "bun:test"

import { parseFormat } from "../../../src/meta/lib/format.ts"

describe("parseFormat", () => {
  it("defaults to cli mode", () => {
    expect(parseFormat(["build", "app"])).toEqual({ mode: "cli", rest: ["build", "app"] })
  })

  it("extracts shorthand and explicit format flags", () => {
    expect(parseFormat(["--json", "build"])).toEqual({ mode: "json", rest: ["build"] })
    expect(parseFormat(["build", "--format", "json", "app"])).toEqual({ mode: "json", rest: ["build", "app"] })
    expect(parseFormat(["build", "--format=json", "app"])).toEqual({ mode: "json", rest: ["build", "app"] })
  })

  it("ignores invalid format values", () => {
    expect(parseFormat(["build", "--format", "xml"])).toEqual({ mode: "cli", rest: ["build", "--format", "xml"] })
    expect(parseFormat(["build", "--format=xml"])).toEqual({ mode: "cli", rest: ["build", "--format=xml"] })
  })

  it("stops parsing flags after --", () => {
    expect(parseFormat(["build", "--", "--json"])).toEqual({ mode: "cli", rest: ["build", "--", "--json"] })
  })
})
