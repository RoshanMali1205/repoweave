{{! Replaces rw-quality-review from the retired skills.json. Target: {{repo.prefix}}-quality-review/SKILL.md. }}
---
name: {{repo.prefix}}-quality-review
description: 'Review changed code against local quality rules; fires on "quality check", "lint review" or "Sonar issues".'
---

# Quality review

## Workflow

1. Inspect the diff, the scoped instruction files and impacted consumers.
2. Check against {{project.lint.tool}} rules ({{project.lint.configFiles}}){{#if project.sonar.present}} and the Sonar configuration `{{project.sonar.configFile}}`{{/if}}.
3. Report actual defects with evidence and appropriate severity.

## Constraints

- Read scanner output only if available.
- Do not treat a textual heuristic as a verified vulnerability or a Sonar result.

## Output format

Findings table: file, rule or area, severity, evidence, suggested fix.

## Related files

- `{{repo.prefix}}-reviewer`
