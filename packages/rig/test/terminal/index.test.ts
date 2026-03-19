import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { terminal } from "@vladpazych/rig"

function withTerminalState(
  options: {
    forceColor?: string | undefined
    noColor?: string | undefined
    isTTY?: boolean | undefined
  },
  run: () => void,
): void {
  const originalForceColor = process.env.FORCE_COLOR
  const originalNoColor = process.env.NO_COLOR
  const originalIsTty = process.stdout.isTTY

  if (options.forceColor === undefined) {
    delete process.env.FORCE_COLOR
  } else {
    process.env.FORCE_COLOR = options.forceColor
  }

  if (options.noColor === undefined) {
    delete process.env.NO_COLOR
  } else {
    process.env.NO_COLOR = options.noColor
  }

  Object.defineProperty(process.stdout, "isTTY", {
    configurable: true,
    value: options.isTTY,
  })

  try {
    run()
  } finally {
    if (originalForceColor === undefined) {
      delete process.env.FORCE_COLOR
    } else {
      process.env.FORCE_COLOR = originalForceColor
    }

    if (originalNoColor === undefined) {
      delete process.env.NO_COLOR
    } else {
      process.env.NO_COLOR = originalNoColor
    }

    Object.defineProperty(process.stdout, "isTTY", {
      configurable: true,
      value: originalIsTty,
    })
  }
}

describe("terminal", () => {
  it("disables color through with()", () => {
    const plain = terminal.with({ color: false })
    assert.equal(plain.colors.red("error"), "error")
  })

  it("strips ansi sequences", () => {
    const colored = terminal.with({ color: true }).colors.green("ok")
    assert.equal(terminal.stripAnsi(colored), "ok")
  })

  it("does not enable color by default when stdout is not a tty", () => {
    withTerminalState(
      { forceColor: undefined, noColor: undefined, isTTY: false },
      () => {
        assert.equal(terminal.with({}).colors.green("ok"), "ok")
      },
    )
  })

  it("enables color when FORCE_COLOR=1", () => {
    withTerminalState(
      { forceColor: "1", noColor: undefined, isTTY: false },
      () => {
        assert.match(terminal.with({}).colors.green("ok"), /\x1b\[/)
      },
    )
  })

  it("disables color when NO_COLOR is set", () => {
    withTerminalState(
      { forceColor: undefined, noColor: "1", isTTY: true },
      () => {
        assert.equal(terminal.with({}).colors.green("ok"), "ok")
      },
    )
  })

  it("applies explicit color overrides before env detection", () => {
    withTerminalState(
      { forceColor: "1", noColor: undefined, isTTY: false },
      () => {
        assert.equal(terminal.with({ color: false }).colors.green("ok"), "ok")
      },
    )

    withTerminalState(
      { forceColor: undefined, noColor: "1", isTTY: false },
      () => {
        assert.match(
          terminal.with({ color: true }).colors.green("ok"),
          /\x1b\[/,
        )
      },
    )
  })
})
