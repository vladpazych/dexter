/**
 * Utilities for reading hook input from stdin
 */

/**
 * Read all input from stdin
 */
export async function readStdin(): Promise<string> {
  return Bun.stdin.text()
}

/**
 * Parse JSON from stdin, returning null on parse error
 */
export async function readJsonStdin<T>(): Promise<T | null> {
  const input = await readStdin()
  if (!input.trim()) return null

  try {
    return JSON.parse(input) as T
  } catch {
    return null
  }
}

/**
 * Hook input structure from Claude Code
 */
export type HookInput = {
  /** Session identifier for correlation */
  session_id?: string
  /** The tool name that triggered the hook */
  tool_name?: string
  /** Tool input parameters */
  tool_input?: Record<string, unknown>
  /** Tool output (for PostToolUse) */
  tool_output?: unknown
}

/**
 * Extract file path from hook input
 */
export function getFilePath(input: HookInput | null): string | null {
  if (!input?.tool_input) return null
  const filePath = input.tool_input.file_path
  return typeof filePath === "string" ? filePath : null
}

/**
 * Extract command from Bash hook input
 */
export function getCommand(input: HookInput | null): string | null {
  if (!input?.tool_input) return null
  const command = input.tool_input.command
  return typeof command === "string" ? command : null
}
