# Dexter

Dexter is a Bun monorepo for building self-describing repo CLIs. This repository contains the published `@vladpazych/dexter` package, the private workspace packages it uses for its own dogfooded CLI, and the source for the `dexter` command itself.

## Quick Start

Install workspace dependencies:

```sh
~/.bun/bin/bun install
```

Typecheck the published package:

```sh
~/.bun/bin/bun run --cwd packages/dexter typecheck
```

Run the package test suite:

```sh
~/.bun/bin/bun test packages/dexter/test
```

Inspect the repo's own Dexter commands:

```sh
packages/dexter/bin/dexter help
```

For package-level usage and installation in another repo, start with [packages/dexter/README.md](packages/dexter/README.md).

## Concepts

Dexter treats a repo CLI as source code, not as a pile of shell scripts.

- A repo defines its command surface in [`dexter.config.ts`](dexter.config.ts).
- Leaf commands declare their own description, args, options, and runtime behavior.
- The published package exposes small, typed subpaths such as `@vladpazych/dexter/cli`, `env`, `pipe`, `terminal`, `spec`, and `skills`.
- This repo uses Dexter to run its own internal release workflow from [`meta/commands/release.ts`](meta/commands/release.ts).

If you found this project through search and want to understand the library first, the main package lives in [`packages/dexter`](packages/dexter). If you want to understand how the monorepo itself is wired, start at [`dexter.config.ts`](dexter.config.ts) and then follow the private packages under [`meta`](meta).

## Structure

- [`packages/dexter`](packages/dexter) is the published package. It contains the runtime, subpath exports, CLI entrypoint, and package tests.
- [`meta/config`](meta/config) is the private shared config package for ESLint and TypeScript presets used in this repo.
- [`meta/commands`](meta/commands) is the private command package consumed by the root Dexter config.
- [`dexter.config.ts`](dexter.config.ts) is the repo's composition root for its own CLI.

## Development

This monorepo stays intentionally small. Most work happens in `packages/dexter`, with the root package acting as a thin workspace orchestrator.

- Use Bun for install, test, and typecheck workflows.
- Keep package-facing docs in [`packages/dexter/README.md`](packages/dexter/README.md).
- Keep repo-local command implementations in [`meta/commands`](meta/commands), not in the root config file.
