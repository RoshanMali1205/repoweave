# Delivery harness

The coding host supplies model execution, tools and permissions. These files supply task routing, project context, role contracts, work ownership, verification and recovery. Markdown is guidance, not an OS security boundary or an autonomous scheduler.

## Routes

- Analysis: researcher -> planner/report; no source writes.
- Feature: planner -> implementer -> applicable UI/test roles -> reviewer.
- Defect: researcher -> implementer or test-fixer -> reviewer.
- Styling: UI specialist -> design review if a design exists -> relevant visual verification.
- Missing tests: test generator -> test execution -> fixer -> review.
- Existing tests: fixer -> execution -> review.
- PR: reviewer; never merge as part of review.

For an already clear authorized task, planning is internal and brief. Do not require a new user approval at every handoff. Raise questions for unresolved behavior or external actions outside existing authorization.

## Handoff contract

Every handoff includes taskId, goal, acceptanceCriteria, projectRoot, profilePath, inputs/evidence, ownedFiles, forbiddenChanges, dependencies, validationPlan, baselineRevision and budget. Results include status (complete/partial/blocked), changedFiles, findings, checks (command,cwd,exitCode,logPath), assumptions, unresolved and nextRole. Unknown checks must not default to true.

## Ownership and parallelism

Use native workers only when available. Run independent analysis in parallel. Give writing agents disjoint files or isolated worktrees; never two writers to the same spec, style or shared configuration. The orchestrator integrates outputs and reruns affected checks after integration. A reviewer analyzes a stable diff. If tools cannot delegate, execute roles sequentially and disclose that mode. Do not pretend an @mention caused another agent to run.

## Baseline and gates

Inspect git status before work and preserve unrelated edits. Capture relevant pre-existing failures. Resolve commands from project scripts/config, inspect what they run, select bounded non-watch modes supported by that runner. Execute through argument arrays when scripting, not interpolated shell strings. Never invent a test filter or use npx to silently download tools. Report cwd, command, exit code and evidence. Coverage goals come from the project/user, not a universal 85% gate. A static review is not a Sonar scan. Browser observations are not established by reading CSS.

## Bounded repair

On failure classify product regression, test defect, pre-existing failure, flaky behavior, environment issue or unavailable dependency. Form a cause hypothesis, make the smallest authorized fix and rerun the failing check. Default budget: two repair attempts per distinct failure. Stop sooner if the same failure repeats without new evidence. Never skip tests, loosen assertions, lower coverage gates or remove lint rules to get green. Product defects discovered by a test-only agent go back to the implementer within task scope. Do not alter production source during test-only requests.

## Resume and reporting

Write `.repoweave/runs/<task-id>/state.json` with status, active phase, completed work, file ownership, attempts, evidence paths, next action and blockers. Store no credentials. Resume by checking current git diff and evidence against that checkpoint; invalidate stale checks if inputs changed. End with completed acceptance criteria, real validation results, remaining blockers and risks. Avoid claiming self-healing beyond the bounded host-driven repair loop.
