{{! Derived from angular-reviewer.agent.md. Target: {{repo.prefix}}-review-changes.prompt.md. }}
---
description: "Review working-tree changes for correctness, conventions and acceptance criteria, with severity-ranked findings and a handoff."
agent: {{repo.prefix}}-reviewer
---

Review the changes below against the scoped instruction files{{#if semantic.migrations}} and the documented phased-migration exceptions{{/if}}.

Return the summary verdict, acceptance-criterion table, findings table (file, area, severity, description, suggested fix), positive notes, prioritised recommendations and the handoff agent. Read the source before claiming a bug. Do not claim a build, lint or Sonar result from inspection.

${input:Files, area or "all recent changes", plus acceptance criteria}

## Related files

- `{{repo.prefix}}-reviewer.agent.md`
