---
name: agents-md
description: Use when authoring or editing directory-scoped `AGENTS.md` files. Keeps them terse, normative, and structurally consistent - no title or intro prose, prefer `General`, `Structure`, and `Constraints`, and write for a cold-start agent.
---

# Agents Markdown

`AGENTS.md` files govern a directory tree. Write for an agent choosing actions, not for a human browsing docs.

## Rules

- Do not add a title or intro paragraph to the authored `AGENTS.md` file.
- Prefer these top-level sections:
  `## General` for local behavior and decision rules.
  `## Structure` for ownership, entry points, and file layout.
  `## Constraints` for invariants, exclusions, and recurring failure modes.
- Add other sections only when they create real steering value.
- Omit empty sections.
- State settled local constraints and conventions only.
- Put the highest-impact rules first.
- Use imperative or declarative sentences. No hedging.
- Direct toward desired behavior. Use prohibitions only for true invariants or recurring failure modes.
- Write for a cold-start agent. Present the current boundary directly instead of referring to removed history or prior designs.
- Avoid legacy wording like `reintroduce`, `still`, `no longer`, or any rule that assumes prior repo context.
- Add inline WHY only when the rule is non-obvious.
- Keep tokens tight. Cut rationale, onboarding, history, and examples derivable from code.
- Make boundaries explicit: what this subtree owns, what it must preserve, what stays out of scope.
- Link to concrete local files or commands when they anchor behavior.
- Do not repeat parent `AGENTS.md` rules unless this subtree intentionally tightens them.

## Content

- Describe how local `*.spec.ts` files should be named and what they cover when that matters in this subtree.
- Record mandatory commands or review loops only when they are true requirements here.
- Keep product direction, brainstorming, and implementation detail out of `AGENTS.md`.

## Shape

- Prefer flat bullets under the chosen sections.
- Every bullet should change behavior.

## Validation

- A coder working only in this subtree can act from this file.
- The file reads as governance, not documentation.
- Removing any bullet would lose real steering.
