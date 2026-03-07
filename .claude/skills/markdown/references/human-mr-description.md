# MR Description

Human-facing change summary. Answers: what changed, why, what's the scope.

---

# OUTPUT

Write to `.local/notes-<branch>-<N>.md` where:
- `<branch>` = current git branch with `/` replaced by `-` (e.g. `fix/sous-integration` -> `fix-sous-integration`)
- `<N>` = next incremental number (check existing files, start at 1)

---

# CONTENT

Three parts. All required.

1. **Opening paragraph** — Dense summary covering every logical change. Active verbs. Two to four sentences. Chain clauses with commas and conjunctions. Reader grasps full scope without scrolling.
2. **Changes sections** — Numbered subsections under `## Changes`, one per logical change area. Each has context paragraph, scope, and optional spec reference.
3. **Summary section** — `## Summary` after Changes. Strict one-liner bullet list for posting in internal release notes channel. Each bullet = one logical change, imperative verb, no detail.

---

# GROUPING

One section per logical change, not per commit. Related commits merge into one section.

| Merge into one section | Split into separate sections |
|:-----------------------|:----------------------------|
| Spec + implementation + tests for same change | Independent features with separate motivations |
| Related micro-fixes in same area | Changes to unrelated subsystems |
| Dead code removal across related files | Refactor prerequisite vs the feature using it |

---

# STRUCTURE

### Opening paragraph

Active verbs. No meta-reference ("this PR adds..."). Cover ALL section topics in miniature so a reader grasps full scope without scrolling.

### Separator

`---`

### Numbered sections

`## Changes` heading, then:

```
### N. Title

What existed before. What changed. Why. Technical detail a reviewer needs to evaluate the change.

**Scope:** `paths/`
**Spec:** `path/to/CLAUDE.md` (section) — when a spec covers this area
```

### Summary

`## Summary` after the last Changes section. One bullet per logical change. Imperative verb, no context, no scope. Meant for copy-pasting into a release notes channel.

```
## Summary

- Add cookie isolation middleware
- Remove legacy secret migration
- Fix accessToken guard for BA-only sessions
- Add MongoDB indexes for session enrichment
```

---

# CALIBRATION

| Wrong | Right |
|:------|:------|
| "This PR adds..." | "Adds..." (no meta-reference) |
| "We decided to..." | "Cookie isolation prevents cross-app leakage." (declarative) |
| "This greatly improves..." | "Eliminates stale data on assignment change." (factual) |
| Bullet list changelog | Prose paragraphs with context |
| One section per commit | One section per logical change |
| Scope line with no context paragraph | Context paragraph first, scope at end |
| Restating commit messages | Synthesizing motivation and impact |

---

# TEMPLATE

```markdown
Opening paragraph: dense summary, active verbs, all changes covered.

---

## Changes

### 1. Title

Context: what existed before. What changed. Why. Technical detail.

**Scope:** `path/to/affected/`
**Spec:** `path/to/CLAUDE.md` (relevant section)

### 2. Title

...

## Summary

- Imperative one-liner for change 1
- Imperative one-liner for change 2
```

---

# VALIDATION

- Written to `.local/notes-<branch>-<N>.md`
- Opening paragraph covers every section topic
- Active verbs, no meta-references ("this PR", "this MR")
- One section per logical change, not per commit
- Every section has context paragraph (not just scope)
- Scope present on every section
- Spec referenced when CLAUDE.md exists for the area
- Summary section present with one-liner bullets
- Summary bullets match Changes sections 1:1
- No changelog bullet format in Changes (prose paragraphs)
- No selling language
