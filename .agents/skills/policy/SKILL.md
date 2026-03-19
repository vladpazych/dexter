---
name: policy
description: Create, edit, split, merge, move, or delete policy memory files such as `AGENTS.md` and `CLAUDE.md`. Use when an agent needs to add or refine durable governance rules, choose the right scope for policy guidance, or separate policy from workflows, plans, docs, and config.
---

# Policy Documents

Write for an agent about to act in this directory tree. Optimize for preload value: durable guidance, explicit boundaries, minimal tokens.

## First Test

Put a rule in a policy file only when it is:

- Stable across many tasks
- Important enough to load on every task in this scope
- Short enough to justify repeated context cost
- Instructional: changes behavior, not commentary

If any test fails, move it elsewhere.

## Placement

- Root policy files carry repo-wide working constraints: repo map, canonical commands, approval rules, package and directory boundaries, verification expectations, recurring gotchas, and mandatory skill triggers.
- Nested policy files carry local working constraints: subtree ownership, entry points, allowed dependency directions, local commands or checks, local failure modes, and local overrides.
- Skills carry workflows: step-by-step procedures, scripts to run, output formats, verification sequences.
- Plans, issues, PRs, and incident notes carry transient state: current tasks, debugging context, one-off migrations, temporary exceptions.
- README and architecture docs carry explanation for humans: usage, onboarding, long-form rationale, design background, examples.
- Config, roles, and scripts carry enforcement: sandbox rules, approval policy, automation, generators, codegen, permission boundaries.
- Verifiable software requirements belong in spec artifacts such as tests, contract checks, schema validation, and other executable or statically enforced checks, not in policy files.

## Policy Changes

- Use this skill for every creation, edit, move, split, merge, or deletion of a policy file.
- When tooling injects policy content as `AGENTS.md`, resolve the real on-disk policy file for that scope before editing. Prefer `CLAUDE.md` when the repo uses `CLAUDE.md` as the canonical policy file.
- Update policy only when durable working constraints have changed: ownership, boundaries, verification rules, approval rules, or recurring failure modes.
- Update policy when repeated agent mistakes show that a durable rule is missing, ambiguous, or in the wrong scope.
- Keep one-off task context, temporary exceptions, and active migration notes out of policy files.
- Policy edits require the same approval bar as spec changes. Get user approval before materially changing policy content or policy structure.

## Terms

- `Policy` governs how to work safely in a scope: allowed change shape, approvals, ownership, directory and package boundaries, verification rules, and recurring gotchas.
- `Spec` governs verifiable software requirements: tests, contract checks, schema validation, type-level guarantees, and other executable or statically enforced requirements.
- Treat tests as executable spec, not as a separate category.
- Keep directory and package constraints in policy even when they constrain code structure.
- Use `policy` for scoped working constraints and `spec` for verifiable software requirements. Do not use the terms interchangeably.

## Keep

- Rules that answer: what does this scope own, where do I act, what is allowed here, what must I avoid, what checks matter, and what gotchas can burn me.
- Canonical commands only when they are routinely relevant in this scope.
- Concrete boundaries: allowed dependencies, forbidden edges, generated-file rules, contract compatibility, write targets.
- Mandatory skill triggers as when-to-use rules, not duplicated workflow steps.
- Inline WHY only when it prevents a likely bad choice.

## Exclude

- Long procedures, branching checklists, or numbered workflows
- Architecture essays, philosophy, or onboarding prose
- Generic advice with no operational meaning
- Full skill instructions copied into policy files
- Current task state, temporary incidents, or sprint context
- Behavioral requirements or acceptance criteria that belong in verifiable spec artifacts
- Large code samples, exhaustive tables, or examples derivable from the codebase
- Current-state boundaries stated through migration or legacy framing
- Hard-control logic that really belongs in config or code

## Writing

- Use one house style for all policy files.
- Start with the shortest possible orientation line. Skip decorative framing.
- Lead with the highest-impact local truths.
- Use short declarative or imperative bullets.
- One bullet, one decision.
- Prefer positive defaults. Use prohibitions for true invariants and recurring failure modes.
- Repeat parent policy only when tightening or overriding it.
- Keep each governance rule in one canonical policy file or in clearly partitioned scopes.
- Use concrete file links or commands only when they anchor behavior.
- Keep sections small and scan-first. Omit empty sections.

## Subsections

- Top-level structure stays fixed: intro, `Rules`, `Structure`, optional `Verification`, `Gotchas`.
- Use `###` subsections inside a top-level section when they improve scanability for a dense cluster of related rules.
- Prefer subsections in `Rules` first. Keep other sections flat unless they also become dense.
- Use subsections to group durable rule families, not to create deep hierarchies.
- Keep one nesting level only: `##` and optional `###`.

## Examples and Code Blocks

- Policy files default to prose and bullets.
- Express the rule directly before reaching for an example.
- Use examples only as calibration for boundaries that remain ambiguous in direct prose.
- Keep examples minimal, local, and easy to remove once the rule is clear.
- Put commands in bullets first. Use fenced code blocks only when formatting is necessary for the command to stay correct and readable.
- Keep code snippets short and contract-focused.
- Rich examples, tutorials, workflows, and usage patterns belong in Skills, README, or supporting docs.

## LLM Voice

- Every line must earn its context cost through steering, grounding, calibrating, or shaping.
- Use imperative or declarative voice. Cut explanatory prose, meta-commentary, and hedging.
- Direct toward the desired behavior. Use prohibitions only for invariants and recurring failure modes.
- Add inline WHY only for non-obvious rules where the reason prevents a likely bad choice.
- Match the format to the output you want: terse policy in, terse policy out.
- Use examples or wrong/right pairs only when a boundary has proved ambiguous in practice.
- Let structure carry emphasis. Avoid shouting, filler, and emphasis words like `important` or `critical`.

## Intro

- Policy files are titleless and start with a short intro.
- Intro is exactly one short paragraph or 1-2 lines: what this scope is and what it optimizes for.
- Intro should frame the boundary, not teach the system. No history, migration narrative, marketing language, setup steps, or architecture essay.
- For nested policy files, prefer scope-specific intros over generic restatements of the parent package.
- Scope identity comes from the file path, not from a heading.

## Required Template

All policy files use this exact top-level shape and section order:

1. Intro
2. `Rules`
3. `Structure`
4. `Verification`
5. `Gotchas`

- `Rules` carries the durable working constraints. Put the highest-impact rules first.
- `Structure` names ownership, entry points, import boundaries, write targets, or file layout when those steer implementation.
- `Verification` carries non-mutating verification commands, required verification loops, and review gates for working in this scope.
- `Gotchas` carries non-obvious local failure modes that are still durable enough to preload.
- The intro carries scope and optimization directly.
- Include `Verification` only when the scope has meaningful local verification beyond inherited verification guidance.
- Top-level sections are `Rules`, `Structure`, optional `Verification`, and `Gotchas`.
- Omit empty sections.
- Normalize existing policy files to this template when they are edited.

## Root vs Nested

- Root files define what is globally true.
- Nested files define what changes here.
- Child files refine parent policy; they do not restate it.

## Validation

- A cold-start agent can answer: what do I own, where do I edit, what verification matters, and what is out of bounds.
- Every bullet earns its context cost.
- The writing is model-effective: direct, terse, and easy to generalize from.
- The file matches the house style exactly: intro, `Rules`, `Structure`, optional `Verification`, `Gotchas`.
- The file reads as governance, not documentation, workflow, or a task notebook.
- Removing any bullet would lose real steering.
