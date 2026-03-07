/**
 * Stub hook handlers — silent exit 0.
 *
 * Extension points for consumer repos to override via createCLI hooks config.
 */

import { readJsonStdin, type HookInput } from "../lib/stdin.ts"

// onSessionStart moved to on-session-start.ts

export async function onPostBash(): Promise<void> {
  await readJsonStdin<HookInput>()
  process.exit(0)
}

export async function onStop(): Promise<void> {}

export async function onPromptSubmit(): Promise<void> {
  await readJsonStdin<HookInput>()
  process.exit(0)
}

export async function onNotification(): Promise<void> {
  await readJsonStdin<HookInput>()
}

export async function onPreCompact(): Promise<void> {
  await readJsonStdin<HookInput>()
}

export async function onToolFailure(): Promise<void> {
  await readJsonStdin<HookInput>()
}

export async function onSubagentStart(): Promise<void> {
  await readJsonStdin<HookInput>()
}

export async function onSubagentStop(): Promise<void> {
  await readJsonStdin<HookInput>()
  process.exit(0)
}

export async function onSessionEnd(): Promise<void> {
  await readJsonStdin<HookInput>()
}

export async function onPermissionRequest(): Promise<void> {
  await readJsonStdin<HookInput>()
  process.exit(0)
}
