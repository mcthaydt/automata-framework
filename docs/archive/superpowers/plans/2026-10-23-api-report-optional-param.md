# API report: a new optional trailing parameter is not a break TDD plan

- **Spec:** [PRODUCT spec](../specs/2026-10-16-product-core-and-plus-design.md) §2 F6 (the API break check; "additions are not breaks"); `tooling/api-report/src/breaks.ts` header.
- **Task:** `Follow-up (found in DX.2) — API report counts an added optional parameter as a break` (02). Lane ship, PRODUCT.1.
- **Status:** drafted 2026-10-23, based on `main`. No PR is opened until the shared runner's queue drains (the merge thread asked for that); the branch is pushed so the work is not lost.
- **Progress:** 4 of 4 steps.

## What is wrong

`apiBreaks` compares each export's declaration as text, so any change counts as a break. DX.2's `goldenCommands(options?)` gained an optional parameter and needed a `BREAKING:` line although every existing call still works. Adding a member to an interface does break implementers, which is why interfaces stay strict; a function is different, because callers cannot implement it.

## Decisions

- **Only the function case.** A `function` export whose head declaration is its base declaration with optional parameters appended is additive. Everything else keeps today's rule: any text change is a break. Interfaces, classes, types and constants do not change.
- **"Appended" is checked on the parsed declaration, not on text.** Both declarations are parsed with the TypeScript parser `extract.ts` already uses (`typescript` is a dev dependency of this package). The head is additive when it has exactly one function signature (overloads stay strict), the same name, type parameters and return type text, every base parameter matches the head's at its position (name, optionality, rest, type text), and each extra head parameter is optional and not a rest. The parameter's type text is compared as written: a changed type is a break even when it is wider, because the check cannot tell.
- **Names are compared.** A renamed parameter is not a break for callers, but the check would then be reasoning about more than "optional parameters were appended"; it stays conservative, and a rename is declared like any change.
- **No new option, no changeset.** `tooling/api-report` is private. The break message and CLI are unchanged; a PR that only appends an optional parameter now reports no break, so it needs no `BREAKING:` line.

## Files

- **Modify:** `tooling/api-report/src/breaks.ts` (the check), `tooling/api-report/src/breaks.test.ts` (planted cases); `docs/02-master-delivery-plan.md` (the follow-up row); this plan.
- **No changeset:** the package is private.

## Interfaces

- **Consumed:** `ApiExport.declaration` and `kind` (`extract.ts`), `ts.createSourceFile`.
- **Produced:** `apiBreaks` keeps its signature; it stops reporting a function whose only change is appended optional parameters.

## Steps

- [x] **1. The cases, red first.** In `breaks.test.ts`, planted reports for: an optional parameter appended (no break), two appended (no break), a required parameter appended (`changed`), an optional parameter inserted before an existing one (`changed`), an existing parameter's type changed (`changed`), a return type changed while one is appended (`changed`), a rest parameter appended (`changed`), an overloaded declaration with one appended (`changed`), and a non-function export (an interface with an added optional member stays `changed`). Run `pnpm --filter @mcthaydt/api-report test:unit`; only the first two fail, on the current text comparison.
- [x] **2. The check.** Implement it in `breaks.ts`; all cases pass.
- [x] **3. Against the real reports.** `pnpm api-report` against `origin/main` still passes and the committed reports are unchanged (`pnpm api-report --update` writes nothing).
- [x] **4. Gates and docs.** `pnpm format`, `pnpm check`; update 02's row.

## Gates

- Selected: `pnpm check`; the api-report unit tests; `pnpm api-report`.
- Omitted here, pending on CI: the rest of CI.
- No changeset.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-23 | Plan | `184e71b` | |
| 2026-10-23 | 1 | | Nine planted cases added to `breaks.test.ts`. Red: `pnpm --filter @mcthaydt/api-report test:unit` 2 failed, 61 passed; the two failures were exactly the additive cases (one and two optional parameters appended, each reported as `changed` by the text comparison), and the seven break cases already passed, so they pin the conservative side. |
| 2026-10-23 | 2 | | `onlyAppendsOptionalParameters` in `breaks.ts`, parsing both declarations with the TypeScript parser `extract.ts` uses. 63 passed; `pnpm --filter @mcthaydt/api-report typecheck` clean. |
| 2026-10-23 | 3 | | `pnpm api-report` against `origin/main`: 12 core packages, 0 breaks, 0 undeclared; `pnpm api-report --update` rewrote the reports byte for byte (`git status` shows only the two source files). |
| 2026-10-23 | 4 | | `pnpm format` (no fixes) and `pnpm check` 30 of 30 tasks, exit 0. 02's row updated; its execution record and 03 come with the docs sync PR. |
