{{! Derived from the LLD section of angular-planner.agent.md. Target: {{repo.prefix}}-design-doc/SKILL.md. }}
---
name: {{repo.prefix}}-design-doc
description: 'Write a feature design document from delivered source after implementation, testing and review pass; fires on "design doc", "LLD" or "document this feature".'
---

# Feature design document

## When to use

After a feature has passed implementation, styling, testing and review. Not for planning — use `{{repo.prefix}}-planner` for plans.

## Workflow

1. Collect the list of created and modified files from the delivery summary.
2. Read every one of them. Do not guess a service API, model shape or method name.
3. Write `{{#if semantic.docs.designDocDir}}{{semantic.docs.designDocDir}}{{else}}docs{{/if}}/<Feature-Name>-Design.md` (PascalCase words joined by hyphens) with these sections:
   - Overview and story reference
   - Architecture — placement in the {{project.framework.name}} app{{#if project.isAngular}} ({{project.angular.composition}}){{/if}}, component hierarchy, service dependencies, data flow
   - Component design — selectors or names, inputs, outputs, key state, lifecycle
   - Service design — scope, public methods, endpoints, error handling, caching and invalidation
   - Models and interfaces
   - UI/UX — design reference, layout approach, responsive behaviour, translation keys
   - Routing
   - Translation key table
   - Test coverage — files, cases, command run (`{{project.commands.test}}`) and result
   - Delivery checklist
   - Resolved decisions with alternatives considered
4. Include real code for complex logic, not pseudo-code.

## Constraints

- Every claim is verifiable against source at the cited path.
- No secrets, credentials or access passwords for design files.
- Do not edit application source while writing the document.

## Output format

The document path and a one-paragraph summary of what it covers.

## Related files

- `{{repo.prefix}}-planner.agent.md`
