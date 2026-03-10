---
name: dexter
description: Use when a user wants to add or modify a Dexter-powered repo CLI, author `dexter.config.ts`, define commands or namespaces, use `ctx.loadEnv()`, or consume `@vladpazych/dexter/{cli,env,pipe,terminal}` correctly.
---

# Dexter

Use this skill when working in a consumer repo that uses Dexter as its internal CLI runtime.

## Workflow

1. Start from the current public contract in `packages/dexter/README.md`.
2. Author the repo entrypoint as root `dexter.config.ts` and import from `@vladpazych/dexter/cli`.
3. Keep command implementation in ordinary repo files such as `meta/commands/*.ts`. Do not treat `meta/` as magic.
4. Model leaf commands with `command({ description, args, options, run, renderCli? })`.
5. Model groups as namespaces with `{ description, commands }`. Use namespaces to hide deep command surfaces from top-level help.
6. Use Zod schemas for args and options. Prefer typed coercion like `z.coerce.number()` over manual parsing.
7. Use `ctx.loadEnv()` inside commands for command-scoped env loading. That gives typed values plus masked env reporting in CLI and JSON output.
8. Reserve implicit `.env` loading for `META_` variables used before `dexter.config.*` is imported.
9. Use `@vladpazych/dexter/env`, `@vladpazych/dexter/pipe`, and `@vladpazych/dexter/terminal` only when the task actually needs those primitives.
10. Read `references/authoring.md` when you need examples, output behavior, or feature-level guidance.

## Rules

- Default to `dexter.config.ts` even though `.js`, `.mts`, and `.mjs` are also supported.
- Default to `@vladpazych/dexter/cli`. Do not use the removed `@vladpazych/dexter/meta` import path.
- Keep CLI output simple. Only add `renderCli()` when the default string or JSON fallback is not enough.
- Prefer namespace help and discovery patterns already supported by Dexter: `dexter help`, `dexter help <path>`, and `dexter <path> --help`.
- When writing consumer docs or examples, show the root config contract and ordinary implementation folders separately.
