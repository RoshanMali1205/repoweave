{{! Replaces rw-bootstrap from the retired skills.json. Target: {{repo.prefix}}-bootstrap/SKILL.md. }}
---
name: {{repo.prefix}}-bootstrap
description: 'Review repository architecture and complete or refine the generated harness by writing .repoweave/semantic.json; fires on "bootstrap", "semantic review" or "refine the harness".'
---

# Bootstrap the harness

## Workflow

1. Read `.repoweave/BOOTSTRAP.md` and execute it.
2. Track inspected areas, actual conventions, unresolved questions and validation in `.repoweave/review-notes.md`.
3. Record verified facts in `.repoweave/semantic.json` (schema: `.repoweave/semantic.schema.json`).
4. Ask the user to rerun RepoWeave Preview, review the diff and Apply.

Use `{{repo.prefix}}-harness-builder` when available.

## Constraints

- Preserve application source and existing user rules.
- Never store credentials in semantic.json.

## Output format

Areas reviewed, fields written, remaining unknowns, next step.

## Related files

- `{{repo.prefix}}-harness-builder`
