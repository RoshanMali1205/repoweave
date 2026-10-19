{{! Replaces the bootstrap-harness task of the retired generator task list. Target: {{repo.prefix}}-bootstrap-harness.prompt.md. }}
---
description: "Complete the semantic architecture review and record it in .repoweave/semantic.json so the harness can be regenerated."
agent: {{repo.prefix}}-harness-builder
---

Read `.repoweave/BOOTSTRAP.md` and complete the semantic architecture review for {{project.name}}. Record verified facts in `.repoweave/semantic.json` following `.repoweave/semantic.schema.json`, cite evidence in `.repoweave/review-notes.md`, then ask me to rerun RepoWeave Preview.

${input:Areas to focus on, or "all"}

## Related files

- `{{repo.prefix}}-harness-builder`
