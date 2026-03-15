/**
 * App-owned configuration from environment variables.
 *
 * Dexter keeps the schema layer separate from the public namespace API.
 * `env.load(...)` and `env.inspect(...)` both use the helpers in this file.
 * Metadata is attached via Symbol for env formatting to read.
 */

import { loadEnv as loadEnvFiles } from "./loader.ts"
import {
  validateBoolean,
  validateEnum,
  validateNumber,
  validatePort,
  validateString,
  validateUrl,
} from "./validate.ts"

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

export type EnvSchema = { readonly [key: string]: FieldDef | EnvSchema }

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
type FieldOutput<F> =
  IsPresent<F> extends true ? FieldValueType<F> : FieldValueType<F> | undefined

/** Recursive output type for the entire schema. */
export type EnvConfig<S> = {
  -readonly [K in keyof S]: S[K] extends { env: string }
    ? FieldOutput<S[K]>
    : EnvConfig<S[K]>
}

// ============================================================================
// METADATA — hidden on config object for printConfig
// ============================================================================

export const ENV_META = Symbol.for("dexter.env.meta")

export type FieldMeta = {
  path: string
  env: string
  sensitive: boolean
  type: EnvType
  values?: readonly string[]
  required: boolean
  hasDefault: boolean
}

export type EnvMeta = {
  name?: string
  fields: FieldMeta[]
}

export type EnvFieldReport = {
  path: string
  env: string
  source: string
  displayValue: string
  sensitive: boolean
}

export type EnvLoadReport = {
  name: string
  fields: EnvFieldReport[]
}

export type EnvOptions = {
  env?: Record<string, string | undefined>
  root?: string
  name?: string
}

// ============================================================================
// ERROR
// ============================================================================

export class EnvError extends Error {
  readonly issues: string[]

  constructor(issues: string[]) {
    super(
      `Invalid environment configuration\n${issues.map((i) => `  ${i}`).join("\n")}`,
    )
    this.name = "EnvError"
    this.issues = issues
  }
}

// ============================================================================
// RUNTIME
// ============================================================================

const MASK = "••••"
const UNSET = "—"

function isField(value: unknown): value is FieldDef {
  return (
    typeof value === "object" &&
    value !== null &&
    "env" in value &&
    typeof (value as Record<string, unknown>).env === "string"
  )
}

function coerce(
  raw: string,
  type: EnvType,
  values?: readonly string[],
): unknown {
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

function formatDisplayValue(value: unknown, sensitive: boolean): string {
  if (value === undefined || value === null) return UNSET
  if (sensitive) return MASK
  return String(value)
}

function createFieldMeta(path: string, def: FieldDef): FieldMeta {
  return {
    path,
    env: def.env,
    sensitive: def.sensitive ?? false,
    type: def.type ?? "string",
    values: def.values,
    required: def.required ?? false,
    hasDefault: "default" in def,
  }
}

function createFieldReport(
  path: string,
  field: FieldMeta,
  source: string,
  value: unknown,
): EnvFieldReport {
  return {
    path,
    env: field.env,
    source,
    displayValue: formatDisplayValue(value, field.sensitive),
    sensitive: field.sensitive,
  }
}

function attachConfigMeta(
  config: Record<string, unknown>,
  name: string | undefined,
  fields: FieldMeta[],
): void {
  Object.defineProperty(config, ENV_META, {
    value: { name, fields } satisfies EnvMeta,
    enumerable: false,
    configurable: false,
    writable: false,
  })
}

function resolveConfigInternal<const S extends EnvSchema>(
  name: string | undefined,
  schema: S,
  options: EnvOptions,
): { config: EnvConfig<S>; report: EnvLoadReport } {
  const errors: string[] = []
  const fields: FieldMeta[] = []
  const reportFields: EnvFieldReport[] = []
  const fileEnv = options.root
    ? loadEnvFiles(options.root)
    : { env: {}, sources: {} }
  const runtimeEnv = options.env ?? process.env

  function lookupValue(envName: string): {
    raw: string | undefined
    source: string | undefined
  } {
    const runtimeValue = runtimeEnv[envName]
    if (runtimeValue !== undefined && runtimeValue !== "") {
      return { raw: runtimeValue, source: "process" }
    }

    const fileValue = fileEnv.env[envName]
    if (fileValue !== undefined && fileValue !== "") {
      return { raw: fileValue, source: fileEnv.sources[envName] }
    }

    return { raw: undefined, source: undefined }
  }

  function walk(
    obj: Record<string, unknown>,
    path: string[],
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    for (const [key, def] of Object.entries(obj)) {
      if (isField(def)) {
        const fieldPath = [...path, key].join(".")
        const field = createFieldMeta(fieldPath, def)

        fields.push(field)

        const { raw, source } = lookupValue(def.env)

        if (raw === undefined) {
          if (field.required) {
            errors.push(`${def.env}: required but not set`)
            result[key] = undefined
            reportFields.push(
              createFieldReport(fieldPath, field, "unset", undefined),
            )
            continue
          }

          if (field.hasDefault) {
            result[key] = def.default
            reportFields.push(
              createFieldReport(fieldPath, field, "default", def.default),
            )
            continue
          }

          result[key] = undefined
          reportFields.push(
            createFieldReport(fieldPath, field, "unset", undefined),
          )
          continue
        }

        try {
          const value = coerce(raw, field.type, def.values)
          result[key] = value
          reportFields.push(
            createFieldReport(fieldPath, field, source ?? "process", value),
          )
        } catch (msg) {
          errors.push(`${def.env}: ${msg}`)
          result[key] = undefined
          reportFields.push(
            createFieldReport(fieldPath, field, source ?? "process", raw),
          )
        }
      } else {
        result[key] = walk(def as Record<string, unknown>, [...path, key])
      }
    }

    return result
  }

  const config = walk(schema as Record<string, unknown>, []) as EnvConfig<S> &
    Record<string, unknown>

  if (errors.length > 0) {
    throw new EnvError(errors)
  }

  attachConfigMeta(config, name, fields)

  return {
    config,
    report: {
      name: name ?? "env",
      fields: reportFields,
    },
  }
}

export function loadEnvConfig<const S extends EnvSchema>(
  schema: S,
  options: EnvOptions = {},
): EnvConfig<S> {
  return resolveConfigInternal(options.name, schema, options).config
}

export function inspectEnvConfig<const S extends EnvSchema>(
  schema: S,
  options: EnvOptions = {},
): {
  config: EnvConfig<S>
  report: EnvLoadReport
} {
  return resolveConfigInternal(options.name, schema, options)
}
