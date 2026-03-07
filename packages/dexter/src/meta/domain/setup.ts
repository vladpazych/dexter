/**
 * Setup domain logic — configures Claude Code local settings.
 */

import { join } from "node:path"

import type { ControlPorts } from "../ports.ts"
import type { SetupResult } from "../types.ts"

type LocalSettings = {
  env?: Record<string, string>
  [key: string]: unknown
}

export function setup(ports: ControlPorts): SetupResult {
  const settingsPath = join(ports.root, ".claude/settings.local.json")
  const binPath = join(ports.root, ".claude/bin")

  let settings: LocalSettings = {}
  if (ports.fs.exists(settingsPath)) {
    try {
      settings = JSON.parse(ports.fs.readFile(settingsPath)) as LocalSettings
    } catch {
      // Invalid JSON, start fresh
    }
  }

  settings.env = settings.env ?? {}
  settings.env.PATH = `${binPath}:$PATH`

  ports.fs.writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n")

  return { settingsPath, binPath }
}
