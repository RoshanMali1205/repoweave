# Capability status and next releases

## Implemented in 0.1.0

- VS Code commands, studio and diff preview; portable CLI using the same engine.
- Local inventory, Angular/React/Next signals, multi-package ownership, JSONC and local tsconfig inheritance.
- npm/pnpm framework version resolution; simultaneous style/test tool detection.
- Native agents, skills, instructions and task files for selected clients, rendered from `resources/templates/` with a project-name prefix.
- Local tsconfig path and baseUrl resolution, Angular and React/Next route entries, and main-file identification with evidence and confidence.
- Optional `.repoweave/semantic.json` review input. RepoWeave reads and validates it and never writes it. Feature agents come only from its domains.
- Structured handoffs, ownership, validation evidence, checkpoint/resume guidance and bounded repair rules.
- Protected regeneration with hashes, backups and root managed blocks.
- Selected-file AI observations through VS Code's model API.
- Optional read-only Claude/Copilot profile-freshness hook.
- Tracker/design preferences with host-driven MCP onboarding.

## Practical limits

- No claim of complete business understanding without semantic review. AI selected-file review is not an autonomous whole-repository model pipeline.
- Native agent execution is supplied by the coding host; no background daemon or independent multi-agent scheduler is implemented.
- Package-based tsconfig inheritance still needs further support. Local `paths` and `baseUrl` aliases are resolved; an extends that names a package is not.
- Angular standalone defaults require a resolved version. Decorator namespace imports and complex computed metadata may stay unresolved. Script command bodies are intentionally not executed.
- Multi-target shared skills are explicitly linked; native automatic discovery can vary by host. Single-target mode gives the cleanest folder conventions.
- Hooks are preview features in some hosts. No Codex hook configuration is emitted by this version; this is a capability gap, not a claim that Codex has no hooks.
- MCP account connection and server verification happen in the host. There is no built-in authenticated Jira/Azure/Figma client in this extension.
- Existing Claude settings need manual hook merge. A conflict can be kept or, except for Claude settings, replaced with the proposal. An interrupted write can be restored from its journal. Removing the harness leaves hand-edited files and `semantic.json`.
- Source scanning is bounded and reports omissions. No secret-detection heuristic is a complete guarantee; inspect AI context before sending it.
- Case-sensitive path handling follows the host filesystem. Windows-specific edge cases and real editor interactions still need testing.
- Automated crash recovery and removal of obsolete target files are not implemented.

## Prioritized next work

1. Run the bundled VSIX on one real NgModule/LESS/Karma application and one React/Vite/Vitest project; verify discovery, preview and source preservation in Windows VS Code.
2. Add Extension Development Host integration tests and CI for Windows/Linux/macOS. Test cancellation, dirty editors, multi-root selection and client reload behavior.
3. Extend the import graph past local aliases and route entries: namespace decorators, dependency-injection and service-call links, then package-aware flow review batches with token budgets.
4. Add approved, versioned native MCP configurations and per-host capability probes, preserving connection and permission state.
5. Implement interactive conflict resolution, transaction recovery, target uninstall and plugin export into a tested portable plugin manifest format.
6. Add staged model workers for scanner/miner/reviewer with bounded context, reusable evidence and independent review. Keep source-writing delegation opt-in and inspectable.
7. Finalize Marketplace branding, publisher, screenshots, support repository, telemetry decision and release process.

Suggested product name: **RepoWeave — Agent Harness Studio**. It describes weaving repository evidence into an agent workflow and covers Angular and React without implying Angular-only support. Marketplace and trademark availability have not been established. Alternatives: Frontend Harness Studio, Project Harness Builder.
