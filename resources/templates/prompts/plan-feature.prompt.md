{{! Derived from angular-planner.agent.md (the user's system had no prompts folder). Target: {{repo.prefix}}-plan-feature.prompt.md. }}
---
description: "Produce a dependency-ordered implementation plan for a feature, with impacted files, subtasks, acceptance criteria and test strategy."
agent: {{repo.prefix}}-planner
---

Plan the feature below for {{project.name}}.

1. {{#if repo.hasTracker}}If a {{repo.tracker}} work item ID is given, fetch its requirements first. {{/if}}Base the plan on actual requirements; ask about anything ambiguous.
2. Read the impacted code and identify reusable services and shared components.
3. Return the planner output contract: summary, route type, impacted files, subtasks with agent assignments, risks, design link, acceptance criteria and a {{project.testing.runner}} test strategy.

Do not edit files. Do not plan new packages.

${input:Feature description or work item ID}

## Related files

- `{{repo.prefix}}-planner.agent.md`
