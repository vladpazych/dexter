/**
 * Domain error — typed error with machine-readable code and human-readable hints.
 */

export class ControlError extends Error {
  readonly code: string
  readonly hints: string[]

  constructor(code: string, message: string, hints: string[] = []) {
    super(message)
    this.name = "ControlError"
    this.code = code
    this.hints = hints
  }
}

export function isControlError(err: unknown): err is ControlError {
  return err instanceof ControlError
}
