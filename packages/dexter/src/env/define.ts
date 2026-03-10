/**
 * App-owned configuration from environment variables.
 *
 * Each app declares its schema via defineConfig(), which reads process.env,
 * validates types, enforces required fields, and returns a typed object.
 * Metadata is attached via Symbol for printConfig() to read.
 */

import { loadEnv as loadEnvFiles } from "./loader.ts"
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

export type ConfigFieldReport = {
  path: string
  env: string
  source: string
  displayValue: string
  sensitive: boolean
}

export type ConfigLoadReport = {
  name: string
  fields: ConfigFieldReport[]
}

export type ResolveConfigOptions = {
  env?: Record<string, string | undefined>
  rootDir?: string
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

function resolveNameAndSchema<const S extends Schema>(nameOrSchema: string | S, maybeSchema?: S): {
  name?: string
  schema: S
} {
  if (typeof nameOrSchema === "string") {
    if (maybeSchema === undefined) {
      throw new Error("schema is required when name is provided")
    }

    return {
      name: nameOrSchema,
      schema: maybeSchema,
    }
  }

  return {
    name: undefined,
    schema: nameOrSchema,
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

function createFieldReport(path: string, field: FieldMeta, source: string, value: unknown): ConfigFieldReport {
  return {
    path,
    env: field.env,
    source,
    displayValue: formatDisplayValue(value, field.sensitive),
    sensitive: field.sensitive,
  }
}

function attachConfigMeta(config: Record<string, unknown>, name: string | undefined, fields: FieldMeta[]): void {
  Object.defineProperty(config, CONFIG_META, {
    value: { name, fields } satisfies ConfigMeta,
    enumerable: false,
    configurable: false,
    writable: false,
  })
}

function resolveConfigInternal<const S extends Schema>(
  name: string | undefined,
  schema: S,
  options: ResolveConfigOptions,
): { config: ConfigOutput<S>; report: ConfigLoadReport } {
  const errors: string[] = []
  const fields: FieldMeta[] = []
  const reportFields: ConfigFieldReport[] = []
  const fileEnv = options.rootDir ? loadEnvFiles(options.rootDir) : { env: {}, sources: {} }
  const runtimeEnv = options.env ?? process.env

  function lookupValue(envName: string): { raw: string | undefined; source: string | undefined } {
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

  function walk(obj: Record<string, unknown>, path: string[]): Record<string, unknown> {
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
            reportFields.push(createFieldReport(fieldPath, field, "unset", undefined))
            continue
          }

          if (field.hasDefault) {
            result[key] = def.default
            reportFields.push(createFieldReport(fieldPath, field, "default", def.default))
            continue
          }

          result[key] = undefined
          reportFields.push(createFieldReport(fieldPath, field, "unset", undefined))
          continue
        }

        try {
          const value = coerce(raw, field.type, def.values)
          result[key] = value
          reportFields.push(createFieldReport(fieldPath, field, source ?? "process", value))
        } catch (msg) {
          errors.push(`${def.env}: ${msg}`)
          result[key] = undefined
          reportFields.push(createFieldReport(fieldPath, field, source ?? "process", raw))
        }
      } else {
        result[key] = walk(def as Record<string, unknown>, [...path, key])
      }
    }

    return result
  }

  const config = walk(schema as Record<string, unknown>, []) as ConfigOutput<S> & Record<string, unknown>

  if (errors.length > 0) {
    throw new ConfigError(errors)
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

export function defineConfig<const S extends Schema>(schema: S): ConfigOutput<S>
export function defineConfig<const S extends Schema>(name: string, schema: S): ConfigOutput<S>
export function defineConfig<const S extends Schema>(nameOrSchema: string | S, maybeSchema?: S): ConfigOutput<S> {
  const resolved = resolveNameAndSchema(nameOrSchema, maybeSchema)
  return resolveConfigInternal(resolved.name, resolved.schema, { env: process.env }).config
}

export function resolveConfig<const S extends Schema>(schema: S, options?: ResolveConfigOptions): {
  config: ConfigOutput<S>
  report: ConfigLoadReport
}
export function resolveConfig<const S extends Schema>(name: string, schema: S, options?: ResolveConfigOptions): {
  config: ConfigOutput<S>
  report: ConfigLoadReport
}
export function resolveConfig<const S extends Schema>(
  nameOrSchema: string | S,
  schemaOrOptions?: S | ResolveConfigOptions,
  maybeOptions?: ResolveConfigOptions,
): { config: ConfigOutput<S>; report: ConfigLoadReport } {
  if (typeof nameOrSchema === "string") {
    const resolved = resolveNameAndSchema(nameOrSchema, schemaOrOptions as S | undefined)
    return resolveConfigInternal(resolved.name, resolved.schema, maybeOptions ?? {})
  }

  return resolveConfigInternal(undefined, nameOrSchema, (schemaOrOptions ?? {}) as ResolveConfigOptions)
}
