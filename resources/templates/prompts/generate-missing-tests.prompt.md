{{! Derived from angular-unit-test-generator.agent.md. Target: {{repo.prefix}}-generate-missing-tests.prompt.md. }}
---
description: "Create {{project.testing.runner}} tests only for source files in the given scope that have none, without touching production code or existing tests."
agent: {{repo.prefix}}-test-generator
---

Generate missing unit tests for the scope below.

- Skip any file that already has a `*{{project.testing.specSuffix}}` test, and files with no meaningful runtime logic.
- Match the setup, mocking and async style of neighbouring tests.
- Omit only the individual cases that need risky assumptions, and list them.
- Run the new tests with `{{project.commands.test}}` and report the result.

${input:File or folder path}

## Related files

- `{{repo.prefix}}-test-generator.agent.md`
- `{{repo.prefix}}-specs.instructions.md`
