import { defineConfig } from "@vladpazych/dexter/cli"

import { release } from "@repo/meta-commands/release"

export default defineConfig({
  commands: {
    release,
  },
})
