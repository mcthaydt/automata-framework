# M6.0a: M6 spec amendment, the 3D revision and a re-read at the recorded commit (plan and log)

> **Row:** `docs/02-master-delivery-plan.md` M6.0a (integration, docs only, size S), assigned to the website and Plus
> lane by the coordinator on 2026-10-31. **Branch:** `claude/af-M6.0a-spec-amendment`. Files:
> `docs/superpowers/specs/2026-10-16-m6-gameplay-extensions-design.md` and a new `docs/provenance/sources.md`, holding M6's
> entries only.

## Steps

1. [x] Re-read the adventure source at the recorded commit (`docs/provenance/sources.md`):
   - the §2.3 leaks, all still present (line numbers updated: `level.ts` 1, 35; `cutscenes.ts` 1, 134;
     `cutscene-lint.ts` 14 to 22; `simulation.ts` 17; `dialogue.ts` 27; `feel/runtime.ts` 18);
   - the 16 generated route tests (bay 8, clinic 5, clinic-dawn 2, prologue 1, unchanged);
   - the new modules (`wc -l`; `it(`/`test(` counts): storylets 347 lines and 19 tests; conversations 47, 164 and 291
     lines, with `conversation-audit` 3 tests; delivery 191 lines and 21 tests; portraits 103 lines and no test file
     found; music 151, 164 and 195 lines and 43 tests.
2. [x] Amend the spec:
   - a dated M6.0a note under the status line;
   - neutral source names, with repositories and commits moved to `docs/provenance/sources.md`;
   - Plus is free (APP §3);
   - `base-adventure` grows from `base-3d`, and `sectors` uses camera views and `occlude`;
   - cutscenes use free-shot cameras and figure clips;
   - one sector-format owner (M6-D15);
   - AF-side leak fixes (M6.3, M6-D2, L-a);
   - the §4.13 scope call (M6-D16);
   - targets are peers (§9, §11, X-a; ADR 0006);
   - X-c and X-d dropped from §12.
3. [x] Check every relative link in both files resolves.

## Gates

Docs only. Every relative link resolves; no source name remains in the spec. `pnpm check` is omitted because no code,
test or config changes, and Biome does not read Markdown.

## Decisions for the Owner's veto

- M6-D15: the sector format's owner is core's `@mcthaydt/automata-editor-3d` `format/`.
- M6-D16: the source's new modules fold into `narrative`, `cutscenes` and `audio-synth`; no new package.
- Neutral names: "the adventure source" and "the arcade source".
