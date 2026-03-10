import { existsSync } from "node:fs"
import { join } from "node:path"

import { createJiti } from "jiti"

import { version } from "@vladpazych/dexter"
import { createCLI, findRepoRoot, type CLIConfig } from "@vladpazych/dexter/cli"
import { loadEnv } from "@vladpazych/dexter/env"

const SUPPORTED_CONFIG_FILES = [
  "dexter.config.ts",
  "dexter.config.js",
  "dexter.config.mts",
  "dexter.config.mjs",
] as const

function applyRuntimeEnv(root: string): void {
  const loaded = loadEnv(root)

  for (const [key, value] of Object.entries(loaded.env)) {
    if (!key.startsWith("META_")) {
      continue
    }

    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

function findRepoConfigPath(root: string): string | undefined {
  for (const filename of SUPPORTED_CONFIG_FILES) {
    const configPath = join(root, filename)
    if (existsSync(configPath)) {
      return configPath
    }
  }

  return undefined
}

async function loadRepoConfig(root: string): Promise<CLIConfig> {
  applyRuntimeEnv(root)
  const configPath = findRepoConfigPath(root)
  if (configPath === undefined) {
    const supported = SUPPORTED_CONFIG_FILES.join(", ")
    throw new Error(`error: no dexter config found in repo root. Supported files: ${supported}`)
  }

  const jiti = createJiti(import.meta.url)
  const config = await jiti.import(configPath, { default: true })

  if (config === undefined || config === null || typeof config !== "object") {
    throw new Error(`error: ${configPath} must default-export a dexter config`)
  }

  return config as CLIConfig
}

function printGlobalHelp(): void {
  console.log(`dexter v${version} — self-describing repo commands

Usage: dexter <command...>

Global commands:
  version    Print version
  help       Show help

Dexter loads dexter.config.*, reads the exported config, and runs repo commands from there.`)
}

export async function runDexter(argv: string[] = process.argv.slice(2)): Promise<number> {
  const [cmd] = argv

  switch (cmd) {
    case "version":
    case "--version":
    case "-v":
      console.log(version)
      return 0
  }

  let root: string
  try {
    root = findRepoRoot()
  } catch {
    if (cmd === undefined || cmd === "help" || cmd === "--help" || cmd === "-h") {
      printGlobalHelp()
      return 0
    }
    console.error("error: not in a git repository")
    return 1
  }

  try {
    const config = await loadRepoConfig(root)
    return await createCLI(config).run(argv)
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    return 1
  }
}

if (import.meta.main) {
  process.exitCode = await runDexter()
}
