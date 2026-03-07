/**
 * Port interfaces — what control domain needs from the outside world.
 *
 * Adapters implement these. Domain functions accept ControlPorts.
 */

export type SpawnResult = { success: boolean; stdout: string; stderr: string }

export type GitPort = {
  run(args: string[], env?: Record<string, string>): SpawnResult
  checkIgnore(file: string): boolean
}

export type FsPort = {
  exists(path: string): boolean
  readFile(path: string): string
  writeFile(path: string, content: string): void
  readDir(path: string): Array<{ name: string; isDirectory: boolean }>
  unlink(path: string): void
  mkdir(path: string): void
}

export type ProcessHandle = {
  onLine(stream: "stdout" | "stderr", cb: (line: string) => void): void
  wait(): Promise<number | null>
}

export type ProcessPort = {
  spawn(params: {
    cmd: string
    args: string[]
    cwd: string
    env?: Record<string, string>
    timeout?: number
  }): ProcessHandle
}

export type GlobPort = {
  match(pattern: string, candidates: string[]): string[]
}

export type ControlPorts = {
  git: GitPort
  fs: FsPort
  process: ProcessPort
  glob: GlobPort
  tmpdir: () => string
  homedir: () => string
  root: string
}
