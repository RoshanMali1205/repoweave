{{! Derived from the large-file and omission sections of angular-unit-test-generator.agent.md. Target: {{repo.prefix}}-missing-tests/SKILL.md. }}
---
name: {{repo.prefix}}-missing-tests
description: 'Generate a complete test file for one large or complex source file that has none, by analysing first and completing behaviour groups in sequence.'
---

# Missing-test generation for complex files

## When to use

A source file with meaningful logic has no `*{{project.testing.specSuffix}}` test and is too large to test in one pass. Not for editing existing tests — use `{{repo.prefix}}-test-fixer`.

## Workflow

1. Confirm no test exists for the file. If one does, stop and hand over to `{{repo.prefix}}-test-fixer`.
2. Read the file, its dependencies and two neighbouring tests to learn setup, mocking and async style.
3. Break the work into sub-tasks, then complete them in order into one test file:
   1. Dependency analysis and mocks
   2. Construction and initialisation behaviour
   3. Method group A
   4. Method group B
   5. Branches and guards
   6. Async success and error paths
   7. Transformations and helpers
   8. Edge cases and fallbacks
4. Group tests by behaviour, not by line order.
5. Run the file with `{{project.commands.test}}` in a bounded non-watch mode.
6. Do not stop at planning — complete the generation wherever feasible.

## Pragmatic omission

Omit an individual case only when confidence is low, it needs risky assumptions, it would require production changes, or the behaviour cannot be inferred from source and nearby patterns. Complete everything else.

## Constraints

- {{#if project.testing.runner}}{{project.testing.runner}} and installed libraries only ({{project.testing.libraries}}).{{else}}Use only the installed runner; confirm it first.{{/if}}
- Never modify production source or existing tests.
- No placeholder tests or assertions that exist only to raise coverage.

## Output format

Completed sub-tasks, pending sub-tasks with the exact limitation, omitted cases with reasons, and the command result.

## Related files

- `{{repo.prefix}}-test-generator.agent.md`
- `{{repo.prefix}}-specs.instructions.md`
