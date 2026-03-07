/**
 * Actor Detection Tests
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test"

import { getActor, isHuman, isLLM } from "../../../src/meta/lib/actor.ts"

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
