/**
 * ANSI terminal colors with NO_COLOR/FORCE_COLOR support.
 *
 * Priority:
 * 1. DEXTER_COLOR=1 → enabled (dexter override)
 * 2. NO_COLOR set → disabled (accessibility)
 * 3. FORCE_COLOR=1 → enabled
 * 4. TTY detection → enabled if TTY
 * 5. Default → enabled (dev-friendly default)
 *
 * https://no-color.org/
 */

let _colorEnabled: boolean | null = null

function isColorEnabled(): boolean {
  if (_colorEnabled !== null) return _colorEnabled

  // Dexter-specific override (highest priority)
  if (process.env.DEXTER_COLOR === "1") {
    _colorEnabled = true
    return true
  }

  // Explicit disable
  if (process.env.NO_COLOR && process.env.NO_COLOR !== "0") {
    _colorEnabled = false
    return false
  }

  // Explicit enable
  if (process.env.FORCE_COLOR === "1") {
    _colorEnabled = true
    return true
  }

  // TTY detection
  if (process.stdout.isTTY === true) {
    _colorEnabled = true
    return true
  }
  if (process.stdout.isTTY === false) {
    _colorEnabled = false
    return false
  }

  // Default: enable for better dev experience
  _colorEnabled = true
  return true
}

/** Enable or disable colors programmatically */
export function setColorEnabled(enabled: boolean): void {
  _colorEnabled = enabled
}

/** Raw ANSI codes */
export const reset = "\x1b[0m"
export const bold = "\x1b[1m"
export const dim = "\x1b[2m"
export const red = "\x1b[31m"
export const green = "\x1b[32m"
export const yellow = "\x1b[33m"
export const blue = "\x1b[34m"
export const magenta = "\x1b[35m"
export const cyan = "\x1b[36m"
export const gray = "\x1b[90m"

/**
 * Wrap text with color code and reset (respects color enabled).
 */
export const wrap = (colorCode: string) => (text: string) => (isColorEnabled() ? `${colorCode}${text}${reset}` : text)

export const c = {
  reset,
  bold,
  dim,
  red: wrap(red),
  green: wrap(green),
  yellow: wrap(yellow),
  blue: wrap(blue),
  magenta: wrap(magenta),
  cyan: wrap(cyan),
  gray: wrap(gray),
  dimmed: wrap(dim),
  bolded: wrap(bold),
}

const ANSI_PATTERN =
  // Matches CSI, OSC, and a small set of single-character ANSI control sequences.
  /\x1B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\x1B\\)|[@-Z\\-_])/g

/**
 * Strip ANSI escape codes from string.
 */
export function stripAnsi(str: string): string {
  return str.replace(ANSI_PATTERN, "")
}
