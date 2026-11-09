# Audio plan audit

Status: plan audit, 2026-11-08. Audits [`2026-11-08-audio-spec.md`](2026-11-08-audio-spec.md) and
[`2026-11-08-audio-plan.md`](2026-11-08-audio-plan.md) against the shared
[`2026-11-08-content-editors-spec.md`](2026-11-08-content-editors-spec.md), the content-in-play plan (PR #479/#481) and
the code on `claude/project-thread-j53mj6` at `9abece4f`. Every finding was checked in the code named beside it. The
fixes are applied to the spec and plan in the same commit as this audit.

## 1. Verdict

The editor's model work matches the schema. But no game plays `audio.toml`: a sound picked for an event in Audio is
never heard in play, which breaks the Owner's standing rule that edited content is proven in play by a served journey
(A1, A2). The music pieces and rules have no player at all (A4), so they wait for the Owner's call, recommended out of
this build. "Check the sounds" was planned through a pipeline a made game cannot run, and is moved into the page,
where the renderer and the measures already work (A5). The events page missed that only the first matching row plays
(A3).

## 2. Findings

| # | Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- | --- |
| A1 | Blocker | Nothing plays `audio.toml` in a game. `audioSynthExtension` registers only the content kind; `createAudioSynth` is called by no game, example or core module (only the debug board and the pipelines). | `extensions/audio-synth/src/app/audio-synth.extension.ts:1-11`; `grep createAudioSynth` over `games/ examples/ packages/` | New Task 6, **Audio in play**: `@automata/audio-synth/stage` exports `audioStage({ content, port })`, a `PixiRendererOptions.setup`: `apply(result)` hears the step's events, `draw` calls `frame(drawnTick)`. The `MixerPort` comes from core's audio buses (`AudioBuses.input`, `Audio.duck`); core exports `AudioBuses` only as a type today (`packages/automata/src/entries/runtime.ts:19`), so the task first finds the game's way to its buses and, if there is none, adds one to core with a changeset. `examples/2d-story` wires it. |
| A2 | Blocker | No served journey. | Plan Task 5 | New Task 7: in `examples/2d-story`, Audio makes a sound "Alarm" and picks it for "the guard changes mode"; Save; Play; the guard sees the player; the stage's `played` (through the game's test hook) holds `alarm`. Left unchecked, and named, if the example has not landed. |
| A3 | Major | Only the **first** event row that matches plays (`rowFor`), unlike Feel, where every matching entry plays. Order decides, and the spec says nothing. | `extensions/audio-synth/src/features/synth/audio-synth.ts rowFor` | The page lists rows in file order; a row a row above it shadows says "Never plays: any player event above answers first." with **Move up**; rows move with one undo step. |
| A4 | Major (Owner's call) | Music pieces (`slot`) and rules (`music_rule`) are played by nothing: `createMusicDirector` is unused, and a rule's state keys come only from game code. Editing them would not show in play. | `grep createMusicDirector` (audio-synth only); `audio.schema.ts musicRule` | Decision card posted in the thread, recommending they wait. The plan marks Task 3 deferred and keeps the spec's words for when it returns. If kept: a rule with no conditions is `when = {}` (`when` is required), never a missing key. |
| A5 | Major | **Check the sounds** through the checks port needs `automata-pipe audio`, which reads an `audio.pipe.toml` in a scene folder no `create-game` game has, and its findings reach the suite as `rule: message` text with no key path, so they cannot be pinned to a sound. Yet the renderer and the measures run in a page today. | `extensions/pipelines/src/features/audio/audio-pipeline.ts:1`; `packages/editor/src/features/suite/node/argv-checks.ts parseOutput`; `@automata/audio-synth/render`, `/measure` | **Check the sounds** renders each sound in the page (`renderCue` on an `OfflineAudioContext`) and measures it (`truePeak`, `clicks`, `integratedLoudness`), on request. No checks port, no sample check row, no pipeline import. |
| A6 | Minor | Two owners of "what plays when something happens": core's `defineGame({ sounds })` maps events to recorded files, and Audio's `event` rows to synth sounds. The spec does not say how they meet. | `packages/automata/src/features/audio/event-sounds.ts` | Spec §2 says it: Audio's rows play its sounds (a sound with a recorded file plays that file through the same mixer); a game's `sounds` in code is the code's and Audio does not show it. |
| A7 | Minor | "The names under the game's assets that the asset manifest lists" names no file. The manifest is `content/assets.toml`. | `packages/content/src/shared/compile/read-sources.ts:25` | Spec §4 and Task 3 name `content/assets.toml`, read through `workspace.read`. |
| A8 | Minor | No browser project for the Chromium layout test (see Feel F10). | `extensions/editors/vitest.config.ts` | Uses the project Feel's Task 4 adds. |

## 3. Drunk grandma

"Tap to hear", "Nothing plays yet", "Keep it quiet" and the duck sentence pass. The check sentences ("Too loud at its
peak: −0.4 dB. Keep it under −1 dB.") pass. "Plays on: Sound effects" passes. The new shadowed-row sentence is written
to the same test (A3).

## 4. What was checked and holds

The schema's fields and names (`cue`, `bed`, `event`, `duck`, `slot`, `music_rule`, `master_gain`, the hiss as one
pitch or a `[low, high]` pair, `silent` as words); `playCue` and `startBed`; the `AudioPlay` port already in
`audio-session.svelte.ts`; the template row in Task 5.
