{{! Source: angular-templates.instructions.md. Target: {{repo.prefix}}-templates.instructions.md. Emit for Angular (HTML templates) and React (JSX markup). UI mapping, i18n pattern and shared components are semantic-review facts. }}
---
description: 'Use when: creating or editing component markup, UI library usage, translation of visible text, icons, or layout directives.'
applyTo: '{{#if project.isAngular}}**/*.component.html{{else}}**/*.{tsx,jsx}{{/if}}'
---

# Markup conventions

## i18n — mandatory

{{#if semantic.i18n.pattern}}
All user-facing text uses this pattern:

{{semantic.i18n.pattern}}
{{else}}
All user-facing text goes through {{project.i18n.library}}. The exact binding pattern is not yet recorded: [unknown: semantic.i18n.pattern — verify in semantic review]. Until it is, read two or three nearby templates in the same area and match them exactly.
{{/if}}

{{#if semantic.i18n.keyNaming}}
- Key naming: {{semantic.i18n.keyNaming}}
{{/if}}
- Never hard-code user-visible text.
- List all new keys in a table when the story is complete.
{{#if project.i18n.resourceDirs}}
- Translation resources live in {{project.i18n.resourceDirs}}.
{{/if}}

**What must be translated:** button labels, menu and tab labels, column headers, empty states, dialog titles and messages, form labels, placeholders, validation messages, tooltips, toasts, breadcrumbs, page titles.

## UI component libraries

{{#if semantic.ui.precedence}}
{{semantic.ui.precedence}}
{{else}}
Declared: {{project.ui.components}}. Precedence is not established by package presence: [unknown: semantic.ui.precedence — verify in semantic review].
{{/if}}

{{#if semantic.ui.mapping}}
{{semantic.ui.mapping}}
{{/if}}

Do not mix two libraries for the same widget in one template. Do not introduce an additional UI library.

## Layout

{{#if project.ui.layout}}
- Use the layout directives the project depends on: {{project.ui.layout}}.
{{/if}}
{{#if project.styles.utility}}
- Use {{project.styles.utility}} utilities for page-level layout, as nearby templates do.
{{/if}}
- Use CSS Grid in the component stylesheet where directives or utilities cannot express the requirement — `minmax(0, 1fr)` track constraints and `repeat(auto-fit, minmax(<min>, 1fr))` responsive column counts — not as a stylistic preference.

## No inline styles

- Never a literal `style` attribute or literal style binding.
- All styling goes in the component stylesheet as classes.
- Computed style bindings are permitted only for values derived from data at runtime.

## Markup best practices

- Avoid deeply nested structural directives or conditional expressions.
{{#if project.isAngular}}
- Track every non-trivial list by identity.
- Use `ng-template` and `ng-container` for clean conditional rendering.
- Do not use `(keyDown)`. The DOM event is `keydown`, lowercase; `(keyDown)` never fires and the element stays mouse-only.
{{/if}}
{{#if project.isReact}}
- Give every list item a stable `key`; never the array index for reorderable lists.
{{/if}}
- No heavy logic in markup. Move it to a getter, a pure pipe or a hook so it is testable.
- Preserve accessibility: semantic HTML, real `<button>` elements for interactive controls, `aria-label` where visible text is insufficient.

## Shared components

{{#if semantic.ui.sharedComponents}}
{{semantic.ui.sharedComponents}}
{{else}}
Search {{project.architecture.sharedDirs}} for an existing component before creating one.
{{/if}}

## Icons

{{#if semantic.ui.icons}}
{{semantic.ui.icons}}
{{else}}
Icon packages declared: {{project.ui.icons}}. Use the icon source nearby templates use.
{{/if}}

Decorative icons get `aria-hidden="true"`. Interactive icons get an accessible name.

## Related files

- `{{repo.prefix}}-components.instructions.md` — component classes
- `{{repo.prefix}}-styles.instructions.md` — style and responsive rules
- `{{repo.prefix}}-branding.instructions.md` — design tokens
