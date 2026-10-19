{{! Source: angular-specs.instructions.md. Target: {{repo.prefix}}-specs.instructions.md. Runner, libraries, spec naming and location come from the scan; mocking style and coverage target come from semantic review. }}
---
description: 'Use when: creating or editing unit tests, {{project.testing.runner}} configuration, test-module setup, mocking, async test handling, or improving coverage.'
applyTo: '{{#if project.testing.specGlob}}{{project.testing.specGlob}}{{else}}**/*.{spec,test}.{ts,tsx,js,jsx}{{/if}}'
---

# Unit test conventions

## Framework

{{#if project.testing.runner}}
- **{{project.testing.runner}}** as runner{{#if project.testing.builder}} (workspace builder `{{project.testing.builder}}`){{/if}}.
{{#if project.testing.framework}}
- **{{project.testing.framework}}** for assertions and test doubles.
{{/if}}
- Configuration: {{project.testing.configFiles}}.
- Installed test libraries: {{project.testing.libraries}}. Do not introduce any other runner or test library.
{{else}}
- The test runner is not established: [unknown: project.testing.runner — verify in semantic review]. Read the test configuration before writing tests.
{{/if}}
{{#if project.hasSpecs}}
- Existing tests: {{project.testing.specCount}}, named `*{{project.testing.specSuffix}}`, {{project.testing.specLocation}}.
{{/if}}

{{#if project.isAngular}}
## Test-module setup

Configure the test module with the unit under test, its required imports and mocked providers, matching neighbouring tests. Trigger initial change detection after setup to run initialisation hooks.
{{/if}}

## Mocking

{{#if semantic.testing.mockingStyle}}
{{semantic.testing.mockingStyle}}
{{else}}
Follow the mocking style of neighbouring tests. [unknown: semantic.testing.mockingStyle — verify in semantic review]
{{/if}}

- Configure mocks in setup. A mock returning a raw value where an observable or promise is expected fails at use time, not at setup.
{{#if project.isAngular}}
- Use the HTTP testing utilities for HTTP and verify outstanding requests in teardown.
{{/if}}

## What to test

Prioritise, in order:

1. Public methods and their branches
2. Async success **and error** paths
3. Guard conditions, fallback and default behaviour
4. Null, undefined and empty input handling
5. Mapping and transformation logic
6. Request construction — parameters, payload shape
7. Dependency interaction

{{#if semantic.testing.coverageTarget}}
Target {{semantic.testing.coverageTarget}} meaningful coverage. Do not inflate with trivial assertions.
{{else}}
Use the coverage target from the project configuration or the request. Do not inflate coverage with trivial assertions.
{{/if}}

**Test behaviour, not internals.** Assert on what a method produces or which dependency it calls, not on the internal state of a third-party object. Tests coupled to library internals break when the library changes.

## Preservation rules

- Do not modify production source, templates or styles when writing tests.
- Do not modify an existing test unless explicitly asked — see the generator-versus-fixer note in the root instructions.
- If a file cannot be tested without source changes, report the limitation.

## Cleanup and cleanliness

- Release subscriptions and destroy fixtures or rendered trees in teardown.
- No unused imports, variables, mocks or spies.
- No commented-out code, empty blocks, or focused or skipped tests committed.
- Clear test names stating the expected behaviour.

## Coverage

{{#if project.testing.coverageReport}}
`{{project.commands.test}}` → `{{project.testing.coverageReport}}`
{{else}}
Run `{{project.commands.test}}`; inspect the runner configuration for the coverage output path.
{{/if}}

## Related files

- `{{repo.prefix}}-components.instructions.md` — what components should expose to be testable
- `{{repo.prefix}}-services.instructions.md` — service patterns under test
