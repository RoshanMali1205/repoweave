{{! Replaces rw-scaffold from the retired skills.json. Target: {{repo.prefix}}-scaffold/SKILL.md. }}
---
name: {{repo.prefix}}-scaffold
description: 'Create a component or feature matching the target package; fires on "scaffold", "new component" or "new feature module".'
---

# Scaffold a component or feature

## Workflow

1. Read the target project's instructions and two nearby examples.
2. Resolve naming{{#if project.angular.prefix}} (selector prefix `{{project.angular.prefix}}-`){{/if}}, registration{{#if project.isAngular}} ({{project.angular.composition}}){{/if}}, route loading, styles (`.{{project.styles.ext}}`) and test conventions (`*{{project.testing.specSuffix}}`).
3. Create only the requested scaffold, with meaningful behaviour.

## Constraints

- Do not force NgModule or standalone, JSX or TSX, or a stylesheet type from another package.
- Do not add packages.

## Output format

Files created and registrations added.

## Related files

- `{{repo.prefix}}-implementer`
