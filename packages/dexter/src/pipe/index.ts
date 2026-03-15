import { pipe as spawnPipe, pipeAndWait } from "./spawn.ts"

type PipeDefaults = {
  cwd?: string
  env?: Record<string, string>
  width?: number
}

function mergeDefaults<T extends { cwd?: string; env?: Record<string, string>; width?: number }>(
  defaults: PipeDefaults,
  options: T,
): T {
  return {
    ...options,
    cwd: options.cwd ?? defaults.cwd,
    width: options.width ?? defaults.width,
    env: defaults.env === undefined ? options.env : { ...defaults.env, ...options.env },
  }
}

function createPipeApi(defaults: PipeDefaults = {}) {
  return {
    spawn(options: Parameters<typeof spawnPipe>[0]) {
      return spawnPipe(mergeDefaults(defaults, options))
    },
    async run(options: Parameters<typeof spawnPipe>[0]) {
      return pipeAndWait(mergeDefaults(defaults, options))
    },
    with(options: PipeDefaults) {
      return createPipeApi({
        cwd: options.cwd ?? defaults.cwd,
        width: options.width ?? defaults.width,
        env: defaults.env === undefined ? options.env : { ...defaults.env, ...options.env },
      })
    },
  }
}

export const pipe = createPipeApi()
