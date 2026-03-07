/**
 * Actor detection and mode constraints.
 *
 * CLAUDECODE=1 indicates LLM agent context.
 * Absence indicates human context.
 */

export type Actor = "llm" | "human"

/** Detect current actor from environment */
export function getActor(): Actor {
  return process.env.CLAUDECODE === "1" ? "llm" : "human"
}

/** True if running in LLM agent context */
export function isLLM(): boolean {
  return getActor() === "llm"
}

/** True if running in human context */
export function isHuman(): boolean {
  return getActor() === "human"
}

/**
 * Output mode constraints by actor.
 *
 * LLM: minimal output, inline only, never TUI/interactive
 * Human: supports inline and interactive
 */
export interface ActorOutputMode {
  /** Use minimal output (no decorations, progress bars, etc.) */
  minimal: boolean
  /** Allow interactive prompts */
  interactive: boolean
  /** Allow TUI (full-screen terminal UI) */
  tui: boolean
}

export function getOutputMode(): ActorOutputMode {
  if (isLLM()) {
    return {
      minimal: true,
      interactive: false,
      tui: false,
    }
  }
  return {
    minimal: false,
    interactive: true,
    tui: true,
  }
}
