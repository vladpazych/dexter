type ColorName =
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "gray"
  | "dim"
  | "bold"

type TerminalOptions = {
  color?: boolean
}

type TerminalColors = Record<ColorName, (text: string) => string>

const RESET = "\x1b[0m"
const CODES: Record<ColorName, string> = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
}

const ANSI_PATTERN =
  // Matches CSI, OSC, and a small set of single-character ANSI control sequences.
  /\x1B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\x1B\\)|[@-Z\\-_])/g

function resolveColorEnabled(override?: boolean): boolean {
  if (override !== undefined) {
    return override
  }

  if (process.env.NO_COLOR && process.env.NO_COLOR !== "0") {
    return false
  }

  if (process.env.FORCE_COLOR === "1") {
    return true
  }

  if (process.stdout.isTTY === true) {
    return true
  }

  if (process.stdout.isTTY === false) {
    return false
  }

  return true
}

function wrap(code: string, enabled: boolean): (text: string) => string {
  return (text) => (enabled ? `${code}${text}${RESET}` : text)
}

export function createColors(options: TerminalOptions = {}): TerminalColors {
  const enabled = resolveColorEnabled(options.color)

  return {
    red: wrap(CODES.red, enabled),
    green: wrap(CODES.green, enabled),
    yellow: wrap(CODES.yellow, enabled),
    blue: wrap(CODES.blue, enabled),
    magenta: wrap(CODES.magenta, enabled),
    cyan: wrap(CODES.cyan, enabled),
    gray: wrap(CODES.gray, enabled),
    dim: wrap(CODES.dim, enabled),
    bold: wrap(CODES.bold, enabled),
  }
}

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, "")
}

export function createTerminal(options: TerminalOptions = {}) {
  return {
    colors: createColors(options),
    stripAnsi,
  }
}
