/**
 * Actor Detection Tests
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test"

import { getActor, getOutputMode, isHuman, isLLM } from "../../../src/meta/lib/actor.ts"

describe("getActor", () => {
  let savedClaudeCode: string | undefined

  beforeEach(() => {
    savedClaudeCode = process.env.CLAUDECODE
  })

  afterEach(() => {
    if (savedClaudeCode === undefined) {
      delete process.env.CLAUDECODE
    } else {
      process.env.CLAUDECODE = savedClaudeCode
    }
  })

  it("returns llm when CLAUDECODE=1", () => {
    process.env.CLAUDECODE = "1"
    expect(getActor()).toBe("llm")
  })

  it("returns human when CLAUDECODE is absent", () => {
    delete process.env.CLAUDECODE
    expect(getActor()).toBe("human")
  })

  it("returns human when CLAUDECODE is not 1", () => {
    process.env.CLAUDECODE = "0"
    expect(getActor()).toBe("human")
  })
})

describe("isLLM / isHuman", () => {
  let savedClaudeCode: string | undefined

  beforeEach(() => {
    savedClaudeCode = process.env.CLAUDECODE
  })

  afterEach(() => {
    if (savedClaudeCode === undefined) {
      delete process.env.CLAUDECODE
    } else {
      process.env.CLAUDECODE = savedClaudeCode
    }
  })

  it("isLLM true when CLAUDECODE=1", () => {
    process.env.CLAUDECODE = "1"
    expect(isLLM()).toBe(true)
    expect(isHuman()).toBe(false)
  })

  it("isHuman true when CLAUDECODE absent", () => {
    delete process.env.CLAUDECODE
    expect(isHuman()).toBe(true)
    expect(isLLM()).toBe(false)
  })
})

describe("getOutputMode", () => {
  let savedClaudeCode: string | undefined

  beforeEach(() => {
    savedClaudeCode = process.env.CLAUDECODE
  })

  afterEach(() => {
    if (savedClaudeCode === undefined) {
      delete process.env.CLAUDECODE
    } else {
      process.env.CLAUDECODE = savedClaudeCode
    }
  })

  it("LLM: minimal=true, interactive=false, tui=false", () => {
    process.env.CLAUDECODE = "1"
    const mode = getOutputMode()

    expect(mode.minimal).toBe(true)
    expect(mode.interactive).toBe(false)
    expect(mode.tui).toBe(false)
  })

  it("Human: minimal=false, interactive=true, tui=true", () => {
    delete process.env.CLAUDECODE
    const mode = getOutputMode()

    expect(mode.minimal).toBe(false)
    expect(mode.interactive).toBe(true)
    expect(mode.tui).toBe(true)
  })
})
