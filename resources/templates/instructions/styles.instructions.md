{{! Source: angular-styles.instructions.md. Target: {{repo.prefix}}-styles.instructions.md. The preprocessor, global files and token files come from the scan; breakpoints, offsets and token import idiom come from semantic review. }}
---
description: 'Use when: creating or editing {{project.styles.language}} style files, component styles, responsive layout, spacing, alignment, design tokens, or component-library theme overrides.'
applyTo: '**/*.{{#if project.styles.ext}}{{project.styles.ext}}{{else}}{css,scss,sass,less}{{/if}}'
---

# {{project.styles.language}} styling conventions

## Preprocessor

- This project uses **{{project.styles.language}}**. Style languages observed: {{project.styles.languages}}.
- Global styles: {{project.styles.globalFiles}}.
{{#if project.styles.hasTokens}}
- Design tokens: {{project.styles.tokenFiles}}.
{{/if}}
{{#if semantic.styles.tokenImport}}
- {{semantic.styles.tokenImport}}
{{/if}}
- Component styles are co-located with their component.

## Design tokens — no literal values

Every colour, font size, spacing value, radius and dimension resolves to a token. The values come from `{{repo.prefix}}-branding.instructions.md`, which is authoritative.

Keep two layers: a raw palette, the only place literal values appear, and semantic aliases that components reference. Components never reference the palette directly — that is what makes a rebrand a one-file edit.

No arithmetic on tokens in component styles. If you need a derived value, add a named token.

## Responsive design

{{#if semantic.styles.breakpoints}}
{{semantic.styles.breakpoints}}
{{else}}
Use the project's breakpoint variables or mixins from the global styles. Their names and values are not yet recorded: [unknown: semantic.styles.breakpoints — verify in semantic review]. Confirm whether they are complete media-query strings or numbers before using them — the wrong form can compile silently and be discarded by the browser.
{{/if}}

{{#if semantic.styles.layoutOffsets}}
**Account for fixed chrome.** {{semantic.styles.layoutOffsets}} Media queries measure the viewport, not the content area.
{{/if}}

**Prefer intrinsically responsive CSS** over breakpoints where possible. `repeat(auto-fit, minmax(<min>, 1fr))` reflows columns with no media query.

## Component-scoped styles

- Prefer component-scoped styles over global overrides.
{{#if project.isAngular}}
- Default view encapsulation scopes styles automatically.
- Use `::ng-deep` only to reach third-party internals, always under `:host`, always with a comment stating why. Unscoped `::ng-deep` leaks globally.
{{/if}}
{{#if project.styles.cssModules}}
- CSS modules are in use; keep class names local and import them from the module.
{{/if}}

## Strict rules

| Rule | Why |
|---|---|
| No `!important` | Except to override third-party internals with no alternative, with a `// WHY:` comment |
| No inline styles in markup | See `{{repo.prefix}}-templates.instructions.md` |
| No literal colours | Use tokens |
| No magic numbers | Use tokens, or comment the value |
| Max three levels of nesting | Deep selectors are brittle and force `!important` later |
| No ID selectors | Use classes |
| No manual vendor prefixes | The build handles them |
| No dead selectors, commented-out blocks, or duplicate rules | — |

Fixed pixels are acceptable for control dimensions defined by branding — input height, button height, icon size.

## Spacing and alignment

- Use `gap` for flex and grid containers rather than per-child margins.
- Reserve vertical space for validation messages so an appearing error does not shift the layout.

## Theming component libraries

{{#if project.styles.themes}}
- Theme sources observed: {{project.styles.themes}}.
{{/if}}
- Component-level overrides go in the component stylesheet, scoped as above.
- Application-wide overrides go in the global styles.
- Do not fork or copy library theme files.

## Related files

- `{{repo.prefix}}-branding.instructions.md` — authoritative token values
- `{{repo.prefix}}-templates.instructions.md` — no-inline-styles rule, layout
