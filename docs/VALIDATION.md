# Validation of 0.1.0

37 automated tests passed with Node 24 in this environment.

- Mixed Angular/React source ownership, npm framework resolutions, provider scopes, styling and import edges.
- AST parsing excludes decorator-like comments and strings.
- Unresolved Angular version keeps implicit standalone behavior unknown.
- JSONC, inherited strictness and cyclic config detection.
- Multiple Angular workspace roots sharing a manifest.
- Git ignore, nested fallback ignores, secret filenames, symlinks, scan budgets and cancellation.
- Deterministic native metadata generation and reference validation for all targets.
- Read-only preview, source preservation and additive root instructions.
- Hand-edited file conflicts, source/output drift checks and root text preservation.
- Existing Claude settings preserved instead of overwritten.
- AI response evidence validation.
- Read-only freshness hook output and config drift detection.
- pnpm importer versions and inherited package manager.
- Simulated write failure rollback and stable no-change refresh.
- Extension Analyze/Preview/Apply workflow and Workspace Trust rejection against a mocked VS Code API.
- Path boundaries for drive-root, trailing-separator and forward-slash workspace roots; projects ignored by an enclosing repository; nested repositories; paths beyond MAX_PATH; Git-missing versus not-a-repository notes; framework cache and credential exclusions.
- Stack facts for Angular/Karma/TSLint/Sonar/LESS and React/Vitest/ESLint/Tailwind fixtures, including Sonar credential exclusion and Angular unit-test builder runner inference.
- Template rendering: placeholders, unknown notes, nested conditionals, literal non-namespaced braces, no evaluation or prototype access; every shipped template documented in `resources/templates/CONTRACT.md`, renders valid frontmatter and carries no source-project specifics.

The extension-host test uses mocks. A real VS Code installation is not available in this environment. No live Copilot, Claude Code or Codex agent discovery, model request, MCP authentication or Windows UI session was performed. No real application build/test outcome is claimed.

Before wider adoption, install the VSIX in Windows VS Code, inspect generated paths in a temporary branch/worktree, verify custom-agent discovery for the chosen host, and run one representative feature or test-only task.
