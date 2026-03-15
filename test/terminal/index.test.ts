import { describe, expect, it } from "bun:test"

import { terminal } from "../../src/index.ts"

describe("terminal", () => {
  it("disables color through with()", () => {
    const plain = terminal.with({ color: false })
    expect(plain.colors.red("error")).toBe("error")
  })

  it("strips ansi sequences", () => {
    const colored = terminal.with({ color: true }).colors.green("ok")
    expect(terminal.stripAnsi(colored)).toBe("ok")
  })
})
