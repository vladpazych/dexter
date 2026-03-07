/**
 * Dexter repo meta — composition root.
 *
 * Dogfoods @vladpazych/dexter's own createCLI framework.
 * No custom commands yet — just core commands and hooks.
 */

import { createCLI } from "@vladpazych/dexter/meta"

await createCLI({}).run()
