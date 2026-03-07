/**
 * Pure validators for environment variable types.
 * Each returns the coerced value or throws a descriptive message.
 */

export function validateString(value: string): string {
  return value
}

export function validatePort(value: string): number {
  const n = parseInt(value, 10)
  if (isNaN(n) || n < 1 || n > 65535) {
    throw `expected port number (1–65535), got "${value}"`
  }
  return n
}

export function validateNumber(value: string): number {
  const n = parseFloat(value)
  if (isNaN(n)) {
    throw `expected number, got "${value}"`
  }
  return n
}

export function validateBoolean(value: string): boolean {
  if (value === "true" || value === "1") return true
  if (value === "false" || value === "0") return false
  throw `expected true/false/1/0, got "${value}"`
}

export function validateUrl(value: string): string {
  try {
    new URL(value)
    return value
  } catch {
    throw `expected valid URL, got "${value}"`
  }
}

export function validateEnum(value: string, allowed: readonly string[]): string {
  if (!allowed.includes(value)) {
    throw `expected ${allowed.join(" | ")}, got "${value}"`
  }
  return value
}
