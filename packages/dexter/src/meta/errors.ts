/**
 * Generic dexter error — typed code plus optional human hints.
 */

export class DexterError extends Error {
  readonly code: string
  readonly hints: string[]

  constructor(code: string, message: string, hints: string[] = []) {
    super(message)
    this.name = "DexterError"
    this.code = code
    this.hints = hints
  }
}

export function isDexterError(err: unknown): err is DexterError {
  return err instanceof DexterError
}
