{{! Source: angular-components.instructions.md. Target: {{repo.prefix}}-components.instructions.md. Angular and React sections are mutually conditional. }}
---
description: 'Use when: creating or editing {{project.framework.name}} components, lifecycle, change detection, component architecture or component-level dependency injection.'
applyTo: '{{#if project.isAngular}}**/*.component.ts{{else}}**/*.{tsx,jsx}{{/if}}'
---

# Component conventions

{{#if project.isAngular}}
## Composition pattern — mandatory

{{#if project.angular.isNgModule}}
- Every component is declared in a feature module's `declarations` array.
- Do not use `standalone: true`. This codebase uses the NgModule pattern.
- Import shared components through the shared module.
{{/if}}
{{#if project.angular.isStandalone}}
- Components are standalone. Declare dependencies in the component's `imports`.
- Do not introduce NgModules for new components.
{{/if}}
{{#if project.angular.isMixed}}
- The codebase is mixed: {{project.angular.composition}}. Keep the pattern of the area you are editing and do not migrate incidentally.
{{/if}}
{{#if project.angular.composition}}
{{else}}
- Composition pattern not established: [unknown: project.angular.composition — verify in semantic review]. Inspect the target component's metadata and owning module before editing.
{{/if}}

## Selectors and naming

{{#if project.angular.prefix}}
- Selector prefix `{{project.angular.prefix}}-`, kebab-case.
{{/if}}
- One component per file.
- Files follow the nearby naming pattern for class, template, stylesheet (`.{{project.styles.ext}}`) and test (`{{project.testing.specSuffix}}`).
{{#if semantic.conventions.naming}}
- {{semantic.conventions.naming}}
{{/if}}

## Lifecycle

- Initialise in `ngOnInit`. Keep constructors to dependency injection only.
- Clean up in `ngOnDestroy`. Every subscription is released — a destroy notifier, a subscription container, or `takeUntilDestroyed`, matching nearby code.
- Do not use timers for sequencing. Sequence off the event or observable that makes the value ready; timing hacks fail under load and are untestable.

## Change detection

- Use `OnPush` only where the component is designed for it — typed inputs, immutable data, no external mutation of input objects.
- Do not add `OnPush` to a component with untyped mutable state or timing-based updates. It produces stale renders that are hard to trace.
- Track list items by identity before considering `OnPush`. It is lower risk and often sufficient.
{{/if}}
{{#if project.isReact}}
## Components and hooks

- Inspect the actual function or class, hook, provider and state conventions of nearby components.
- Preserve hook ordering, effect cleanup and public props.
- Do not introduce a state library or memoisation policy from package presence alone. Declared state libraries: {{project.state.libraries}}.
{{#if project.isNext}}
- Respect server and client boundaries; add `'use client'` only where the component needs client features.
{{/if}}
{{/if}}

## UI libraries

{{#if semantic.ui.precedence}}
{{semantic.ui.precedence}}
{{else}}
Declared component libraries: {{project.ui.components}}. Package presence does not establish precedence; use the library the nearest existing component uses.
{{/if}}
{{#if project.ui.layout}}
- Layout directives: {{project.ui.layout}}.
{{/if}}
{{#if project.styles.utility}}
- CSS framework: {{project.styles.utility}} — grid and utility classes.
{{/if}}
- Do not mix two component libraries for the same UI pattern within one component.

## Dependencies

- Reuse services from {{project.architecture.serviceDirs}}. Do not create duplicates.
{{#if semantic.i18n.pattern}}
- Load translations the way nearby components do: {{semantic.i18n.pattern}}
{{/if}}

## Type safety

- Avoid `any`. Use existing interfaces or define new ones.
- Type public method parameters and return values.
- Type forms where practical.
- Guard every parse of stored or external data. A malformed value throws and blanks the page.

## Component size

- A component over roughly 300 lines is a signal to extract a container plus presentational children.
- Business logic belongs in the class or a service, never in the template.

## Error handling

- Every async subscription or promise has an error path. Empty error handlers are prohibited — they hide failures and leave the user with a blank screen.
{{#if semantic.services.errorHandling}}
- {{semantic.services.errorHandling}}
{{/if}}
- Set loading flags inside the success and error handlers, never after the subscribe call — code placed after runs before the response arrives.

## Style and linting

- Follow {{project.lint.tool}} ({{project.lint.configFiles}}).
{{#if semantic.conventions.lineLength}}
- Max line length {{semantic.conventions.lineLength}}.
{{/if}}
- Import operators and utility functions individually rather than whole libraries.

## Related files

- `{{repo.prefix}}-templates.instructions.md` — markup and i18n
- `{{repo.prefix}}-services.instructions.md` — services and HTTP
- `{{repo.prefix}}-specs.instructions.md` — unit tests
