# Repository discovery contract

## Coverage strategy

Inventory first, then read configs and architecture boundaries, then trace actual source paths. For every first-party package record framework, config chain, entrypoints, ownership and sampled flows. Read all relevant project configuration and all existing customization files. Large source trees require batches; maintain an uninspected-area ledger rather than pretending an unlimited context window.

Exclude .git internals, node_modules, build/cache output, vendor/generated code, binaries, credentials and env values. Respect gitignore and project exclusions; the helper conservatively skips common directories but does NOT implement every gitignore pattern. The assistant must reconcile its inventory with `git ls-files` and applicable ignores before deeper reads. Do not follow symlinks outside the project. Never execute package scripts or imported config code during discovery without checking their effects.

## Evidence to gather

| Area | Inspect and resolve |
|---|---|
| Workspaces | root and nested package.json, workspaces, pnpm-workspace.yaml, nx.json, project.json, turbo.json, workspace.json |
| Dependencies | dependency/dev/peer/optional entries, package manager, lockfiles, engines, actual imports, peer compatibility only if verified |
| Angular | angular.json projects and builders, tsconfig inheritance, main/bootstrap, NgModule declarations/imports/providers, standalone metadata/default by installed version, routes and lazy boundaries, guards, forms, signals/RxJS, interceptors |
| React | Vite/Next/Remix/custom builder, JSX/TSX, app/pages routing, server/client boundaries, providers, hooks, reducers/store, data fetch/query cache, effects and cleanup, SSR/hydration |
| Styling | CSS/SCSS/SASS/LESS per folder, CSS modules, styled-components/emotion, Tailwind, global entrypoints, tokens/themes, overlays/portals, breakpoints, design system, icon and i18n patterns |
| Tests | Karma/Jasmine/Jest/Vitest/Testing Library, Angular TestBed, Playwright/Cypress, setup files, mock conventions, browser requirements, coverage gates/exclusions, CI commands |
| APIs/state | service wrappers, HTTP/fetch clients, auth scope, organization/tenant changes, caching invalidation, error ownership, realtime connections |
| Tooling | eslint/tslint, prettier/editorconfig, bundler aliases, build targets, budgets, environment substitutions, CI and scripts without exposing values |
| Existing rules | root and nested instructions, migration plans, branding, reusable widgets, feature-specific constraints |

## Angular classification

Record bootstrap style separately from component composition. An application may bootstrap with an NgModule and import standalone components. Absent standalone metadata is version-dependent; do not classify it from a regex alone. Record lazy-load route references and verify import boundaries; standalone conversion does not prove lazy loading. Never prescribe an upgrade during bootstrap.

## Profile format

`schemaVersion` stays at 1. Added fields keep older readers able to ignore them; existing fields keep their meaning.

Top level: `schemaVersion`, `generatorVersion`, `name`, `rootName`, `inventoryMode`, `inventory`, `projects`, `existingInstructions`, `configFiles`, `inputHashes`, `edges`, `integrations`, `coverage`, `unknowns`, `warnings`, `fingerprint`.

Each project: `id`, `root`, `name`, `manifest`, `frameworks` (`package`, `declared`, `resolved`, `lockfile`, `evidence`, `used`), `dependencies`, `composition`, `bootstrap`, `modules`, `services`, `lazyRoutes`, `clientBoundaryFiles`, `styles`, `cssModules`, `tooling`, `packageManager`, `commands`, `tsconfigs`, `configFiles`, `tokenFiles`, `sourceFiles`, `angularConfig`, `stack`, `routes`, `mainFiles`.

`routes` and `mainFiles` are facts `{value, evidence, confidence}`. Confidence is `observed`, `declared`, `inferred` or `unknown`. `routes.value` is `{count, files, tree}`. A tree entry has `path`, `fullPath`, `kind` (`component`, `loadComponent`, `loadChildren`, `lazy`, `element`, `redirect`, `children` or `file`), `file`, `line`, and, when a lazy import resolves, `specifier` and `targetFile`. `mainFiles.value` is `{entries, rootRoutes, appConfig, hubs}`. A hub is `{file, inDegree}` for a first-party file imported by at least two others.

`stack` holds `testing`, `specs`, `testLibraries`, `e2e`, `lint`, `formatter`, `sonar`, `i18n`, `ui`, `styling`, `designTokens` and `angular`, each a fact. Import `edges` use `resolution` `relative`, `paths` or `baseUrl` when a local file is resolved. Aliases come from local tsconfig `paths` and `baseUrl`, including `extends` of another file in the repository. An extends that names a package is not followed.

Commands stay descriptors (`cwd`, `argv`, `evidence`, `status: not-run`). `.repoweave/semantic.json` is not part of the profile. When that file is present its hash is added to the plan input hashes. RepoWeave does not write it.
