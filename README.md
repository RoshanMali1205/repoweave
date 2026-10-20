# RepoWeave — Agent Harness Studio

Generate repository-aware agent harnesses for GitHub Copilot, Claude Code and Codex from Angular and React projects, with one command.

RepoWeave does not run a daemon, does not store credentials, and does not write files until you have previewed the plan.

![VS Code 1.99 or later](https://img.shields.io/badge/VS%20Code-1.99%2B-007ACC?logo=visualstudiocode&logoColor=white)
![Version 0.1.2](https://img.shields.io/badge/version-0.1.2-0f172a)
![MIT License](https://img.shields.io/badge/license-MIT-2563eb)

By **Roshan Mali**.

## Why teams use it

- **Local scan.** Inventory, lockfile versions and syntax parsing stay on your machine. Analysis never runs npm scripts, tests, Git checkouts or remote writes.
- **Preview and conflict protection.** Apply writes only the plan you reviewed. Hash conflicts, managed-block edits and drift since the preview stop the write before any file changes.
- **Native Copilot, Claude and Codex files.** Agents, skills, rules and prompts use each host's own paths and formats, rendered from the evidence profile.
- **Optional Azure DevOps or Jira.** The studio can add a tracker specialist so the host fetches the work item before planning. Figma, when requested, adds a design reviewer. RepoWeave does not sign in, store tokens, or call the tracker API.

Prefer to go step by step? Click **RepoWeave** in the status bar. The studio highlights the next action: analyze, preview, apply, then copy the architecture prompt. The status bar names that same step.

## Install

1. **Install from VSIX.** In the Extensions view, open `...` and choose **Install from VSIX…**, then reload the window. Build `repoweave-0.1.2.vsix` with `npm run package`, or install a VSIX you already have.
2. **Open Harness Studio.** Trust the workspace, then click **RepoWeave** in the status bar or run **RepoWeave: Open Harness Studio**.
3. **Analyze, Preview, Apply.** Review the architecture report and the planned files, then confirm the write.

![Harness Studio on a real project: Analyze, Preview, then Apply only after review.](images/studio.gif)

Harness Studio on a real project: Analyze, Preview, then Apply only after review.

Requires VS Code 1.99 or later. The publisher id is `roshanmali`. The VSIX bundles the scanner libraries, so the application project does not need an install step.

To run every stage with one confirmation, use **RepoWeave: Generate Harness (All Steps)**.

## How it works

![Scan, then Profile, then Preview, then Apply, then your coding assistant](images/how-it-works.svg)

| Scan | Profile | Preview | Apply | Your coding assistant |
| --- | --- | --- | --- | --- |
| Inventory and syntax | Evidence profile | Diffs before any write | Guarded, journaled write | Host runs the review |

1. **Analyze.** RepoWeave builds a file inventory (`git ls-files` when Git is available, otherwise a filesystem walk that applies nested `.gitignore` rules), reads configuration and parses source syntax.
2. **Profile.** Findings are stored in `.repoweave/profile.json` with file paths, line numbers, coverage counts, omitted files and explicit unknowns.
3. **Preview.** The generator builds the harness in memory and marks each file `create`, `update`, `unchanged` or `conflict` against the disk and the previous manifest.
4. **Apply.** With no conflicts and no drift since the preview, the planned files are written under a lock, with backups and rollback.
5. **Review.** Your coding assistant runs the harness-builder agent, which writes `.repoweave/semantic.json`. Rerun Preview so feature agents and the remaining facts are regenerated from that file. RepoWeave never writes `semantic.json`.

| Stage | What it does | What it cannot establish alone |
| --- | --- | --- |
| Static scan | File inventory, nested manifests, npm/pnpm resolved framework versions, JSONC and local tsconfig inheritance, path aliases, Angular and React/Next route entries, main files, decorator metadata, provider scopes, styles and tooling | Business behavior, library precedence, whether every route really loads lazily, complete API data flow |
| Optional AI review | Sends explicitly selected and reviewed files to a model exposed through VS Code and accepts only observations with valid evidence paths | Whole-repository understanding from a small sample, or guaranteed correct findings |
| Host architecture review | The generated harness-builder agent and bootstrap skill guide the coding assistant through all first-party areas. Findings go into `.repoweave/semantic.json`, which RepoWeave only reads | Automatic certification; findings still need project validation |

## What the scan records

- **Inventory.** First-party files, nested package manifests, Angular workspace and Nx project roots, JSONC configuration and local `tsconfig` inheritance. Framework versions come from npm (`package-lock.json`) and pnpm (`pnpm-lock.yaml`) lockfiles.
- **Syntax.** The TypeScript compiler API parses JavaScript and TypeScript for imports, dynamic imports, Angular `@Component`, `@NgModule` and `@Injectable` metadata (including standalone flags and `providedIn`), bootstrap calls, lazy route signals (`loadComponent`, `loadChildren`), React hooks and `'use client'` directives.
- **Ownership.** Each source file belongs to the longest matching project root, so mixed and nested Angular/React projects keep separate profiles. Relative imports and local tsconfig `paths` / `baseUrl` aliases resolve into import edges. An alias with no local file stays unresolved. Package-based tsconfig `extends` is not followed.
- **Routes and main files.** Angular route objects (`path` with `loadComponent`, `loadChildren`, `component` or `redirectTo`), React Router `<Route>` entries and Next `app/` or `pages/` files are recorded with evidence and confidence. Entry, root-route, app-config and most-imported files are identified the same way.
- **No execution of project code.** Analysis never runs npm scripts, imported configuration modules, tests, Git checkouts or remote writes. Scripts are recorded as argument-array descriptors marked `not-run`, and their shell bodies are not copied into instructions.

The same profile and options always produce the same files.

## Files it writes

Shared context always lives under `.repoweave/`. Each selected host additionally receives native files:

| Target | Agents | Skills (single target) | Rules and instructions |
| --- | --- | --- | --- |
| GitHub Copilot | `.github/agents/{prefix}-*.agent.md` | `.github/skills/{prefix}-*/SKILL.md` | `.github/copilot-instructions.md` and scoped `.github/instructions/{prefix}-*.instructions.md`; prompt files in `.github/prompts/{prefix}-*.prompt.md` |
| Claude Code | `.claude/agents/{prefix}-*.md` | `.claude/skills/{prefix}-*/SKILL.md` | `CLAUDE.md` and scoped `.claude/rules/{prefix}-*.md` with a `paths` list |
| Codex | `.codex/agents/{prefix}-*.toml` | `.agents/skills/{prefix}-*/SKILL.md` | `AGENTS.md`, which links the shared context; per-project rules are linked from `.repoweave/architecture.md`. No files are written inside application directories. |

`{prefix}` comes from the root `package.json` `name` (scope stripped, kebab-case, safe characters, at most 40 characters), otherwise the folder name, otherwise `project`. Override it with `--prefix` or `repoweave.agentPrefix`. An empty setting derives the prefix. A value that would make an unsafe path is rejected. Files from an earlier `rw-*` harness are retained, not deleted.

When more than one target is selected, skills are written to a single shared location to avoid duplicate names: `.agents/skills/` if Codex is among the targets, otherwise `.claude/skills/`. Each root instruction file links those skill files explicitly. Some clients do not automatically discover another client's skill directory, so in that case follow the linked files. For the cleanest native discovery, select only the host you actively use.

The root instruction files (`.github/copilot-instructions.md`, `CLAUDE.md`, `AGENTS.md`) receive only a small block between `<!-- repoweave:start -->` and `<!-- repoweave:end -->` markers. Text outside that block is preserved.

The shared `.repoweave/` folder contains:

- `profile.json`, the evidence profile, and `architecture.md`, a readable architecture evidence report.
- `commands.json`, a catalog of project scripts as descriptors that analysis never runs.
- `rules/<project-id>.md`, per-project rules derived from the profile.
- `harness.md`, `scan-contract.md`, `BOOTSTRAP.md` and `integrations.md`, the delivery harness, discovery contract, bootstrap workflow and MCP onboarding guide.
- `catalog.md`, `SETUP.md` and `integration-status.json`.
- `semantic.schema.json` and `semantic.example.json`. `semantic.json` is yours; Preview and Apply never create or replace it, and it is not listed in the manifest.
- `prompts/*.md`, plain task prompts for hosts that do not load Copilot prompt files.
- `ai-observations.json`, only when an AI review was run.
- `scripts/freshness.cjs`, only when hooks are enabled.
- `manifest.json` and `backups/`, written by Apply.

## Agents and skills

Names below use `{prefix}`. These agents are always generated. The orchestrator lists exactly this set, plus any conditional agents that were actually emitted.

| Agent | Purpose | Tool access |
| --- | --- | --- |
| `{prefix}-orchestrator` | Coordinates scoped delivery and evidence-based handoffs | Full; can delegate to the other generated agents on Copilot |
| `{prefix}-planner` | Plans a feature against repository architecture | Read-only |
| `{prefix}-researcher` | Maps architecture and resolves dependency questions. Starts a defect investigation | Read-only |
| `{prefix}-implementer` | Implements scoped application changes following local patterns | Full |
| `{prefix}-ui-specialist` | Implements scoped styling and responsive behavior | Full |
| `{prefix}-test-generator` | Creates missing behavior-focused tests | Full |
| `{prefix}-test-fixer` | Repairs existing tests from observed failures | Full |
| `{prefix}-reviewer` | Reviews a working-tree diff or a pull request. Does not merge | Read-only |
| `{prefix}-harness-builder` | Records the semantic review in `.repoweave/semantic.json` | Full |

A defect follows researcher, then implementer or test-fixer, then reviewer. There is no defect-analyst agent and no separate pull-request agent.

| Agent | Added when | Purpose |
| --- | --- | --- |
| `{prefix}-integration-specialist` | Azure DevOps or Jira is requested | Fetches the work item before planning, through the host's existing MCP connection |
| `{prefix}-design-reviewer` | Figma is requested or a Figma hint is detected | Compares an implementation against a supplied design (read-only) |
| `{prefix}-a11y-label-fixer` | Sonar is detected | Fixes inputs that lack an accessible label |
| `{prefix}-feature-{slug}` | One entry in `.repoweave/semantic.json` `domains` | Specialist for that feature |

Read-only roles drop edit and execute tools. On Claude those roles receive Read, Glob and Grep. On Codex they request a read-only sandbox. Enforcement belongs to the host. No model is pinned.

Skills are rendered from `resources/templates/skills/`. The design-compliance skill is included only with the design reviewer. The others are always included: architecture discovery, bootstrap, deliver, design document, MCP onboard, missing tests, quality review, scaffold, system refresh, test run and test triage.

Task prompts cover planning, delivery, missing tests, failing tests, change review, a codebase audit, a design document and the semantic review. Bodies come from the templates, not from a role catalog.

## Commands

Open the studio with **RepoWeave: Open Harness Studio**, the **RepoWeave** status-bar item, or a right-click on the repository root in the Explorer. Follow the highlighted step. On a first run that step is **Generate harness (all steps)**: it analyzes the repository, lists the proposed files, and writes them after one confirmation.

To go one step at a time, choose **Analyze**, then **Preview**. Click any proposed file to open a before/after diff, then **Apply preview**. **Change assistants** picks GitHub Copilot, Claude Code, Codex, or several; preview again after changing it. After the files are written, **Copy architecture prompt** starts the review in your coding assistant. After it writes `.repoweave/semantic.json`, run Preview again.

The status bar shows the same next step when the studio is closed: Start, Preview, Apply, a conflict count, or Review. Apply stays unavailable until a preview has changes and no conflicts. Conflicts are listed in the studio and are never overwritten. If the custom agent list does not refresh after Apply, reload the coding client.

A first-run walkthrough, **Create an agent harness**, is included for the Get Started page.

| Command | Description |
| --- | --- |
| **RepoWeave: Open Harness Studio** | Opens the studio. The highlighted card is the next step, and proposed files open as diffs |
| **RepoWeave: Generate Harness (All Steps)** | Analyzes the repository, shows the preview, and writes it after one confirmation, then validates |
| **RepoWeave: Analyze Repository** | Scans the repository and opens the architecture evidence report |
| **RepoWeave: Preview Harness** | Generates the harness in memory and shows proposed changes and diffs |
| **RepoWeave: Apply Previewed Harness** | Writes the reviewed preview after a confirmation dialog |
| **RepoWeave: Analyze Selected Files with AI** | Sends selected, reviewed files to a VS Code language model for evidence-bound observations |
| **RepoWeave: Copy Architecture Review Prompt** | Copies a prompt that starts the bootstrap architecture review in your coding host |
| **RepoWeave: Validate Installed Harness** | Checks installed files against the manifest, their syntax and their cross-references, and opens a readable report |
| **RepoWeave: Connect Azure DevOps or Jira** | Asks you to connect Azure DevOps, connect Jira, or continue from pasted or local requirements. The choice is stored for the next preview. RepoWeave does not sign in or call the tracker API |
| **RepoWeave: Choose Coding Assistants** | Picks GitHub Copilot, Claude Code, Codex, or several. The choice is saved for this workspace. Preview again before applying |
| **RepoWeave: Open Settings** | Opens RepoWeave settings for hooks, the agent-name prefix, and the scan limit |

The extension requires Workspace Trust and supports filesystem workspaces, including VS Code remote extension hosts. Virtual workspaces are not supported. In a multi-root workspace, you choose the repository for each command. Changing RepoWeave settings discards the current preview, so preview again before applying.

## Command line

The same scan, generate and write engine runs outside VS Code through `scripts/cli.js`. Node.js on `PATH` is needed for the CLI and for the optional freshness hook. Extract the source package to an external tools folder, or to a dedicated `repoweave-kit` directory under `.github`, `.claude` or `.codex` (the scanner skips `repoweave-kit` directories), and install its runtime dependencies:

```powershell
cd C:\tools\repoweave
npm ci --omit=dev --ignore-scripts
```

| Action | Behavior |
| --- | --- |
| `scan` | Analyzes the project and prints the architecture evidence report. Nothing is written. |
| `preview` | Prints the proposed files and their status (`create`, `update`, `unchanged` or `conflict`) as JSON, plus files retained from earlier targets. Nothing is written. |
| `apply` | Prints the preview, then writes it only when `--yes` is supplied. Conflicts stop the apply before anything is written. |
| `validate` | Validates the installed harness and prints the result as JSON. The exit code is non-zero when validation fails. |

Options:

- `--project PATH` selects the repository. It defaults to the current directory.
- `--target` accepts `copilot` (the default), `claude`, `codex`, `all`, or a comma-separated list such as `copilot,claude`.
- `--hooks` includes the read-only freshness hook.
- `--integrations` accepts a comma-separated list of `azure`, `jira` and `figma`. Azure or Jira adds the tracker specialist, which fetches the work item before planning when the host already has an MCP connection. Figma adds the design reviewer. The studio records one tracker choice; this flag can request both Azure DevOps and Jira. A listed name is a request, not proof of access.
- `--prefix SLUG` overrides the derived agent-name prefix. An empty `repoweave.agentPrefix` setting derives it.
- `--yes` confirms `apply`.

```powershell
# Print the architecture evidence report
node scripts/cli.js scan --project C:\work\my-angular-app

# Preview a Copilot harness, then apply it
node scripts/cli.js preview --project C:\work\my-angular-app --target copilot
node scripts/cli.js apply --project C:\work\my-angular-app --target copilot --yes

# Preview for every host with the freshness hook and Azure DevOps and Figma templates
node scripts/cli.js preview --project C:\work\my-react-app --target all --hooks --integrations azure,figma

# Validate the installed harness
node scripts/cli.js validate --project C:\work\my-angular-app
```

Run `apply` with the same options you previewed. The CLI uses the default source-file limit of 4,000 files, and it has the same conflict checks as the extension. The generator must run once, or your coding assistant must execute the supplied architecture-review workflow. A folder of Markdown alone does not run anything.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `repoweave.targets` | `["copilot"]` | One or more of `copilot`, `claude` and `codex`. Multi-client output uses shared skills to avoid duplicate discovery. |
| `repoweave.includeHooks` | `false` | Adds a read-only SessionStart profile-freshness hook. It is written to `.claude/settings.json` when Claude is a target, otherwise to `.github/hooks/repoweave.json` when Copilot is a target. No Codex hook configuration is emitted. The hook runs no application scripts, makes no network calls and does not write to the workspace. An existing `.claude/settings.json` produces a merge conflict instead of being overwritten. |
| `repoweave.maxSourceFiles` | `4000` | Maximum first-party source files analyzed per scan, between 1 and 20,000. Omitted files are listed in the report. |
| `repoweave.agentPrefix` | empty | Prefix for generated names. Empty derives it from the root package name, then the folder name, then `project`. |

Fixed scan budgets also apply. The total inventory is capped at 50,000 files, individual source reads at 512 KiB, and source-content scanning at approximately 32 MiB.

## Safety and write model

- **Preview first.** Apply writes only the reviewed plan. Application source and dependencies are never modified, and writes are restricted to an allow-list of harness paths.
- **Conflict detection.** Generated files are tracked by content hash in `.repoweave/manifest.json`. A file that RepoWeave did not create, or that was edited after generation, becomes a conflict, and Apply stops before writing anything. A managed root block that was changed outside RepoWeave is also a conflict.
- **Drift checks.** Apply rechecks the hashes of scanned inputs, every destination file and the manifest. Any change since the preview invalidates the plan. In VS Code, unsaved editor buffers for affected files also block Apply.
- **Guarded writes.** Apply takes a lock at `.repoweave/write.lock`, backs up prior content and writes a transaction journal under `.repoweave/backups/`, writes each file through a temporary sibling and rename, and writes the manifest last. A failure during Apply rolls back the completed writes.
- **Path safety.** Paths outside the workspace and symlinked paths are rejected. Real secret files are excluded from the inventory: `.env*`, `.npmrc`, `.netrc`, `.git-credentials`, private keys, certificates and keystores. First-party source such as `credentials.service.ts` or a `secrets` model is inventoried. AI context is still redacted.
- **AI boundaries.** AI review is optional and user-initiated. You select the files, inspect the redacted context, and choose a model exposed through the VS Code Language Model API. Context is limited to 60,000 characters, and redaction is heuristic, not a guarantee. RepoWeave stores no API keys. Observations cannot execute commands or replace files.
- **Refresh.** Run Analyze and Preview again after project changes. Unchanged generated files are updated, and user-edited files are surfaced as conflicts.

Outputs from deselected targets are retained and listed, not deleted automatically. If the process crashes during Apply, inspect `.repoweave/write.lock` and the latest backup journal before recovery. Do not delete the lock blindly.

## Project structure

```text
repoweave/
├── package.json            Extension manifest, commands, settings and scripts
├── src/
│   ├── extension.js        Workspace trust and selection, studio panel, commands, diffs, AI consent
│   └── core/
│       ├── fs.js           Path boundaries, symlink policy, inventory, ignore handling, redaction
│       ├── scanner.js      Manifests, aliases, routes, main files, stack facts, ownership
│       ├── template.js     Placeholder renderer and profile context
│       ├── semantic.js     Read-only loader and schema for semantic.json
│       ├── prefix.js       Agent-name prefix
│       ├── generator.js    Template-backed host files and hook opt-in
│       ├── writer.js       Preview, conflict checks, managed blocks, validation, journaled apply and rollback
│       └── ai.js           Bounded selected-file context, prompt and evidence checks for AI observations
├── scripts/
│   └── cli.js              Portable CLI using the same engine
├── resources/
│   ├── templates/          Parameterised agents, skills, prompts and instructions
│   ├── semantic.example.json
│   ├── harness.md          Delivery harness: routes, handoffs, ownership, gates, bounded repair
│   ├── BOOTSTRAP.md        Host-driven architecture review workflow
│   ├── scan-contract.md    Repository discovery contract
│   ├── integrations.md     Optional MCP onboarding guide
│   └── freshness.cjs       Read-only SessionStart freshness hook
├── images/
│   ├── how-it-works.svg    Pipeline diagram used on this page
│   └── studio.gif          Harness Studio recording used on this page
├── docs/                   Architecture, comparison, roadmap, sources and validation notes
└── test/                   Node test suite for the core engine and the extension workflow
```

## Development

The extension is written in CommonJS JavaScript and has no build or transpile step. It uses the TypeScript compiler API only to parse target projects.

```powershell
npm ci --ignore-scripts
npm test
npm run check
npm run package
```

- `npm test` runs the Node test suite in `test/`, which covers the core engine and the Analyze, Preview and Apply workflow against a mocked VS Code API.
- `npm run check` performs a syntax check of the extension, core modules and CLI.
- `npm run package` builds the VSIX with `vsce`.

Press F5 in this source project to start an Extension Development Host using `.vscode/launch.json`.

Before any public release, choose a publisher you own, confirm the product name and complete real editor testing.

## Limitations

- This is a local preview. It has not been published to the Visual Studio Marketplace, and real VS Code, Copilot, Claude Code and Codex discovery has not yet been verified end to end. The extension test uses a mocked VS Code API.
- There is no background daemon or independent multi-agent scheduler. Agent execution is supplied by the coding host.
- Static analysis does not establish complete business understanding. Semantic review is still needed, and the AI review covers only the files you select.
- Local tsconfig `paths` and `baseUrl` aliases are resolved. Package-based `tsconfig` inheritance, decorator namespace imports and complex computed metadata may stay unresolved. Angular implicit standalone behavior is only inferred when the Angular version is resolved from a lockfile. Semantic facts stay unknown until `.repoweave/semantic.json` exists.
- Hooks are preview features in some hosts, and no Codex hook configuration is emitted in this version.
- MCP connections and authentication happen in the host. There is no built-in Jira, Azure DevOps or Figma client.
- Existing Claude settings need a manual hook merge, and conflicts need deliberate resolution. Automated crash recovery and removal of obsolete target files are not implemented.
- Windows-specific edge cases and real editor interactions still need testing.

See [docs/ROADMAP.md](docs/ROADMAP.md) for the full capability status and prioritized next work.

## Documentation

- [Architecture](docs/ARCHITECTURE.md): pipeline, modules, ownership model, write model, tool permissions and AI boundaries.
- [Comparison](docs/COMPARISON.md): review of earlier kits and the design decisions retained or corrected.
- [Roadmap](docs/ROADMAP.md): implemented capabilities, practical limits and next releases.
- [Validation](docs/VALIDATION.md): what the automated tests cover and what has not been tested.
- [Sources](docs/SOURCES.md): official API and format references used during implementation.

## Author

RepoWeave is created and maintained by **Roshan Mali**.

## License

Released under the [MIT License](LICENSE). Copyright (c) 2026 Roshan Mali. Third-party dependencies retain their respective licenses.
