# Human Audience

Terse prose for scanning. Not documentation, not tutorial.

---

# VOICE

Declarative over explanatory. First person plural when natural.

| Do | Don't |
|:---|:------|
| "Mux handles what we shouldn't build: transcoding, streaming, CDN." | "This package provides a wrapper around the Mux API for video hosting." |
| "Exists as a separate lib because multiple services need caching." | "The cache library was extracted to allow reuse across services." |

---

# STALENESS

Contains nothing that drifts during daily development. Stale in two weeks -> belongs in code or CLAUDE.md.

---

# CUT LIST

| Cut | Reason |
|:----|:-------|
| Code examples, imports | Drift daily — read the source |
| File trees, architecture diagrams | Drift on refactor — CLAUDE.md governs structure |
| CLI commands, route tables | Drift on feature work — discoverable from code |
| Type definitions, API shapes | IDE provides — types are the spec |
| Badges, shields | Vanity metrics |
| "This package..." | Subject obvious from heading |

---

# VALIDATION

- Scannable in 10 seconds
- Zero code examples, file trees, or CLI commands
- Nothing that would go stale in two weeks
- Business motivation over technical implementation
