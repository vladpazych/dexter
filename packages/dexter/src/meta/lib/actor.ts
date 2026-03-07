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

