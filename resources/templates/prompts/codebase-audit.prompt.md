{{! Referenced by research-agent.agent.md as codebase-audit.prompt.md, which was not in the supplied set; authored from the agent's audit section. Target: {{repo.prefix}}-codebase-audit.prompt.md. }}
---
description: "Run a read-only codebase health audit: security, dependencies against {{project.framework.name}} {{project.framework.major}}, and best-practice violations."
agent: {{repo.prefix}}-researcher
---

Run a full read-only health audit of the scope below.

1. Security scan using the researcher's catalogue; redact any discovered secret.
2. Dependency audit of `{{project.manifest}}` for {{project.framework.name}} {{project.framework.version}} compatibility, vulnerabilities and unused packages.
3. Best-practice audit: leaks, rendering cost, async misuse, dead code, hard-coded strings, inline styles.
4. Return the executive summary, the three findings tables with file and line, and a prioritised roadmap.

Do not modify files, install packages or run builds.

${input:Scope — folder, feature area or "whole repository"}

## Related files

- `{{repo.prefix}}-researcher.agent.md`
