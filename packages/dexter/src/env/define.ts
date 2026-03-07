/**
 * App-owned configuration from environment variables.
 *
 * Each app declares its schema via defineConfig(), which reads process.env,
 * validates types, enforces required fields, and returns a typed object.
 * Metadata is attached via Symbol for printConfig() to read.
 */

import { validateBoolean, validateEnum, validateNumber, validatePort, validateString, validateUrl } from "./validate.ts"

// ============================================================================
// TYPES — schema definition
// ============================================================================

type EnvType = "string" | "port" | "url" | "number" | "boolean" | "enum"

type FieldDef = {
  readonly env: string
  readonly type?: EnvType
  readonly values?: readonly string[]
  readonly default?: unknown
  readonly required?: boolean
  readonly sensitive?: boolean
}

export type Schema = { readonly [key: string]: FieldDef | Schema }

// ============================================================================
// TYPES — output inference
// ============================================================================

/** Map field's `type` property to the TypeScript value type. */
type FieldValueType<F> = F extends { type: "port" | "number" }
  ? number
  : F extends { type: "boolean" }
    ? boolean
    : F extends { type: "enum"; values: readonly (infer V)[] }
      ? V
      : string

/** True when the field is guaranteed to have a value (required or defaulted). */
type IsPresent<F> = F extends { required: true }
  ? true
  : F extends { default: undefined }
    ? false
    : F extends { default: unknown }
      ? true
      : false

/** Output type for a single field: value type, optionally undefined. */
type FieldOutput<F> = IsPresent<F> extends true ? FieldValueType<F> : FieldValueType<F> | undefined

/** Recursive output type for the entire schema. */
export type ConfigOutput<S> = {
  -readonly [K in keyof S]: S[K] extends { env: string } ? FieldOutput<S[K]> : ConfigOutput<S[K]>
}

// ============================================================================
// METADATA — hidden on config object for printConfig
// ============================================================================

export const CONFIG_META = Symbol.for("dexter.config.meta")

export type FieldMeta = {
  path: string
  env: string
  sensitive: boolean
  type: EnvType
  values?: readonly string[]
  required: boolean
  hasDefault: boolean
}

export type ConfigMeta = {
  name?: string
  fields: FieldMeta[]
}

// ============================================================================
// ERROR
// ============================================================================

export class ConfigError extends Error {
  readonly issues: string[]

  constructor(issues: string[]) {
    super(`Invalid environment configuration\n${issues.map((i) => `  ${i}`).join("\n")}`)
    this.name = "ConfigError"
    this.issues = issues
  }
}

// ============================================================================
// RUNTIME
// ============================================================================

function isField(value: unknown): value is FieldDef {
  return (
    typeof value === "object" &&
    value !== null &&
    "env" in value &&
    typeof (value as Record<string, unknown>).env === "string"
  )
}

function coerce(raw: string, type: EnvType, values?: readonly string[]): unknown {
  switch (type) {
    case "string":
      return validateString(raw)
    case "port":
      return validatePort(raw)
    case "number":
      return validateNumber(raw)
    case "boolean":
      return validateBoolean(raw)
    case "url":
      return validateUrl(raw)
    case "enum":
      return validateEnum(raw, values ?? [])
  }
}

export function defineConfig<const S extends Schema>(schema: S): ConfigOutput<S>
export function defineConfig<const S extends Schema>(name: string, schema: S): ConfigOutput<S>
export function defineConfig<const S extends Schema>(nameOrSchema: string | S, maybeSchema?: S): ConfigOutput<S> {
  const name = typeof nameOrSchema === "string" ? nameOrSchema : undefined
  const schema = typeof nameOrSchema === "string" ? maybeSchema! : nameOrSchema

  const errors: string[] = []
  const fields: FieldMeta[] = []

  function walk(obj: Record<string, unknown>, path: string[]): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    for (const [key, def] of Object.entries(obj)) {
      if (isField(def)) {
        const fieldPath = [...path, key].join(".")
        const type: EnvType = (def.type as EnvType) ?? "string"

        fields.push({
          path: fieldPath,
          env: def.env,
          sensitive: def.sensitive ?? false,
          type,
          values: def.values,
          required: def.required ?? false,
          hasDefault: "default" in def,
        })

        const raw = process.env[def.env]

        if (raw === undefined || raw === "") {
          if (def.required) {
            errors.push(`${def.env}: required but not set`)
          } else if ("default" in def) {
            result[key] = def.default
          } else {
            result[key] = undefined
          }
          continue
        }

        try {
          result[key] = coerce(raw, type, def.values)
        } catch (msg) {
          errors.push(`${def.env}: ${msg}`)
        }
      } else {
        result[key] = walk(def as Record<string, unknown>, [...path, key])
      }
    }

    return result
  }

  const config = walk(schema as unknown as Record<string, unknown>, [])

  if (errors.length > 0) {
    throw new ConfigError(errors)
  }

  Object.defineProperty(config, CONFIG_META, {
    value: { name, fields } satisfies ConfigMeta,
    enumerable: false,
    configurable: false,
    writable: false,
  })

  return config as ConfigOutput<S>
}
