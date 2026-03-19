# @vladpazych/rig-logger-sinks

`@vladpazych/rig-logger-sinks` provides standard sinks for Rig's runtime-agnostic `logger`. It targets Node and uses filesystem and writable stream APIs for local sink destinations.

## Quick Start

```sh
npm install --save-dev @vladpazych/rig @vladpazych/rig-logger-sinks
```

```ts
import { logger } from "@vladpazych/rig"
import { consoleSink } from "@vladpazych/rig-logger-sinks"

const log = logger.with({
  name: "release",
  sinks: [consoleSink()],
})

log.info("Starting release", { version: "1.0.0" })
```

## Concepts

- The core `logger` lives in `@vladpazych/rig`.
- This package provides standard sinks only.
- `streamSink` is the primitive sink.
- `consoleSink` and `fileSink` add common destinations and built-in `pretty` / `json` formatting.
- `consoleSink()` stays plain by default for non-interactive streams; pass `color: true` to force ANSI output.

## API

```ts
streamSink(options)
consoleSink(options?)
fileSink(options)
```

Available sink options:

- `level`: sink-level minimum log level
- `format`: `"pretty"` or `"json"`
- `formatter`: custom formatter override
- `lineEnding`: output line ending

Example with both console and file output:

```ts
import { logger } from "@vladpazych/rig"
import { consoleSink, fileSink } from "@vladpazych/rig-logger-sinks"

const log = logger.with({
  name: "release",
  sinks: [
    consoleSink({ format: "pretty" }),
    fileSink({
      path: ".rig/release.ndjson",
      format: "json",
    }),
  ],
})

log.info("Publishing package", { version: "1.0.0" })
```

## Runtime

`@vladpazych/rig-logger-sinks` 1.x targets Node `>=22.0.0` and uses local writable streams and filesystem APIs for sink destinations.

## Development

```sh
npm run release:check
```
