# LLM Audience

Instructions for agents. Every token serves a function or gets cut.

Four token functions:

| Type | Function | Example |
|:-----|:---------|:--------|
| Steering | Constrains behavior | "Commit after each step." |
| Grounding | Communicates intent so model generalizes | "Codebase splits for testability. Keep functions under 20 lines." |
| Calibrating | Wrong/right pair shows a boundary | `WRONG: sheet['B10'] = 5000` / `RIGHT: sheet['B10'] = '=SUM(B2:B9)'` |
| Shaping | Format, structure, output template | The template block at the end of a skill |

Cut tokens that serve none of these functions.

---

# MODEL MECHANICS

| Mechanism | Implication |
|:----------|:------------|
| Attention backward only | Earlier context shapes later output. Put important info first. |
| Next-token prediction | Plausible continuations, not verified truth |
| Pattern matching | Prompt format directly influences output format |
| Context is finite | More tokens != better results. Minimal high-signal set. |

Opus specifics:
- Literal instruction following. Takes you exactly at your word.
- Vagueness not rescued. Requires explicit direction.
- Responsive to structure over emphasis.
- Overengineering tendency. Requires simplicity constraints.
- Overtriggers on aggressive language that older models needed. Dial back.

---

# CORE PRINCIPLE

Direct toward, not away from.

| Do | Don't |
|:---|:------|
| "Use flowing prose" | "Don't use markdown" |
| "Return JSON with fields: x, y" | "Avoid returning plain text" |
| "Write 2-3 sentences" | "Don't write long paragraphs" |

Forbidding leaves the model guessing. Directing specifies the target.

Exception: name recurring failure modes explicitly ("Never use Inter" after observing the model defaults to Inter). This is calibration, not prohibition.

---

# VOICE

Imperative or declarative. Not explanatory.

| Do | Don't |
|:---|:------|
| "Commit after each step." | "You should commit after each step." |
| "Use `git revert`, not reset." | "Avoid using reset when possible." |

---

# CONTEXT

Inline WHY for non-obvious rules. Structure-as-WHY for organizational grouping.

| Without grounding | With grounding |
|:------------------|:---------------|
| "Keep functions under 20 lines." | "Codebase splits for testability. Keep functions under 20 lines." |
| "Never use ellipses." | "Output is read by TTS. Never use ellipses." |

The model generalizes from intent, not from agreement. One clause is enough.

---

# FORMAT MATCHING

Prompt format influences output format.

Terse bullets -> terse responses.
Verbose prose -> verbose responses.
Structured sections -> structured output.

Match the style you want to receive.

---

# EMPHASIS

Structure shows importance. Caps and bold are noise for Opus.

| Before | After |
|:-------|:------|
| `CRITICAL: You MUST always...` | `Always...` |
| `IMPORTANT: Never forget...` | `Never...` |

Reserve MUST/NEVER for actual invariants. See ESCALATION for when to break this default.

---

# ESCALATION

Default: terse constraint, imperative voice. Escalate on observed failure, not preemptively.

| Failure mode | Escalation |
|:-------------|:-----------|
| Model follows rule literally but misses intent | Add inline WHY clause (one sentence, fused to constraint) |
| Model consistently misinterprets a boundary | Add one wrong/right example pair |
| Model bleeds behavior across sections | Use XML tags or markdown headers for isolation |
| Model forgets a constraint mid-conversation | Repeat the constraint at top AND relevant section |
| Model over/undertriggers a behavior | Adjust trigger specificity in description |
| Model produces generic "AI slop" output | Name the specific failure modes to avoid (anti-slop list) |

Each rung costs tokens. Escalate only when the simpler level fails.

---

# CUT LIST

| Cut | Reason |
|:----|:-------|
| Rationale paragraphs that argue or justify | Model generalizes from intent clauses, not from agreement |
| "important", "critical" (as emphasis) | Structure shows importance |
| "try to", "consider" | Weakens activation |
| "as you work", "when done" | Zero signal filler |
| Meta-commentary | Omit references to the reader |
| Explanations derivable from context | Already loaded via CLAUDE.md or code |

Keep: inline WHY clauses that communicate intent the model needs to generalize from.

---

# VALIDATION

- Every token serves a function (steering, grounding, calibrating, shaping)
- Directs toward desired behavior (not away from undesired)
- Non-obvious rules include inline WHY
- Format matches desired output style
- No hedging, no shouting, no meta-commentary
- Escalation applied only where default failed, not preemptively
