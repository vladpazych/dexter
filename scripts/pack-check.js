import { spawnSync } from "node:child_process"
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

function run(cmd, options) {
  const [executable, ...args] = cmd
  const result = spawnSync(executable, args, {
    cwd: options.cwd,
    env: {
      ...process.env,
      ...options.env,
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })

  if (result.status === 0) {
    return
  }

  throw new Error(
    [
      `Command failed: ${cmd.join(" ")}`,
      `cwd: ${options.cwd}`,
      result.stdout ?? "",
      result.stderr ?? "",
    ]
      .filter((line) => line.length > 0)
      .join("\n"),
  )
}

function runJson(cmd, options) {
  const [executable, ...args] = cmd
  const result = spawnSync(executable, args, {
    cwd: options.cwd,
    env: {
      ...process.env,
      ...options.env,
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })

  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${cmd.join(" ")}`,
        `cwd: ${options.cwd}`,
        result.stdout ?? "",
        result.stderr ?? "",
      ]
        .filter((line) => line.length > 0)
        .join("\n"),
    )
  }

  return JSON.parse(result.stdout)
}

function main() {
  const workspaceRoot = process.cwd()
  const sandboxRoot = mkdtempSync(join(tmpdir(), "rig-pack-check-"))
  const repoCopy = join(sandboxRoot, "repo")
  const consumerRoot = join(sandboxRoot, "consumer")

  try {
    cpSync(workspaceRoot, repoCopy, {
      recursive: true,
      filter(source) {
        const relative = source.slice(workspaceRoot.length).replace(/^\//, "")

        if (relative.length === 0) {
          return true
        }

        if (
          relative === ".git" ||
          relative.startsWith(".git/") ||
          relative === ".package-lock.bad.json" ||
          relative.startsWith(".package-lock.") ||
          relative === ".package-lock.before-tsx.json" ||
          relative === ".node_modules-bun-backup" ||
          relative.startsWith(".node_modules-bun-backup/") ||
          relative === ".node_modules-npm-bad" ||
          relative.startsWith(".node_modules-npm-bad/") ||
          relative === ".node_modules-tsx-before-install" ||
          relative.startsWith(".node_modules-tsx-before-install/") ||
          relative.startsWith(".node_modules") ||
          relative === "node_modules" ||
          relative.startsWith("node_modules/") ||
          relative === ".test-build" ||
          relative.startsWith(".test-build/") ||
          relative === "packages/rig/dist" ||
          relative.startsWith("packages/rig/dist/") ||
          relative === "packages/rig-logger-sinks/dist" ||
          relative.startsWith("packages/rig-logger-sinks/dist/") ||
          relative.endsWith(".tgz")
        ) {
          return false
        }

        return true
      },
    })

    cpSync(
      join(workspaceRoot, "node_modules"),
      join(repoCopy, "node_modules"),
      {
        recursive: true,
      },
    )

    run(["npm", "run", "version-packages"], {
      cwd: repoCopy,
      env: {
        GITHUB_TOKEN: "local-pack-check",
      },
    })

    const rigPackageRoot = join(repoCopy, "packages", "rig")
    const sinksPackageRoot = join(repoCopy, "packages", "rig-logger-sinks")
    const [rigPack] = runJson(["npm", "pack", "--json"], {
      cwd: rigPackageRoot,
    })
    const [sinksPack] = runJson(["npm", "pack", "--json"], {
      cwd: sinksPackageRoot,
    })

    if (rigPack === undefined || sinksPack === undefined) {
      throw new Error("Expected npm pack to return tarball metadata")
    }

    mkdirSync(consumerRoot, { recursive: true })
    writeFileSync(
      join(consumerRoot, "package.json"),
      JSON.stringify(
        {
          name: "pack-check-consumer",
          private: true,
          type: "module",
          dependencies: {
            "@vladpazych/rig": `file:${resolve(
              rigPackageRoot,
              rigPack.filename,
            )}`,
            "@vladpazych/rig-logger-sinks": `file:${resolve(
              sinksPackageRoot,
              sinksPack.filename,
            )}`,
          },
        },
        null,
        2,
      ),
    )

    writeFileSync(
      join(consumerRoot, "smoke.mjs"),
      [
        'import { logger, process as rigProcess, terminal } from "@vladpazych/rig"',
        'import { consoleSink, fileSink, streamSink } from "@vladpazych/rig-logger-sinks"',
        "",
        "const log = logger.with({",
        '  name: "pack-check",',
        "  sinks: [",
        '    streamSink({ stream: process.stdout, format: "json" }),',
        "    consoleSink({ color: false }),",
        '    fileSink({ path: ".tmp/pack-check.log", format: "json" }),',
        "  ],",
        "})",
        "",
        'log.info("packed import ok", {',
        '  green: terminal.colors.green("ok"),',
        '  command: (await rigProcess.run({ cmd: process.execPath, args: ["--version"] })).exitCode,',
        "})",
        "",
      ].join("\n"),
    )

    run(["npm", "install"], { cwd: consumerRoot })
    run(["node", "smoke.mjs"], { cwd: consumerRoot })
  } finally {
    rmSync(sandboxRoot, { recursive: true, force: true })
  }
}

main()
