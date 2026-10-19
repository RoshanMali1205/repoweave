{{! Source: copilot-instructions.md. Target: .github/copilot-instructions.md (managed block), CLAUDE.md or AGENTS.md. One render per repository; multi-project repos render the stack table once per project. }}
# {{project.name}} — project instructions

These are the root instructions. Path-scoped conventions live in the scoped instruction files; this file states project facts and the rules that apply everywhere. Facts marked `[unknown: …]` were not established by static analysis and must be confirmed in the semantic review before they are relied on.

## Tech stack

| Area | Choice | Evidence |
|---|---|---|
| Framework | {{project.framework.name}} {{project.framework.version}} ({{project.framework.versionSource}}) | `{{project.manifest}}` |
{{#if project.isAngular}}
| Component composition | {{project.angular.composition}} | component decorators |
{{/if}}
| Language | TypeScript {{project.language.typescript}}, strict mode {{project.language.strict}} | tsconfig |
| Styles | {{project.styles.language}} | {{project.styles.globalFiles}} |
| UI components | {{project.ui.components}} | `{{project.manifest}}` |
{{#if project.ui.layout}}
| Layout | {{project.ui.layout}} | `{{project.manifest}}` |
{{/if}}
{{#if project.styles.utility}}
| CSS framework | {{project.styles.utility}} | `{{project.manifest}}` |
{{/if}}
| i18n | {{project.i18n.library}} | {{project.i18n.resourceDirs}} |
| State | {{project.state.libraries}} | `{{project.manifest}}` |
| Unit tests | {{project.testing.runner}}{{#if project.testing.framework}} with {{project.testing.framework}}{{/if}} | {{project.testing.configFiles}} |
| Lint | {{project.lint.tool}} | {{project.lint.configFiles}} |

{{#if semantic.ui.precedence}}
**UI library precedence.** {{semantic.ui.precedence}} The full mapping lives in `{{repo.prefix}}-templates.instructions.md`.
{{else}}
**UI library precedence.** Package presence does not establish which library is primary. Follow the library used by the nearest existing component until the semantic review records a precedence rule.
{{/if}}

## Architecture

{{#if semantic.architecture.summary}}
{{semantic.architecture.summary}}
{{else}}
- Service locations observed: {{project.architecture.serviceDirs}}
- Shared folders observed: {{project.architecture.sharedDirs}}
- Feature areas, module boundaries and data flow: [unknown: semantic.architecture.summary — verify in semantic review]
{{/if}}

### Main files

| Role | Files |
|---|---|
| Entry / bootstrap | {{project.architecture.entryFiles}} |
| App configuration or root module | {{project.architecture.appConfigFiles}} |
| Root routes | {{project.architecture.rootRouteFiles}} |
| Most-imported first-party files | {{project.architecture.hubFiles}} |

{{#if project.routes.hasRoutes}}
### Routes

{{project.routes.count}} route entries were found in source. Lazy targets are resolved through relative imports and tsconfig path aliases.

{{project.routes.table}}
{{/if}}

## Coding conventions

{{#if project.angular.prefix}}
- Component selector prefix `{{project.angular.prefix}}-`, kebab-case.
{{/if}}
{{#if semantic.conventions.list}}
{{semantic.conventions.list}}
{{/if}}
- Reuse existing services from {{project.architecture.serviceDirs}} rather than creating duplicates.
{{#if project.i18n.hasI18n}}
- Route all user-facing strings through the project's translation mechanism — see `{{repo.prefix}}-templates.instructions.md`.
{{/if}}
- No inline styles. Styling lives in the component stylesheet.
- No hard-coded colour or spacing values where design tokens exist — see `{{repo.prefix}}-branding.instructions.md`.

{{#if project.isAngular}}
## Composition pattern

{{#if project.angular.isNgModule}}
- Declare components in their feature module's `declarations`.
- Import shared components through the shared module.
- Lazy-load features with `loadChildren`.
- Do not convert components, directives or pipes to standalone.
{{/if}}
{{#if project.angular.isStandalone}}
- Components are standalone; import dependencies in the component's `imports`.
- Lazy-load with `loadComponent` or `loadChildren` as nearby routes do.
- Do not introduce NgModules for new code.
{{/if}}
{{#if project.angular.isMixed}}
- The codebase mixes standalone and NgModule components ({{project.angular.composition}}). Keep the pattern of the area you are editing; do not migrate incidentally.
{{/if}}
{{/if}}

## Build and test

Commands are descriptors resolved from `{{project.manifest}}`; inspect what a script runs before choosing arguments.

| Command | Purpose |
|---|---|
| `{{project.commands.start}}` | Serve locally |
| `{{project.commands.build}}` | Build |
| `{{project.commands.test}}` | Unit tests |
| `{{project.commands.lint}}` | Lint |

{{#if project.sonar.present}}
## Static analysis

- Sonar configuration: `{{project.sonar.configFile}}`; project key `{{project.sonar.projectKey}}`.
- Coverage report: `{{project.sonar.coverageReport}}`.
- Exclusions: {{project.sonar.exclusions}}.
- A static review is not a Sonar scan. Report Sonar results only from an actual analysis run.
- API access needs a token from the environment. Never commit a token.
{{/if}}

## Multi-agent workflow

Use `{{repo.prefix}}-orchestrator` to run the full pipeline, or invoke an agent directly.

| # | Agent | Role |
|---|---|---|
| 1 | `{{repo.prefix}}-planner` | Breakdown, impact analysis, subtasks, design document |
| 2 | `{{repo.prefix}}-implementer` | Application code |
| 3 | `{{repo.prefix}}-ui-specialist` | Templates, styles, responsive fixes, visual polish |
{{#if repo.hasDesignTool}}
| 4 | `{{repo.prefix}}-design-reviewer` | Implementation versus {{repo.designTool}} design |
{{/if}}
| {{#if repo.hasDesignTool}}5{{else}}4{{/if}} | `{{repo.prefix}}-test-generator` | New tests for files that have none |
| {{#if repo.hasDesignTool}}6{{else}}5{{/if}} | `{{repo.prefix}}-test-fixer` | Fix failing tests and update existing tests |
| {{#if repo.hasDesignTool}}7{{else}}6{{/if}} | `{{repo.prefix}}-reviewer` | Quality, correctness, conventions, acceptance criteria |

Specialists: {{repo.specialistAgents}}.
{{#if repo.featureAgents}}
Feature specialists: {{repo.featureAgents}}.
{{/if}}

**Generator versus fixer.** `{{repo.prefix}}-test-generator` only creates tests for files that have none and skips any file with an existing test. To modify an existing test, use `{{repo.prefix}}-test-fixer` and say so explicitly.

## Safety rules

- Do not add packages unless explicitly requested.
- Do not modify production code when generating tests.
{{#if project.angular.isNgModule}}
- Do not convert NgModule components to standalone.
{{/if}}
{{#if project.testing.runner}}
- Use only the installed test tooling ({{project.testing.runner}}; libraries: {{project.testing.libraries}}). Do not introduce another runner or test library.
{{/if}}
- Inspect `{{project.manifest}}`{{#if project.isAngular}}, the Angular workspace configuration{{/if}} and nearby code before changing anything.
- Never commit tokens, keys, passwords or connection strings.

{{#if semantic.migrations}}
## Phased migration exception

{{semantic.migrations}}

In those areas the migration plan governs sequencing, and reviewer agents treat the documented interim states as expected, not as defects.
{{/if}}

{{#if semantic.docs.syncRule}}
## Documentation sync rule

{{semantic.docs.syncRule}}
{{/if}}

## Related files

- `AUTHORING-STANDARD.md` — how these files are written
- Scoped instruction files — `{{repo.prefix}}-components`, `{{repo.prefix}}-templates`, `{{repo.prefix}}-styles`, `{{repo.prefix}}-services`, `{{repo.prefix}}-specs`, `{{repo.prefix}}-branding`
- `.repoweave/profile.json` — the evidence behind every fact above
