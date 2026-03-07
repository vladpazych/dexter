# README.md

Human-facing vision. Answers: why does this exist, who is it for, where is it going.

---

# RELATIONSHIP TO CLAUDE.md

| CLAUDE.md | README.md |
|:----------|:----------|
| Agent-facing law | Human-facing vision |
| What must be true | Why this exists |
| Auto-loads on file touch | Read on demand |
| Constraints, boundaries | Context, motivation, roadmap |

README never duplicates CLAUDE.md. README never contains spec or constraints.

---

# CONTENT

Three sections. Omit Roadmap only if genuinely nothing is planned.

1. **Title + purpose** — Package name. One sentence: what this is and why.
2. **Context** — Who needs this, what problem it solves, why it exists as a separate package. Two to four sentences of business motivation.
3. **Roadmap** — Ideas and future directions. Bullet list. Not commitments — captured for discussion.

Root README additionally includes Setup (prerequisites, install, run) — the one thing a human cloning the repo genuinely needs.

---

# CALIBRATION

| Wrong | Right |
|:------|:------|
| Code examples with imports | Business context in prose |
| File tree diagrams | Motivation for why the package exists |
| CLI command tables | Roadmap bullets |
| Route tables, API shapes | Who uses this and why |
| "When to use" decision tables | One sentence purpose |

---

# TEMPLATE

```markdown
# Name

One sentence: what this is and why.

## Context

Who needs this. What problem it solves. Why it exists as a separate package.

## Roadmap

- Idea one (brief rationale)
- Idea two (brief rationale)
```

---

# CUT LIST

| Cut | Reason |
|:----|:-------|
| Setup instructions (except root) | Discoverable from scripts |

---

# VALIDATION

- Purpose clear in one sentence
- Context explains business motivation, not technical implementation
- Roadmap present (unless genuinely nothing planned)
- No duplication of CLAUDE.md content
