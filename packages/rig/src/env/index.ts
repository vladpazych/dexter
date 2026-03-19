import {
  loadEnvConfig,
  inspectEnvConfig,
  type EnvConfig,
  type EnvLoadReport,
  type EnvOptions,
  type EnvSchema,
} from "./define.js"
import { formatConfig, printConfig } from "./print.js"

type EnvContext = Pick<EnvOptions, "env" | "name">

type EnvInspection<S extends EnvSchema> = {
  config: EnvConfig<S>
  report: EnvLoadReport
}

function mergeOptions(base: EnvContext, next: EnvOptions = {}): EnvOptions {
  return {
    env: next.env ?? base.env,
    name: next.name ?? base.name,
  }
}

function createEnvApi(base: EnvContext = {}) {
  return {
    load<const S extends EnvSchema>(
      schema: S,
      options: EnvOptions = {},
    ): EnvConfig<S> {
      return loadEnvConfig(schema, mergeOptions(base, options))
    },
    inspect<const S extends EnvSchema>(
      schema: S,
      options: EnvOptions = {},
    ): EnvInspection<S> {
      return inspectEnvConfig(schema, mergeOptions(base, options))
    },
    format(config: unknown, name?: string): string {
      return formatConfig(config, name)
    },
    print(config: unknown, name?: string): void {
      printConfig(config, name)
    },
    with(options: EnvContext) {
      return createEnvApi({
        env: options.env ?? base.env,
        name: options.name ?? base.name,
      })
    },
  }
}

export const env = createEnvApi()
