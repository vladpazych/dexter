/**
 * Config printing with sensitive value masking.
 *
 * Reads metadata attached by env loading via ENV_META.
 * Nested schema keys become section headers in the output.
 */

import { createColors } from "../terminal/colors.ts"
import { ENV_META, type EnvMeta, type FieldMeta } from "./define.ts"

const MASK = "••••"
const UNSET = "—"
const BOX_TOP = "┌"
const BOX_MID = "│"
const BOX_BOT = "└"

const colors = createColors()

function getMeta(config: unknown): EnvMeta | undefined {
  if (typeof config === "object" && config !== null && ENV_META in config) {
    return (config as Record<symbol, unknown>)[ENV_META] as EnvMeta
  }
  return undefined
}

function formatValue(raw: unknown, field: FieldMeta): string {
  if (raw === undefined || raw === null) return colors.gray(UNSET)
  if (field.sensitive) return colors.gray(MASK)
  return String(raw)
}

function getNestedValue(obj: unknown, path: string): unknown {
  let current = obj
  for (const key of path.split(".")) {
    if (typeof current !== "object" || current === null) return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

/**
 * Format config as a printable string with sections and masking.
 */
export function formatConfig(config: unknown, name?: string): string {
  const meta = getMeta(config)
  if (!meta) return String(config)

  const label = name ?? meta.name ?? "config"
  const lines: string[] = []

  lines.push(`${colors.gray(BOX_TOP)} ${colors.bold(label)}`)

  // Group fields by their first path segment (section)
  const sections = new Map<string, FieldMeta[]>()
  for (const field of meta.fields) {
    const parts = field.path.split(".")
    const section = parts.length > 1 ? parts[0] : ""
    const existing = sections.get(section) ?? []
    existing.push(field)
    sections.set(section, existing)
  }

  // Find longest label for alignment
  const allLabels = meta.fields.map((f) => {
    const parts = f.path.split(".")
    return parts[parts.length - 1]
  })
  const maxLen = Math.max(...allLabels.map((l) => l.length))

  let first = true
  for (const [section, fields] of sections) {
    if (!first) lines.push(colors.gray(BOX_MID))
    first = false

    if (section) {
      lines.push(`${colors.gray(BOX_MID)} ${colors.cyan(section)}`)
    }

    for (const field of fields) {
      const parts = field.path.split(".")
      const key = parts[parts.length - 1]
      const indent = section ? "  " : ""
      const value = getNestedValue(config, field.path)
      const formatted = formatValue(value, field)
      const padding = " ".repeat(maxLen - key.length + 2)

      lines.push(`${colors.gray(BOX_MID)} ${indent}${colors.gray(key)}${padding}${formatted}`)
    }
  }

  lines.push(colors.gray(BOX_BOT))
  return lines.join("\n")
}

/**
 * Print config to stdout with sections and sensitive value masking.
 */
export function printConfig(config: unknown, name?: string): void {
  console.log(formatConfig(config, name))
}
