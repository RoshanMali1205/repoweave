{{! Replaces rw-test-run from the retired skills.json. Target: {{repo.prefix}}-test-run/SKILL.md. }}
---
name: {{repo.prefix}}-test-run
description: 'Execute the relevant configured tests and report failures; fires on "run the tests" or "check tests pass".'
---

# Run the configured tests

## Workflow

1. Read `.repoweave/commands.json` and the script source; the test command is `{{project.commands.test}}`.
2. Inspect what it runs ({{project.testing.runner}}; configuration {{project.testing.configFiles}}) and choose a bounded, non-watch mode it supports.
3. Verify the working directory, then run the existing tool without installation.
4. Record exit status and log; distinguish failed, passed, blocked and not-run.
5. Route observed failures through `{{repo.prefix}}-test-triage` under the harness repair budget.

## Constraints

- Never invent a test filter or download tools with npx.
- Execute through argument arrays when scripting.

## Output format

Command, working directory, exit code, summary of failures.

## Related files

- `{{repo.prefix}}-test-triage`
