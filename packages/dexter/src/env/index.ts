import {
  loadEnvConfig,
  inspectEnvConfig,
  type EnvConfig,
  type EnvLoadReport,
  type EnvOptions,
  type EnvSchema,
} from "./define.ts"
import { applyEnv, loadEnv, parseEnvFile, type LoadResult } from "./loader.ts"
import { formatConfig, printConfig } from "./print.ts"

type EnvContext = Pick<EnvOptions, "env" | "root">

type EnvInspection<S extends EnvSchema> = {
  config: EnvConfig<S>
  report: EnvLoadReport
}

function mergeOptions(base: EnvContext, next: EnvOptions = {}): EnvOptions {
  return {
    root: next.root ?? base.root,
    env: next.env ?? base.env,
    name: next.name,
  }
}

function createEnvApi(base: EnvContext = {}) {
  return {
    load<const S extends EnvSchema>(schema: S, options: EnvOptions = {}): EnvConfig<S> {
      return loadEnvConfig(schema, mergeOptions(base, options))
    },
    inspect<const S extends EnvSchema>(schema: S, options: EnvOptions = {}): EnvInspection<S> {
      return inspectEnvConfig(schema, mergeOptions(base, options))
    },
    apply(values: Record<string, string>): void {
      applyEnv(values)
    },
    parseFile(path: string): Record<string, string> {
      return parseEnvFile(path)
    },
    read(root: string): LoadResult {
      return loadEnv(root)
    },
    format(config: unknown, name?: string): string {
      return formatConfig(config, name)
    },
    print(config: unknown, name?: string): void {
      printConfig(config, name)
    },
    with(options: EnvContext) {
      return createEnvApi({
        root: options.root ?? base.root,
        env: options.env ?? base.env,
      })
    },
  }
}

export const env = createEnvApi()
