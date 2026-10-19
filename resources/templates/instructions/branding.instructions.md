{{! Generic replacement for a company branding file. Structure is universal; every value comes from the project's own token files and design-system source via semantic review. Never seed values from another project. Target: {{repo.prefix}}-branding.instructions.md. }}
---
description: 'Use when: implementing any UI component, styling, theming or visual element — colours, typography, buttons, forms, tables, dialogs, notifications, icons, tooltips, shadows or layout dimensions.'
applyTo: '**/*.{{{#if project.styles.ext}}{{project.styles.ext}}{{else}}css,scss,less{{/if}},html,tsx,jsx}'
---

# Branding and design system

{{#if semantic.branding.source}}
Source of truth: {{semantic.branding.source}}
{{else}}
Source of truth: [unknown: semantic.branding.source — verify in semantic review]. Until it is recorded, the token files below are the only authoritative values.
{{/if}}

**This file is the authoritative source for every visual value in the application.** {{#if project.styles.hasTokens}}The token files ({{project.styles.tokenFiles}}) transcribe these values.{{else}}No token files were detected; values must be added as tokens before components use them.{{/if}} Component styles reference tokens, never raw values.

{{#if semantic.branding.fontFamily}}
Font family: **{{semantic.branding.fontFamily}}**.
{{else}}
{{#if project.styles.fontFamilies}}
Font families declared in global or token styles: {{project.styles.fontFamilies}}. Confirm which is primary in the semantic review.
{{/if}}
{{/if}}

## Colour palette

{{#if semantic.branding.palette}}
{{semantic.branding.palette}}
{{else}}
[unknown: semantic.branding.palette — verify in semantic review]. Record each colour with name, value, token and usage, grouped as primary, secondary, alert and alert-background tints.
{{/if}}

## Typography

{{#if semantic.branding.typography}}
{{semantic.branding.typography}}
{{else}}
[unknown: semantic.branding.typography — verify in semantic review]. Record each level with size, weight, colour, line height and usage.
{{/if}}

## Components

{{#if semantic.branding.components}}
{{semantic.branding.components}}
{{else}}
[unknown: semantic.branding.components — verify in semantic review]. Record dimensions, radii, states and spacing for buttons, form inputs, tables, pagination, notifications, dialogs, tooltips, navigation, icons and shadows.
{{/if}}

{{#if semantic.branding.notes}}
## Notes

{{semantic.branding.notes}}
{{/if}}

## Rules

- Do not approximate a value branding defines, and do not invent one it does not.
- Where a design and this file disagree, raise it — a design may be ahead of branding or may be an oversight.
- Add a semantic token rather than a literal when a new value is genuinely needed.

## Related files

- `{{repo.prefix}}-styles.instructions.md` — how tokens are imported and used
- `{{repo.prefix}}-templates.instructions.md` — icon syntax and component choice
