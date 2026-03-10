/**
 * Port interfaces — generic repo tooling dependencies.
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
  readBytes(path: string): Uint8Array
  writeBytes(path: string, content: Uint8Array): void
  readDir(path: string): Array<{ name: string; isDirectory: boolean }>
  unlink(path: string): void
  rmdir(path: string): void
  mkdir(path: string): void
  rename(from: string, to: string): void
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

export type RepoPorts = {
  git: GitPort
  fs: FsPort
  process: ProcessPort
  glob: GlobPort
  tmpdir: () => string
  root: string
}
