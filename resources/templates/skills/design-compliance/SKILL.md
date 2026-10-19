{{! Derived from angular-figma-reviewer.agent.md. Target: {{repo.prefix}}-design-compliance/SKILL.md. Emit only when repo.hasDesignTool. }}
---
name: {{repo.prefix}}-design-compliance
description: 'Compare one implemented component against a {{#if repo.designTool}}{{repo.designTool}}{{else}}design{{/if}} frame and produce a compliance report; fires on a design link plus a component name.'
---

# Design compliance check

## When to use

A design link and an implemented component are both available. Without a design, report "not checked" — never approve.

## Workflow

1. Fetch the frame's properties and a screenshot with the live design tools.
2. Read the component's template and stylesheet, and the global styles it depends on.
3. Compare spacing and layout, typography, colours, component choice, icons, responsive variants and translations.
4. Cross-check every value against `{{repo.prefix}}-branding.instructions.md`; a design/branding mismatch is a design question, not a defect.
5. Record each discrepancy with the measured design value, the implemented value and the exact fix.

## Constraints

- Read-only.
- Cite measurements; mark inferred values as inferred.

## Output format

The design compliance report defined in `{{repo.prefix}}-design-reviewer.agent.md`.

## Related files

- `{{repo.prefix}}-design-reviewer.agent.md`
- `{{repo.prefix}}-ui-specialist.agent.md`
