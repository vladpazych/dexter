/**
 * Load environment variables from .env files.
 * Order: .env (defaults) → .env.local (overrides)
 */

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

export type LoadResult = {
  env: Record<string, string>
  sources: Record<string, string>
}

/** Parse a plain key=value .env file. Ignores comments and empty lines. */
export function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {}
  const content = readFileSync(filePath, "utf-8")
  const result: Record<string, string> = {}

  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (trimmed.startsWith("#") || trimmed === "") continue

    const match = trimmed.match(/^([A-Z][A-Z0-9_]*)=(.*)$/)
    if (match) {
      let value = match[2]
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      result[match[1]] = value
    }
  }

  return result
}

export function loadEnv(rootDir: string): LoadResult {
  const env: Record<string, string> = {}
  const sources: Record<string, string> = {}

  const merge = (filename: string) => {
    const values = parseEnvFile(join(rootDir, filename))
    for (const [key, value] of Object.entries(values)) {
      if (value !== "") {
        env[key] = value
        sources[key] = filename
      }
    }
  }

  merge(".env")
  merge(".env.local")

  return { env, sources }
}

export function applyEnv(env: Record<string, string>): void {
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value
  }
}
