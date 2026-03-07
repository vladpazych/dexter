# CLAUDE.md Files

CLAUDE.md auto-loads when any file in its directory tree is read. It primes interpretation before code is seen.

## What it is

Specification the codebase must satisfy. Not documentation of what code does.

## Content rules

- Prescriptive constraints (MUST/NEVER), not descriptions
- Most important rules first (primes all subsequent interpretation)
- No examples derivable from reading the code
- No duplication of parent CLAUDE.md rules (children inherit)
- Every token loaded on first file access in directory — minimize

## Template

Sections optional. Order fixed.

1. Purpose (one line)
2. Rules (all rules — invariants, workflow, settled choices. Rationale inline as WHY clauses)
3. Structure (directory layout, isolation, import restrictions)
4. Gotchas (non-obvious traps where failure modes aren't obvious from the rules)

Attractor lines between purpose and first section prime design philosophy — loaded terms that steer output quality.

Sub-sections (`###`) within any section group related rules by topic — not by category. Keeps long lists scannable.

## Anti-patterns

- Describing what code does (code is truth)
- API usage examples (that's README.md)
- Lengthy code samples (agent reads the source)
- Repeating parent-level rules
- Tutorials or onboarding prose
