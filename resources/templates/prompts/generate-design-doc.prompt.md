{{! Derived from the LLD-generation step of angular-planner.agent.md. Target: {{repo.prefix}}-generate-design-doc.prompt.md. }}
---
description: "Write the feature design document from the delivered source, verifying every claim against code."
agent: {{repo.prefix}}-planner
---

Write the design document for the delivered feature below, following the `{{repo.prefix}}-design-doc` skill. Read every created or modified file first; do not guess APIs, model shapes or method names. Save it under `{{#if semantic.docs.designDocDir}}{{semantic.docs.designDocDir}}{{else}}docs{{/if}}/`.

${input:Feature name and the list of changed files}

## Related files

- `{{repo.prefix}}-design-doc` skill
- `{{repo.prefix}}-planner.agent.md`
