import { pipe as spawnPipe, pipeAndWait } from "./spawn.ts"
import type { PipeSpawnOptions } from "./types.ts"

type PipeDefaults = {
  cwd?: string
  env?: Record<string, string>
  width?: number
}

function mergeDefaults<T extends PipeSpawnOptions>(
  defaults: PipeDefaults,
  options: T,
): T {
  return {
    ...options,
    cwd: options.cwd ?? defaults.cwd,
    width: options.width ?? defaults.width,
    env:
      defaults.env === undefined
        ? options.env
        : { ...defaults.env, ...options.env },
  }
}

function createPipeApi(defaults: PipeDefaults = {}) {
  return {
    spawn(options: PipeSpawnOptions) {
      return spawnPipe(mergeDefaults(defaults, options))
    },
    async exec(options: PipeSpawnOptions) {
      return pipeAndWait(mergeDefaults(defaults, options))
    },
    with(options: PipeDefaults) {
      return createPipeApi({
        cwd: options.cwd ?? defaults.cwd,
        width: options.width ?? defaults.width,
        env:
          defaults.env === undefined
            ? options.env
            : { ...defaults.env, ...options.env },
      })
    },
  }
}

export const pipe = createPipeApi()

export type { PipeHandle, PipeResult, PipeSpawnOptions } from "./types.ts"
