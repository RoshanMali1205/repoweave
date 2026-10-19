{{! Source: angular-services.instructions.md. Target: {{repo.prefix}}-services.instructions.md. Core service inventory and HTTP wrapper are semantic-review facts; caching and security rules are universal. }}
---
description: 'Use when: creating or editing services, HTTP calls, async data flows, caching, or API integration.'
applyTo: '{{#if project.isAngular}}**/*.service.ts{{else}}**/{services,api,hooks}/**/*.{ts,tsx,js,jsx}{{/if}}'
---

# Service conventions

{{#if project.isAngular}}
## Injectable pattern

- `@Injectable({ providedIn: 'root' })` for singletons.
- Feature-scoped services are provided where the feature provides them.
- Check {{project.architecture.serviceDirs}} before creating anything. Do not duplicate.
{{else}}
## Location

- Check {{project.architecture.serviceDirs}} and existing data hooks before creating anything. Do not duplicate.
{{/if}}

## HTTP and REST

{{#if semantic.services.httpPattern}}
{{semantic.services.httpPattern}}
{{else}}
- Use the HTTP client nearby services use. The shared request wrapper, if any, is not yet recorded: [unknown: semantic.services.httpPattern — verify in semantic review].
{{/if}}
- Build query parameters with the client's parameter API, never string concatenation.
- Build request headers through the shared path. Do not compose headers from storage inline — it drifts and bypasses centralised context handling.

{{#if project.isAngular}}
## RxJS

- Import operators individually.
- Chain with `pipe()`.
- Never nest `subscribe()` inside `subscribe()`. Use `switchMap`, `mergeMap` or `concatMap`. Nested subscribes create request waterfalls.
- Use `forkJoin` or `combineLatest` for calls with no dependency on one another.
{{#if semantic.conventions.rxjs}}
- {{semantic.conventions.rxjs}}
{{/if}}
{{/if}}

## Caching reference data

Reference data that is fetched repeatedly and changes rarely should be cached per key, with an explicit invalidation method.

**Cache invalidation is mandatory, not optional.** Wire invalidation into the create, update and delete flows for that data and into any tenant or context switch. A stale list after a user creates a record is a worse defect than the slowness the cache fixes. If invalidation cannot be wired, use a short time-to-live instead of an indefinite cache.

{{#if semantic.services.caching}}
{{semantic.services.caching}}
{{/if}}

## Error handling

- Handle errors on every HTTP observable or promise.
- Catch at the service level when the service owns the fallback behaviour.
- Let errors propagate when the UI needs to react.
{{#if semantic.services.errorHandling}}
- {{semantic.services.errorHandling}}
{{/if}}

{{#if semantic.services.coreServices}}
## Core services — reuse, do not duplicate

{{semantic.services.coreServices}}
{{/if}}

## Security

- Client-side role flags are a UX convenience, not access control. Every write endpoint must be authorised server-side.
- Do not store tokens or PII in web storage unless the project's documented session model requires it.

## Related files

- `{{repo.prefix}}-components.instructions.md` — component-level injection and error surfacing
- `{{repo.prefix}}-specs.instructions.md` — testing services
