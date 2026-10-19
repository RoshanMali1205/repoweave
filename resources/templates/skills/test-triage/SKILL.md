{{! Derived from angular-test-fixer.agent.md and the harness bounded-repair rules. Target: {{repo.prefix}}-test-triage/SKILL.md. }}
---
name: {{repo.prefix}}-test-triage
description: 'Classify failing unit tests and apply bounded repairs; fires on pasted test failures or "tests are failing".'
---

# Test failure triage

## When to use

One or more unit tests fail under `{{project.commands.test}}`. Not for creating missing tests.

## Workflow

1. Capture the baseline: run the failing tests once in a bounded non-watch mode and record working directory, command and exit code.
2. Classify each distinct failure:
   - **Test defect** — wrong mock, setup, import, async handling or outdated expectation → fix in the test.
   - **Product regression** — the test is right and the code is wrong → hand to `{{repo.prefix}}-implementer`.
   - **Pre-existing** — fails on the baseline revision too → report, do not hide.
   - **Flaky** — passes and fails without changes → report with evidence.
   - **Environment** — missing browser, tool or network → report as blocked.
3. Form a cause hypothesis and make the smallest fix for test defects only.
4. Re-run the failing test. At most two repair attempts per distinct failure; stop sooner if the same failure repeats without new evidence.

## Constraints

- Never skip tests, weaken assertions, lower coverage gates or disable lint rules to get green.
- Never install or download tools to make a run pass.
- A result not actually run is reported as not-run, never as passing.

## Output format

| Failure | Classification | Evidence | Action | Attempts | Result |

## Related files

- `{{repo.prefix}}-test-fixer.agent.md`
- `.repoweave/harness.md` — bounded repair rules
