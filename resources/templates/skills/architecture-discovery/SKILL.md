{{! Replaces rw-architecture-discovery from the retired skills.json. Target: {{repo.prefix}}-architecture-discovery/SKILL.md. }}
---
name: {{repo.prefix}}-architecture-discovery
description: 'Inspect repository architecture before project-specific work; fires on "map the architecture", "where is X implemented" or "how is this app structured".'
---

# Architecture discovery

## Workflow

1. Follow `.repoweave/scan-contract.md`.
2. Start from the main files in the profile: entry points {{project.architecture.entryFiles}}, app configuration {{project.architecture.appConfigFiles}}, root routes {{project.architecture.rootRouteFiles}} and the most-imported shared files {{project.architecture.hubFiles}}.
3. Inventory first-party packages, inspect configs and trace representative flows from route to UI, service and API.
4. Write evidence-backed facts and unresolved areas.

## Constraints

- Do not confuse scan signals with semantic proof.
- Read-only.

## Output format

Areas mapped with evidence paths, flows traced, unresolved questions.

## Related files

- `.repoweave/architecture.md`
