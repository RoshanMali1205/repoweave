{{! Replaces rw-system-refresh from the retired skills.json. Target: {{repo.prefix}}-system-refresh/SKILL.md. }}
---
name: {{repo.prefix}}-system-refresh
description: 'Refresh generated agent knowledge after architecture changes; fires on "refresh the agents", "harness is stale" or a freshness-hook warning.'
---

# Refresh the harness

## Workflow

1. Ask the user to rerun RepoWeave Analyze and Preview; RepoWeave rescans manifests, configs and `.repoweave/semantic.json`.
2. Compare the preview against `.repoweave/manifest.json` hashes.
3. Unchanged generated files update; user-edited files appear as conflicts with a proposed diff.
4. Validate references and host discovery after Apply.

## Constraints

- Never silently rewrite user-authored rules.
- Update semantic facts in `.repoweave/semantic.json`, not in generated files.

## Output format

Files updated, conflicts to merge, validation result.

## Related files

- `{{repo.prefix}}-harness-builder`
