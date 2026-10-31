# Plus 1.0 hardening (TDD plan)

- **Branch:** `claude/plus-1-0-hardening`, from main `4065924`; one PR, one commit per part.
- **Origin:** the coordinator's assignment of 2026-10-31 (22:00Z). Rows: PRODUCT.1b (the Plus part), the M6.2 remainder
  (automata-plus#33, "Out") and the M6.10b remainder (automata-plus#34, "Not done", AU-D6). Specs: PRODUCT §2 F1 and §10,
  the framework's M6 spec §4.2 and §4.10.
- **Status:** plan drafted; no part built. CI verified, deployed and Owner accepted: not yet.

## Scope

### Part 1: seam reachability (PRODUCT.1b)

PRODUCT.1b1 (the F1 boundary test, plus#3) is merged and `runtime` and `render-pixi` are published (DX.2a, #227), so both are in
`.core/packs`. The boundary test checks every import against the packed `exports`, but nothing checks the other direction: that
each F1 seam in the framework's `tooling/api-report/src/seams.ts` is reachable through a public entry of an installed pack. Without
it, a core change that drops a seam's entry would pass here until a Plus package tried to import it.

- Create `tooling/boundary/seams.ts` (`seamFindings(root, seams?)`) and `tooling/boundary/seams.test.ts`.
- `seamFindings` loads `SEAMS` from `.core/af/tooling/api-report/src/seams.ts` (the framework checkout at `core.ref`) and returns one
  message per seam whose `package` and `entryPoint` are not in `publicCoreEntries(root)`.
- Tests (red first, against an empty module): a seam whose entry is public passes; a seam of a package with no pack fails and names
  the seam, package and entry; a seam on a deep path that is not an `exports` key fails; the real workspace has no finding.
- No framework change. The "publish runtime and render-pixi" half of the row is done by DX.2a.

### Part 2: debug, extension panels and the real-browser layout (M6.2 remainder)

- **Extension panels (DBG-D4).** `debug` imports no extension (they are not its peers), so an extension hands the game a plain
  summary and `debug` shows it: `DebugHost.summaries?: Readonly<Record<string, SummaryPort>>` (`SummaryPort` is the existing
  `{ summary(): unknown }` shape of `NetDiagnosticsPort`), and `summaryPanel(id, title)` in `packages/debug/src/panels.ts` returns a
  `DebugPanelDef` over one generic `SummaryPanel.svelte` that lists `summaryRows(source.summary())`, refreshed four times a second,
  with "No <id> summary installed." when the host has none. Shipped panels are unchanged.
  - `packages/puzzle/src/sim/puzzle-debug.ts`: `puzzleDebugSummary(state: PuzzleStateValue)`: facts (sorted), items, actions seen, goal.
  - `packages/narrative/src/sim/narrative-debug.ts`: `narrativeDebugSummary(dialogue: NarrativeDialogueValue)`: graph, place, stance, facts.
  - `nav` and `systems` are post-1.0 (launch cut) and get no panel.
  - Tests: `summaryPanel` validates like `debugPanels`; the panel renders rows from a fake port, updates on the timer, and says so
    with no port; each summary function maps a state to rows (sorted keys, no mutation).
- **Real-browser layout (DBG-L).** `packages/debug/vitest.config.ts` gains a `browsers` project (Chromium through
  `@vitest/browser-playwright`, as `narrative`). A test mounts `DebugOverlay` with the shipped panels at 360x640 and 640x360 and
  asserts from real geometry: the overlay sits inside the viewport, the tab bar scrolls inside its declared region, the panel body
  is a scroll region, every tab, "Pause sim" and Close are at least 44 px high and reachable, and a long panel scrolls inside the
  body instead of pushing Close out of view. If the CSS fails any of it, fix the CSS (test first).
- Out (unchanged): the example `debug/debug-panel.ts` (no Plus examples runner, EX.4p), `automata build --debug`, `?debug&carry=`.

### Part 3: audio, the music loudness check (M6.10b remainder)

- **AU-D6 is reversed for recorded-music loudness only.** The coordinator asked for it; the default is a `[music]` table in
  `audio.pipe.toml` (`dir`, `lufs`, `tolerance_lu`, `true_peak_dbtp`). `check` decodes every `.wav` in `dir` with the existing
  `measure` module and adds a `music-loudness` row: each file within the target and under the ceiling; a file that is not a WAV
  is a failure that says it cannot be measured (never a skip, never a pass); no `[music]` table means no row.
- Files: `tooling/pipelines/src/audio.pipeline.ts` (spec field and check row), `audio.pipeline.test.ts` (red first: a loud file, a quiet
  file, a non-WAV file, an in-tolerance file, no table), a generated fixture WAV written by the test (no binary files committed).
- **Blocked, not built:** legacy parity and the space (convolver) probe need the adventure source, which is not on this machine. They
  stay open in this plan until it is supplied; nothing is invented. The sample budget stays out: it is core's asset budget (M5),
  and a second implementation here would be a second owner.

## Decisions for the Owner's veto

- **DBG-D4:** extension panels read a plain `summary()` the extension exports, shown by one generic panel, so `debug` stays free
  of extension imports. Default taken.
- **AU-D6 (amended):** recorded-music loudness is checked by `pipe audio check` from a `[music]` table; the sample budget is not.
- **DBG-L:** the layout check runs in Chromium in Plus CI (headless Chromium is already required by the audio pipeline's tests).

## Interfaces

- Produces: `seamFindings`; `DebugHost.summaries`, `summaryPanel`, `SummaryPort`; `puzzleDebugSummary`; `narrativeDebugSummary`;
  `AudioPipeSpec.music` and the `music-loudness` check row.
- Consumes: `publicCoreEntries`, `SEAMS` (the framework's `seams.ts` at `core.ref`), `summaryRows`, `decodeWav` and
  `integratedLoudness` and `truePeak` from `audio-synth/measure`.

## Steps

- [x] 1. This plan (first commit).
- [x] 2. Part 1: failing `seams.test.ts`, then `seams.ts`; `tooling/boundary` green.
- [ ] 3. Part 2a: failing summary-panel and summary-function tests, then `summaryPanel`, `SummaryPanel.svelte`, the two summaries.
- [ ] 4. Part 2b: failing browser layout test, then any CSS fix.
- [ ] 5. Part 3: failing music-loudness tests, then the spec field and check row.
- [ ] 6. Gates: `pnpm exec biome check --write`, `pnpm format`, `pnpm check`, and the browser projects named below.

## Gates

Selected: each touched package's tests while iterating; at the end `pnpm check`, the `debug` browsers project and
`tooling/pipelines` tests. Omitted: golden and parity projects (no sim or renderer touched), changesets (all packages private).
Pending: Plus CI on the head.

## Execution log

(empty)
