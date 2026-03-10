---
name: readme-md
description: Use when authoring or editing human-facing `README.md` files. Keeps them clear, present-tense, and oriented around purpose, usage, concepts, and navigation rather than governance.
---

# README Markdown

`README.md` files orient human readers. Write for someone new to the directory who needs to understand it, use it, or find the next file quickly.

## Rules

- Start with a title and one short intro paragraph.
- Prefer these top-level sections:
  `## Quick Start` for the most common commands or first actions.
  `## Concepts` for the mental model and key ideas.
  `## Structure` for the high-level file or package map.
  `## Development` for local workflows only when people will actively work here.
- Add other sections only when they create real orientation value.
- Omit empty sections.
- Keep the writing present-tense, direct, and compact.
- Explain what the directory or package is, why it exists, and how to use it.
- Prefer examples, commands, and entry points over internal history.
- Link to concrete local files or commands when they help navigation.
- Keep README content human-facing. Move normative rules and workflow mandates to `AGENTS.md`.
- Do not duplicate subtree governance, review protocol, or agent instructions in `README.md`.
- Do not inventory low-level implementation details that will go stale quickly.

## Content

- Describe the public surface, responsibilities, or main behaviors of the directory.
- Show the smallest useful command set for running, building, testing, or debugging when relevant.
- Explain the mental model behind `*.spec.ts` or other important local artifacts when that helps a new reader.
- Point to neighboring packages, entry files, or docs when they are the next place a reader should go.

## Shape

- Prefer short sections and flat bullets.
- Keep examples minimal and runnable.
- Cut repeated context the reader can infer from code or adjacent docs.
- Every section should reduce confusion for a first-time reader.

## Validation

- A new human reader can understand what this directory is for within a minute.
- The file improves orientation and usage, not policy enforcement.
- Removing a section would make the package or directory harder to understand or use.
