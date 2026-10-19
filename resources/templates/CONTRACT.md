# Template contract

Parameterised agent, instruction, prompt and skill templates distilled from a hand-built, working multi-agent system. `src/core/template.js` renders them and `generate()` uses these bodies. `resources/roles.json` and `resources/skills.json` are retired.

## Mechanism

Rendering is a single pass over the text. No expression is evaluated and no code is executed.

| Syntax | Meaning |
|---|---|
| `{{project.x.y}}` | Insert a value. Only paths rooted in `repo.`, `project.` or `semantic.` are placeholders. |
| `{{#if path}}…{{else}}…{{/if}}` | Conditional section; `{{else}}` is optional; blocks nest. |
| `{{! note }}` | Author note, removed on render. Every template starts with one naming its source and target file. |
| Any other `{{…}}` | Literal text, so Angular interpolation and JSX style objects in examples pass through untouched. |

Value rules:

- Missing, `null` or empty-string values render as `[unknown: <path> — verify in semantic review]`. They are never guessed.
- An empty list renders as `none detected`.
- Lists join with `, `.
- Booleans render as `yes` or `no`.
- A value that resolves to an object is a template error and throws.
- Conditions are false for missing, `null`, `false`, `''`, `0` and `[]`.
- Path lookup reads own properties only, so prototype keys such as `constructor` resolve as missing.
- A block tag alone on its line removes that line. Runs of three or more newlines collapse to one blank line.
- Unbalanced blocks and invalid placeholder syntax inside the three namespaces throw.

Confidence: `projectContext(profile, project, semantic)` turns profile facts into placeholder values. A string value backed only by a declared dependency gets the suffix ` (declared dependency only; verify)`. A heuristic value gets ` (inferred; verify)`. Every fact in `profile.json` keeps `value`, `evidence` (paths, `file#pointer`) and `confidence` (`observed` | `declared` | `inferred` | `unknown`).

`semantic.*` values come from `.repoweave/semantic.json`, written by the harness-builder review and never by RepoWeave. They are passed as the third argument and are never derived from the scan. Templates give every `semantic.*` value either an `{{else}}` fallback or the unknown note. Values are untrusted text and are escaped before insertion.

## Placeholders

"Scanner" says whether the scanner supplies the source field. ✓ = yes; ~ = yes, but heuristic or partial; — = semantic review only. "Fallback" is the rendering when the value is unknown: the default is the unknown note, and "else" means the template has an explicit else-branch.

### Repository

| Placeholder | profile.json source | Scanner | Fallback |
|---|---|---|---|
| `repo.name` | `name` | ✓ | note |
| `repo.prefix` | root package name, else folder name, else `project`; override `--prefix` or `repoweave.agentPrefix` (empty derives) | ✓ | `project` |
| `repo.specialistAgents` | generated specialist names that are not already in the core route table | ✓ | note |
| `repo.featureAgents` | one name per semantic domain | ✓ | section omitted when empty |
| `repo.tracker` | requested Azure DevOps and/or Jira integration | ~ | else: generic "tracker" |
| `repo.hasTracker` | Azure DevOps or Jira was requested | ~ | false → section omitted |
| `repo.designTool` | Figma requested or a Figma file-name hint | ~ | else: generic "design" |
| `repo.hasDesignTool` | same | ~ | false → section omitted |

Design review is included when Figma is requested or detected. The tracker specialist is included only when Azure DevOps or Jira is requested. A filename hint alone does not add it. When that specialist is included, the orchestrator has it fetch the work item through the host's existing MCP connection before planning a feature or defect. When it is not included, the generated harness asks once whether to connect Azure DevOps or Jira and honors a skip.

### Project identity and framework

| Placeholder | profile.json source | Scanner | Fallback |
|---|---|---|---|
| `project.name` | `projects[].name` | ✓ | note |
| `project.manifest` | `projects[].manifest` | ✓ | note |
| `project.framework.name` / `.package` | `projects[].frameworks[]` (Angular, else Next, else first) | ✓ | note |
| `project.framework.version` | `frameworks[].resolved` ‖ `.declared` | ✓ | note |
| `project.framework.versionSource` | `lockfile` when resolved, else `declared range` | ✓ | note |
| `project.framework.major` | first integer of the version | ✓ | note |
| `project.isAngular` / `isReact` / `isNext` | `frameworks[].package` | ✓ | false |
| `project.language.typescript` | `dependencies.typescript` (declared range) | ✓ | note |
| `project.language.strict` | `tsconfigs[]` at project root → `compilerOptions.strict` (`on`/`off`) | ✓ | note |
| `project.packageManager` | `packageManager` (npm/pnpm resolved; others name-only) | ✓ | note |
| `project.commands.test` / `build` / `lint` / `start` | `commands[]` with that script name → `argv` | ✓ | note |

### Angular

| Placeholder | profile.json source | Scanner | Fallback |
|---|---|---|---|
| `project.angular.composition` | `composition.value` → `standalone` / `NgModule` / `mixed (…)` | ✓ | else: inspect metadata |
| `project.angular.isNgModule` / `isStandalone` / `isMixed` | same | ✓ | false |
| `project.angular.prefix` | `stack.angular.value.prefix` (workspace project `prefix`) | ✓ new | line omitted |
| `project.angular.lazyRoutes` | `lazyRoutes.length` | ✓ | `0` |
| `project.testing.builder` | `stack.testing.value.builder` (`architect.test.builder` / Nx `executor`) | ✓ new | omitted |

`stack.angular.value.builders` records every target's builder (build, serve, test, lint, e2e…) for later templates.

### Styling, tokens and UI

| Placeholder | profile.json source | Scanner | Fallback |
|---|---|---|---|
| `project.styles.ext` / `.language` | `stack.styling.value.preprocessor`: component schematics `style` → `inlineStyleLanguage` → dominant extension (inferred) | ✓ new | else: generic globs |
| `project.styles.languages` | keys of `styles` counts | ✓ | `none detected` |
| `project.styles.globalFiles` | `stack.styling.value.globalStyles` (build `styles` entries, else `styles.*`/`global(s).*`/`src/index.*`) | ✓ new | `none detected` |
| `project.styles.tokenFiles` / `hasTokens` | `stack.designTokens.value.tokenFiles` (path names token/theme/variables/palette/brand…, or ≥ 8 custom-property/LESS/SCSS variable definitions) | ~ new | else-branch |
| `project.styles.themes` | `stack.designTokens.value.themes` (library theme entries in build styles, Material theme mixins, Tailwind config) | ~ new | omitted |
| `project.styles.fontFamilies` | `stack.designTokens.value.fontFamilies` (literal `font-family` values in global/token styles) | ~ new | omitted |
| `project.styles.utility` | `stack.ui.value.css` (bootstrap, tailwindcss, primeflex…) | ✓ new | omitted |
| `project.styles.cssModules` | `cssModules.length > 0` | ✓ | false |
| `project.ui.components` | `stack.ui.value.components` | ✓ new | `none detected` |
| `project.ui.layout` | `stack.ui.value.layout` (flex-layout packages) | ✓ new | omitted |
| `project.ui.icons` | `stack.ui.value.icons` | ✓ new | `none detected` |

A UI entry is `used` when it is imported from source, referenced in build styles or scripts, or imported from global styles. Otherwise its confidence is `declared`.

### i18n and state

| Placeholder | profile.json source | Scanner | Fallback |
|---|---|---|---|
| `project.i18n.library` | first of `stack.i18n.value.libraries` | ✓ new | note |
| `project.i18n.hasI18n` | `stack.i18n.value.libraries` or resource files present | ✓ | false |
| `project.i18n.resourceDirs` | `stack.i18n.value.resourceDirs` (`i18n/`, `locale(s)/`, `translations/`… JSON/XLIFF/PO/ARB) | ✓ new | omitted |
| `project.state.libraries` | `tooling.state` | ✓ | `none detected` |

`stack.i18n.value.locales` holds the Angular workspace `i18n` source locale and locales.

### Testing, lint and Sonar

| Placeholder | profile.json source | Scanner | Fallback |
|---|---|---|---|
| `project.testing.runner` | `stack.testing.value.runner`: test builder → `karma.conf.*`/`jest.config.*`/`vitest.config.*`/`vite.config.*` with `test:` → declared package | ✓ new | else: stop and ask |
| `project.testing.framework` | Jasmine/Mocha for Karma (from packages); omitted when it would repeat the runner | ✓ new | omitted |
| `project.testing.configFiles` | `stack.testing.value.configFiles` | ✓ new | `none detected` |
| `project.testing.libraries` | `stack.testLibraries.value` | ✓ new | `none detected` |
| `project.testing.specSuffix` / `.specGlob` | dominant `stack.specs.value.suffixes` (e2e folders excluded) | ✓ new | else: generic globs |
| `project.testing.specLocation` | `stack.specs.value.locations` (co-located / `__tests__` / separate) | ✓ new | else: "where nearby tests live" |
| `project.testing.specCount` / `project.hasSpecs` | `stack.specs.value.count` | ✓ new | `0` / false |
| `project.testing.coverageReport` | `stack.sonar.value.properties.coverageReport` (lcov report paths) | ~ new | else: inspect runner config |
| `project.lint.tool` / `.configFiles` | `stack.lint.value` (lint builder, `eslint.config.*`/`.eslintrc*`/`tslint.json`, packages) | ✓ new | note |
| `project.sonar.present` | `stack.sonar.value` is non-null (`sonar-project.properties`, CI files mentioning Sonar, scanner packages) | ✓ new | false → section omitted |
| `project.sonar.configFile` / `.projectKey` / `.exclusions` / `.coverageReport` | allow-listed keys of `sonar-project.properties` | ✓ new | note |

`stack.e2e` (Playwright/Cypress/Protractor) and `stack.formatter` (Prettier) are recorded but not yet used by a template. Sonar credentials, tokens and server URLs are never read into the profile.

### Routes and main files

| Placeholder | profile.json source | Scanner | Fallback |
|---|---|---|---|
| `project.routes.count` / `.hasRoutes` / `.files` | `routes.value` | ✓ | `0` / false / `none detected` |
| `project.routes.table` | `routes.value.tree` (`path`, `fullPath`, `kind`, `file`, `line`, resolved `targetFile`) | ✓ | section omitted |
| `project.architecture.entryFiles` | `mainFiles.value.entries` (bootstrap, `createRoot`, `hydrateRoot`) | ✓ | `none detected` |
| `project.architecture.rootRouteFiles` | `mainFiles.value.rootRoutes` | ✓ | `none detected` |
| `project.architecture.appConfigFiles` | `mainFiles.value.appConfig` | ✓ | `none detected` |
| `project.architecture.hubFiles` | `mainFiles.value.hubs` (first-party files imported by at least two others) | ✓ | `none detected` |

Each of `routes` and `mainFiles` is a fact: `value`, `evidence` (paths) and `confidence` (`observed` or `unknown`). Lazy Angular targets resolve through relative imports and local tsconfig `paths` / `baseUrl`. Child routes mounted with `loadChildren` inherit the mount path. React Router `<Route path>` and Next `app/` or `pages/` files are recorded the same way. A route entry does not prove runtime registration.

### Architecture

| Placeholder | profile.json source | Scanner | Fallback |
|---|---|---|---|
| `project.architecture.serviceDirs` | directories of `services[]` with `scope: root` | ✓ | `none detected` |
| `project.architecture.sharedDirs` | inventory folders named `shared` | ~ | `none detected` |
| `project.architecture.entryFiles` / `rootRouteFiles` / `appConfigFiles` | `mainFiles.entries` / `.rootRoutes` / `.appConfig` | ✓ | empty list |
| `project.architecture.hubFiles` | `mainFiles.hubs[]` as `file (N importers)` | ✓ | empty list |
| `project.routes.count` / `hasRoutes` / `table` | `routes.count`; `hasRoutes` is `count > 0`; `table` is a Markdown table of up to 25 routes | ✓ | 0 / false / section omitted |

### Semantic review only

None of these can be established by static analysis. Each is filled from `rw-harness-builder` findings; until then the template shows its else-branch or the unknown note.

| Placeholder | Meaning |
|---|---|
| `semantic.architecture.summary` | Feature areas, module boundaries, data flow |
| `semantic.conventions.list` / `.naming` / `.lineLength` / `.rxjs` | Team conventions beyond lint config |
| `semantic.ui.precedence` / `.mapping` / `.sharedComponents` / `.icons` | Which UI library wins, the need → component table, reusable shared components |
| `semantic.i18n.pattern` / `.keyNaming` | Exact binding pattern for visible text and key naming |
| `semantic.services.httpPattern` / `.coreServices` / `.errorHandling` / `.caching` | Shared request wrapper, core service inventory, central error path |
| `semantic.styles.breakpoints` / `.layoutOffsets` / `.tokenImport` | Breakpoint variables and their form, fixed chrome widths, token import idiom |
| `semantic.testing.mockingStyle` / `.coverageTarget` / `.skipPatterns` | Mock idiom, agreed coverage target, files never tested |
| `semantic.migrations` | Active phased-migration areas and their plan documents |
| `semantic.docs.designDocDir` / `.syncRule` | Where design documents live; documentation sync rule |
| `semantic.branding.source` / `.fontFamily` / `.palette` / `.typography` / `.components` / `.notes` | Design-system source of truth and its values |
| `semantic.domain.*` (`name`, `slug`, `triggers`, `overview`, `sourceOfTruth`, `architecture`, `keyFiles`, `acceptanceCriteria`, `constraints`, `designLink`, `translationKeys`, `tests`) | One feature/domain agent per identified feature |

## Emit conditions (for the later generator step)

| Template | Emit when |
|---|---|
| `agents/design-reviewer`, `skills/design-compliance` | Figma requested or a Figma hint detected |
| `agents/integration-specialist` | Azure DevOps or Jira requested (`--integrations` or the studio picker) |
| `agents/a11y-label-fixer` | Sonar detected on any project |
| `agents/feature-domain` | once per `semantic.json` `domains[]` entry; never without a safe `slug` |
| `instructions/templates`, `instructions/components`, `instructions/services` | Angular or React project; the `applyTo` globs switch on framework |
| all others | always |

There is no defect-analyst agent and no PR-reviewer agent. A defect follows researcher → implementer or test-fixer → reviewer. Pull-request review is the existing reviewer, and it does not merge. The orchestrator and catalog list exactly the agents that were generated. Agent, skill, prompt and scoped instruction file names start with `repo.prefix`. Earlier `rw-*` files are left in place.

Rendered frontmatter must still be validated as YAML. An unknown note inside a quoted description is valid YAML, but values containing quotes would not be.

## Original → template mapping

| Original file | Template | Universal (kept) | Project-specific (parameterised) |
|---|---|---|---|
| `copilot-instructions.md` | `root/project.instructions.md` | Layout of the root file, generator-versus-fixer rule, safety rules, agent index | Stack table, versions, module counts, folder paths, commands, Sonar key and coverage path, migration area, docs-sync rule |
| `AUTHORING-STANDARD.md` | `root/AUTHORING-STANDARD.md` | Taxonomy, precedence, frontmatter order, body sections, style, one-owner conflict rule, secrets | Style-language name in the owner table; docs-sync target |
| `agents/angular-orchestrator.agent.md` | `agents/orchestrator.agent.md` | Route classification table, stage workflow, parallel-only-when-independent, output contracts, "do not do the work yourself", repair budget (from harness) | Tracker/design tool names and their steps (conditional), project name |
| `agents/angular-planner.agent.md` | `agents/planner.agent.md` | Planning process, output format, design document rule "read every file first" | Shared component list, tracker tool IDs, NgModule rule, docs folder |
| `agents/angular-implementer.agent.md` | `agents/implementer.agent.md` | Process, minimal scope, "raise design vs branding conflicts", static-analysis cleanliness list | UI precedence, layout library, i18n binding, services folder, line length, composition rule |
| `agents/angular-ui-styling.agent.md` | `agents/ui-specialist.agent.md` | Branding as system of record, template and style rules, intrinsic responsiveness, report design vs inferred values | Breakpoints and their values, nav width offsets, translation pattern, layout directives, style language |
| `agents/angular-unit-test-generator.agent.md` | `agents/test-generator.agent.md` + `skills/missing-tests` | Generator-only scope, strict preservation, skip rules, pragmatic omission, large-file breakdown, cleanliness | Runner and versions, forbidden libraries list (now "only installed libraries"), spec suffix, coverage target |
| `agents/angular-test-fixer.agent.md` | `agents/test-fixer.agent.md` + `skills/test-triage` | Fixer owns existing tests, fix process, behaviour-not-internals, report production fixes | Runner, common-failure table (kept generic and Angular-conditional), command |
| `agents/angular-reviewer.agent.md` | `agents/reviewer.agent.md` | Severity model, AC status vocabulary, read-only, phased-migration exception rules | Checklist items tied to the UI library, i18n pattern, breakpoint variables, migration path |
| `agents/angular-figma-reviewer.agent.md` | `agents/design-reviewer.agent.md` + `skills/design-compliance` | Compare areas, report format, never approve without a design, branding cross-check | Design tool name; translation pattern |
| `agents/pr-review.agent.md` | not emitted | Pull-request review stays on `agents/reviewer.agent.md` | — |
| `agents/defect-analyser.agent.md` | not emitted | Defect route is researcher → implementer or test-fixer → reviewer | — |
| `agents/azure-devops.agent.md` | `agents/integration-specialist.agent.md` | Read-first, no invented state, secure credential flow | Tracker product; organisation/project identifiers removed |
| `agents/research-agent.agent.md` | `agents/researcher.agent.md` + `prompts/codebase-audit` | Security catalogue, audit categories, read-only terminal, redact secrets | Framework/RxJS/TypeScript versions, domain-specific research topics removed |
| `agents/sonar-id-label-fixer.agent.md` | `agents/a11y-label-fixer.agent.md` | Report/fix modes, golden rules, id strategy, aria-label priority | Sonar rule reference (conditional), Material directive specifics generalised, scope folder |
| `instructions/angular-components.instructions.md` | `instructions/components.instructions.md` | Lifecycle, change-detection caution, typing, size, error-handling rules | Composition, prefix, UI library list, service counts and paths, translation loader |
| `instructions/angular-templates.instructions.md` | `instructions/templates.instructions.md` | Must-translate list, no inline styles, Grid-only-where-needed, `(keyDown)` trap, accessibility | Translation pattern, UI mapping table, shared component list, icon sources |
| `instructions/angular-styles.instructions.md` | `instructions/styles.instructions.md` | Two-layer tokens, no literals, strict-rules table, scoped deep overrides, gap | Preprocessor, token paths and import idiom, breakpoint strings and values, nav offsets |
| `instructions/angular-services.instructions.md` | `instructions/services.instructions.md` | Parameter API, no nested subscribe, mandatory cache invalidation, server-side authorisation | Core service table, REST wrapper, error service, date library |
| `instructions/angular-specs.instructions.md` | `instructions/specs.instructions.md` | Test priorities, behaviour-not-internals, preservation, cleanliness | Runner/version, setup example, coverage path |
| `instructions/daf-branding.instructions.md` | `instructions/branding.instructions.md` (generic) | Structure only: palette, typography, components, rules | **All values are company branding — not templated.** Filled from the target's token files and design source. |
| `agents/global-vehicle-search.agent.md` | `agents/feature-domain.agent.md` (generic) | Shape of a feature agent: source-of-truth doc, overview, architecture, key files, ACs, constraints | **Domain-specific, not templated** — feature IDs, routes, APIs, codes, ACs and design links belong to one product |
| `agents/pending-sharing-request.agent.md` | `agents/feature-domain.agent.md` (generic) | Same as above, plus per-feature design-token overrides | **Domain-specific, not templated** — including feature colours and cookie rules |
| `agents/README.md`, `instructions/README.md` | — | Indexes; regenerated from the emitted set | — |
| `prompts/`, `skills/` | — | Not present in the supplied system. The templates in `prompts/` and `skills/` were derived from procedures embedded in the agents above | — |

## Files

```text
root/          project.instructions.md, AUTHORING-STANDARD.md
agents/        orchestrator, planner, implementer, ui-specialist, test-generator, test-fixer, reviewer,
               design-reviewer, integration-specialist, researcher, harness-builder,
               a11y-label-fixer, feature-domain (.agent.md)
instructions/  components, templates, styles, services, specs, branding (.instructions.md)
prompts/       plan-feature, deliver-feature, generate-missing-tests, fix-failing-tests, review-changes,
               codebase-audit, generate-design-doc, bootstrap-harness (.prompt.md)
skills/        architecture-discovery, bootstrap, deliver, design-compliance, design-doc, mcp-onboard,
               missing-tests, quality-review, scaffold, system-refresh, test-run, test-triage (/SKILL.md)
```
