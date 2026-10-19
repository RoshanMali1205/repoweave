{{! Replaces rw-mcp-onboard from the retired skills.json. Target: {{repo.prefix}}-mcp-onboard/SKILL.md. }}
---
name: {{repo.prefix}}-mcp-onboard
description: 'Connect optional tracker or design context when requested; fires on "connect the tracker", "set up MCP" or a design link without tool access.'
---

# Optional integration onboarding

## Workflow

1. Follow `.repoweave/integrations.md`.
2. Ask one consolidated, relevant question and honour skip.
3. Discover the tools actually available and verify read access.
4. Report what is connected and what is not.

## Constraints

- Never invent credentials, tools or connection success.
- Never request a token in chat or write one to a file.

## Output format

Integration, tools found, read access verified (yes or no), next step.

## Related files

- `.repoweave/integrations.md`
