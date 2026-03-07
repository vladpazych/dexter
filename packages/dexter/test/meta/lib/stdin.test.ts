/**
 * Stdin Utility Tests
 *
 * Tests pure extraction functions (getFilePath, getCommand).
 * Skips readJsonStdin/readStdin which read Bun.stdin directly.
 */

import { describe, expect, it } from "bun:test"

import { getFilePath, getCommand, type HookInput } from "../../../src/meta/lib/stdin.ts"

describe("getFilePath", () => {
  it("extracts file_path from tool_input", () => {
    const input: HookInput = { tool_input: { file_path: "/repo/src/index.ts" } }
    expect(getFilePath(input)).toBe("/repo/src/index.ts")
  })

  it("returns null when input is null", () => {
    expect(getFilePath(null)).toBeNull()
  })

  it("returns null when tool_input is missing", () => {
    const input: HookInput = {}
    expect(getFilePath(input)).toBeNull()
  })

  it("returns null when file_path is not a string", () => {
    const input: HookInput = { tool_input: { file_path: 42 } }
    expect(getFilePath(input)).toBeNull()
  })

  it("returns null when file_path is missing from tool_input", () => {
    const input: HookInput = { tool_input: { command: "ls" } }
    expect(getFilePath(input)).toBeNull()
  })
})

describe("getCommand", () => {
  it("extracts command from tool_input", () => {
    const input: HookInput = { tool_input: { command: "git status" } }
    expect(getCommand(input)).toBe("git status")
  })

  it("returns null when input is null", () => {
    expect(getCommand(null)).toBeNull()
  })

  it("returns null when tool_input is missing", () => {
    const input: HookInput = {}
    expect(getCommand(input)).toBeNull()
  })

  it("returns null when command is not a string", () => {
    const input: HookInput = { tool_input: { command: true } }
    expect(getCommand(input)).toBeNull()
  })

  it("returns null when command is missing from tool_input", () => {
    const input: HookInput = { tool_input: { file_path: "/some/file" } }
    expect(getCommand(input)).toBeNull()
  })
})
