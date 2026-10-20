# Changelog

## 0.1.5

- Publisher id is now `roshanmali1205`; the extension identifier is `roshanmali1205.repoweave`. Uninstall `roshanmali.repoweave` before installing.

## 0.1.4

- Generated orchestrator now starts with a baseline, keeps a resumable `state.json`, uses one result envelope that matches `harness.md`, and ends with a verify step that reports real commands and exit codes.
- Least-privilege tools: only delegating agents carry `agent`; the planner may write the design document; the Claude orchestrator's `Agent(...)` list names only its own subagents.
- Unknown facts no longer leak into agent instructions as `[unknown: ...]`; lists number correctly.
- Reviewer asks for the diff or file list it cannot fetch itself and cites file and line.

## 0.1.3

- Conflicts can be resolved in the studio: keep your edit, or use the RepoWeave proposal. Existing Claude settings can only be kept.
- A kept edit stays in place on later previews until you choose the proposal.
- **RepoWeave: Recover Interrupted Write** restores a prepared backup or clears a leftover lock after a finished write.
- **RepoWeave: Remove Harness** deletes generated files that still match the manifest. Hand-edited files, text outside a managed block, `.repoweave/semantic.json`, and backups stay.
- Unsaved editors that overlap a preview can be saved, and RepoWeave previews again instead of writing over them.
- The file list hides unchanged files until you ask to see them.

## 0.1.2

- The studio highlights the next step (generate, preview, apply, or architecture review) instead of showing every command with the same weight.
- Proposed files are listed in the studio. Click a file to open its before/after diff.
- The status bar names the current step: Start, Preview, Apply, a conflict count, or Review.
- **RepoWeave: Choose Coding Assistants** saves the host selection for the workspace. Preview again after changing it.
- Validation opens a readable report. A successful one-click generate can copy the architecture prompt.
- A first-run walkthrough and Explorer root commands make the studio easier to find.

## 0.1.1

- Added **RepoWeave: Generate Harness (All Steps)**: analyze, preview, apply and validate in one command with a single confirmation.
- Added an extension icon, gallery banner, repository, issue and homepage links, and marketplace categories and keywords.
- Spec and test files are no longer counted as routes, entry points or app configuration.
- Extra projects in a multi-project repository get a short "Additional project" section in the root instructions instead of a repeated full template.
- Root instructions no longer repeat the test runner as its own framework, number the agent table without gaps, and omit the translation rule when no i18n library is detected.
- Fixed template parsing on Windows checkouts with CRLF line endings.
- Added CI for Windows, Linux and macOS.

## 0.1.0

- Initial local preview.
