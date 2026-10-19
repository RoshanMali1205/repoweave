{{! Replaces rw-deliver from the retired skills.json. Target: {{repo.prefix}}-deliver/SKILL.md. }}
---
name: {{repo.prefix}}-deliver
description: 'Deliver a feature or defect using the project harness; fires on "implement", "deliver" or "fix this story".'
---

# Deliver a change

## Workflow

1. Read `.repoweave/harness.md` and the project instructions.
2. Follow the `{{repo.prefix}}-orchestrator` route classification, acceptance criteria, ownership and bounded recovery.
3. Persist a task checkpoint under `.repoweave/runs/<task-id>/state.json`.
4. Record actual validation evidence, such as `{{project.commands.test}}` with its exit code.

Use native agents if available; otherwise disclose sequential mode.

## Constraints

- At most two repair attempts per distinct failure.
- Never weaken tests to get green.

## Output format

Acceptance-criterion status, files changed, checks run, open risks.

## Related files

- `{{repo.prefix}}-orchestrator`
- `.repoweave/harness.md`
