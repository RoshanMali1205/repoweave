{{! Derived from angular-test-fixer.agent.md. Target: {{repo.prefix}}-fix-failing-tests.prompt.md. }}
---
description: "Diagnose and fix failing or outdated unit tests with targeted changes, reporting any failure that needs a production fix."
agent: {{repo.prefix}}-test-fixer
---

Fix the failing or outdated tests below.

1. Classify each failure: test defect, product regression, pre-existing, flaky or environment.
2. Fix test defects with the smallest change; never weaken assertions or skip tests.
3. Re-run with `{{project.commands.test}}`; at most two repair attempts per distinct failure.
4. Report product regressions for `{{repo.prefix}}-implementer` instead of changing production code.

${input:Failing output or test file path}

## Related files

- `{{repo.prefix}}-test-fixer.agent.md`
- `{{repo.prefix}}-test-triage` skill
