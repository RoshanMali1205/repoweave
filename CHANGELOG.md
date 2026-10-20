# Changelog

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
