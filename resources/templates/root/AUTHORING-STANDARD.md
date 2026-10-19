{{! Source: AUTHORING-STANDARD.md. Target: .github/AUTHORING-STANDARD.md (or .repoweave/AUTHORING-STANDARD.md). Universal; only the owner table is parameterised. }}
# Authoring standard — {{project.name}}

How every instruction, agent, prompt and skill file for this repository is written. Read this before adding or editing one.

## 1. File taxonomy

| Type | Loaded | Purpose |
|---|---|---|
| Root instructions | Always | Project facts, stack, conventions, safety rules |
| Path instructions | When a matching file is open or edited | Conventions for one file type |
| Agents | On invocation | A role with a defined scope, tool set and output contract |
| Prompts | On invocation | A repeatable task, parameterised |
| Skills | On keyword match | A procedure with a fixed workflow |

**Precedence, highest first:** root instructions → path instructions → agent → prompt/skill. A lower layer must never contradict a higher one. If it needs to, the higher layer changes first.

## 2. Frontmatter

Keys appear in a fixed order. Omit keys that do not apply; never reorder.

- Instructions: `description`, `applyTo`.
- Agents: `name`, `description`, `tools`, `user-invocable`, `argument-hint`.
- Prompts: `description`, then `agent` only when the prompt delegates.
- Skills: `name`, `description`.

Rules:

- `name` is kebab-case and matches the filename stem.
- `description` starts `Use when:` for instructions and agents, so trigger matching is consistent.
- `tools` uses short aliases (`read`, `search`, `edit`, `execute`, `web`, `agent`, `todo`). Never enumerate individual tool IDs — the list rots.
- Omit `tools` entirely to allow all tools. Do not comment it out.
- Do not set `model`. Model choice belongs to the caller.

## 3. Body structure

Sections in this order; omit what does not apply.

| # | Section | Instructions | Agents | Prompts | Skills |
|---|---|---|---|---|---|
| 1 | Purpose / role | ✓ | ✓ | ✓ | ✓ |
| 2 | When to use / when not to | — | ✓ | — | ✓ |
| 3 | Conventions or workflow | ✓ | ✓ | ✓ | ✓ |
| 4 | Examples | ✓ | — | — | ✓ |
| 5 | Constraints and safety | ✓ | ✓ | ✓ | ✓ |
| 6 | Output format | — | ✓ | ✓ | ✓ |
| 7 | Related files | ✓ | ✓ | ✓ | ✓ |

Every file ends with a "Related files" section. Cross-references keep the set coherent as it grows.

## 4. Writing style

- Sentence case headings.
- Imperative mood.
- One rule per bullet.
- State the reason for any non-obvious rule. A rule without a reason gets worked around.
- Code examples show before and after where a migration is implied.
- Do not restate the root instructions. Link to them.

## 5. Conflict rules

Two files must never give different answers to the same question. Each topic has exactly one owner:

| Topic | Owner |
|---|---|
| Stack versions, architecture, safety rules | root instructions |
| Component classes, lifecycle, change detection | `{{repo.prefix}}-components.instructions.md` |
| Markup, i18n, UI-library choice, icons | `{{repo.prefix}}-templates.instructions.md` |
| {{project.styles.language}} styles, tokens usage, responsive, theming | `{{repo.prefix}}-styles.instructions.md` |
| Services, HTTP, data access | `{{repo.prefix}}-services.instructions.md` |
| Unit tests, mocking, coverage | `{{repo.prefix}}-specs.instructions.md` |
| Colours, typography, dimensions, shadows | `{{repo.prefix}}-branding.instructions.md` |

Everything else references the owner rather than repeating it.

{{#if semantic.docs.syncRule}}
## 6. Documentation sync rule

{{semantic.docs.syncRule}}
{{/if}}

## 7. Secrets

No instruction, agent, prompt or skill file may contain a token, key, password or connection string. Reference an environment variable and document how to set it. If a secret has been committed, revoke it before removing it — deletion from the working tree does not remove it from history.

## Related files

- Root instructions — project facts and the agent index
- `.repoweave/harness.md` — routing, handoffs, ownership and bounded repair
