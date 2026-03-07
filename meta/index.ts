/**
 * Dexter repo meta — composition root.
 *
 * Dogfoods @vladpazych/dexter's own createCLI framework.
 */

import { createCLI } from "@vladpazych/dexter/meta"
import { release } from "./commands/release.ts"

await createCLI({
  commands: {
    release,
  },
}).run()
