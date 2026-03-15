# Dexter

Tiny primitives for repo-level tooling.

```ts
import { env, files, pipe, terminal } from "@vladpazych/dexter"
```

Dexter no longer owns a CLI runtime. Consumer repos write normal local scripts under `scripts/` and expose them through `package.json`.

## What Stays

- Typed env loading and inspection
- Process spawning with structured log piping
- File collection around a target path
- Small terminal color and ANSI helpers

## This Repo

This repo now uses a normal local script for release work:

```json
{
  "scripts": {
    "bump": "bun run scripts/release.ts"
  }
}
```

Start here:

- Package docs: [packages/dexter/README.md](packages/dexter/README.md)
- Local scripts: [scripts](scripts)
- Published source: [packages/dexter/src](packages/dexter/src)
