---
name: markdown
description: "Markdown authoring. CLAUDE.md, README, specs. NOT: code, config, plan files."
---

# Markdown

Every document has an audience and a category. Category determines audience — they don't vary independently.

## Categories

| Audience | Category | File |
|:---------|:---------|:-----|
| llm | claude-md | CLAUDE.md |
| llm | skill | SKILL.md |
| human | readme | README.md |
| human | mr-description | MR/PR body |
| human | research | *.md (standalone) |

## Process

1. Identify category from filename or context.
2. Read `references/<audience>-voice.md` — voice and token economy for this reader.
3. Read `references/<audience>-<category>.md` if it exists — structure and content rules for this document type.
4. Write. Apply voice reference always; apply category reference when present.
5. Validate against voice checklist always; category checklist when present.
