# Review and combined design

Reviewed inputs: the prior Project Agent Factory kit and the new `files (5).zip`, including its nested `agent-forge.zip`, agents, skills, prompts, templates, scanner and installers. The supplied Angular example is a reference profile, not evidence about another target project.

## What was retained

| Source | Retained idea | Implementation here |
|---|---|---|
| Agent Forge | Profile before emission | Structured per-project profile and deterministic template emitter |
| Agent Forge | Separate config scanning and convention mining | AST/config analysis plus optional evidence-bound AI review and host semantic-review workflow |
| Agent Forge | Provenance and refresh protection | Actual generated-file hashes, managed root blocks, conflict detection and backups |
| Agent Forge | Output catalog | Generated catalog and validated reference graph |
| Earlier factory | Preserve local project conventions | Existing-instruction inventory, scope-specific rules and explicit unknowns |
| Earlier factory | Missing-test generator versus existing-test fixer | Distinct roles and handoff boundaries |
| Earlier factory | Bounded recovery and resume | Runtime task contracts, ownership, checkpoints and two-attempt default repair budget |
| Both | Host adapters and optional MCP | Native agent formats, task skills and honest connection states |

## Corrections supported by the supplied files

1. `host-adapters/codex.md` says Codex has no agent registry or skill layer. Current official documentation supports `.codex/agents/*.toml` and `.agents/skills`. RepoWeave emits these.
2. `host-adapters/claude-code.md` and `mcp-integrator.agent.md` put MCP server declarations in `.claude/settings.json`. Project MCP configuration belongs in `.mcp.json`; settings are used for hooks and permissions. RepoWeave records config locations and guides connection instead of writing unverified server definitions.
3. The Claude adapter omits `.claude/rules` with path-scoped rules. RepoWeave emits native scoped rules.
4. Shell/PowerShell installers mostly rename/copied files for Claude. Renaming a Copilot file does not translate tool IDs or prompt arguments. RepoWeave serializes native metadata separately.
5. The supplied prescan reads the root package and chooses a single framework/test runner/preprocessor. That loses mixed projects and coexisting tools. RepoWeave inventories nested manifests and Angular/Nx roots, preserving per-project tool arrays and style counts.
6. The supplied scanner removes comments with regex and limits walking depth to six. RepoWeave uses a JSONC parser and bounded full inventory with disclosed omissions. It uses Git ignore semantics where Git is available, including worktree-compatible Git invocation.
7. The supplied scanner treats absent `strict` as false even if inherited, equates some Next folder signals with rendering guarantees, and reports any MCP config as tracker configuration. RepoWeave resolves local tsconfig inheritance and separates observed signals, inference and unverified connections.
8. The supplied `README.md` describes deterministic emission, but the executable scripts install and prescan; Markdown agents do the emission. RepoWeave contains a callable deterministic generator and tests it.
9. Agent Forge's orchestrator prohibits skipping two approval stops even when the user authorizes completion; the architect refuses all unknowns. RepoWeave asks for one concrete apply action in the editor and permits safe partial facts while keeping unknowns explicit. Existing authorization carries across model workflow stages.
10. The supplied convention miner promotes majority usage to mandatory rules and uses filesystem modification time as recency. Checkout timestamps and majority usage do not establish architecture policy. RepoWeave preserves observations and requires semantic review for project decisions.
11. The supplied catalog suppresses the orchestrator for small projects. The user explicitly requested an orchestrator, so RepoWeave includes one while routing small tasks directly.
12. The supplied installer switches branches and edits `.gitignore`. RepoWeave makes no such unrelated repository mutations.
13. My earlier factory installed a bootstrap role and left delivery-file authoring entirely to the assistant. RepoWeave now emits the baseline files itself and provides optional AI analysis in the extension.
14. My earlier scanner used source regex and had only heuristic ignore handling. RepoWeave parses JS/TS syntax and has meaningful ignore, ownership and overwrite-protection tests.

This is an improvement in implemented behavior, not a claim that generated files equal weeks of domain expertise. Complete business understanding still requires actual source review and representative execution.
