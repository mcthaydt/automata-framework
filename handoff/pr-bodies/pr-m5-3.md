## Summary

M5.3 core audio ([plan](docs/superpowers/plans/2026-10-17-m5-3-core-audio.md); M5 spec §4.6, §5, §6, §9, M5-D3, M5-D9; acceptance A-a to A-d). Branched from `main` at `24db7b2`; the first commit is the TDD plan, with the M5.1–M5.8 rows in 02. The rules are ported from FloorFifty at `ac72660` (`managers/audio/graph.ts`, `engine.ts`, `voices.ts`, `model.ts` and `ui/sleep-when-hidden.ts`), along with their tests.

- **The `voice` bus** (M5-D3) is added to `AUDIO_BUS_NAMES`.
- **Graph (`audio-graph.ts`):**
  - routing: source → bus level → bus duck → master;
  - master = the player's level × the host's gain, and is 0 when muted or unfocused;
  - per-bus ducks: the deepest one in force holds; a `master` duck takes every bus down;
  - sleep, wake and resume-on-gesture follow FloorFifty's rules, including Safari's `interrupted` state.
- **Voices and music:**
  - at most 16 one-shot voices; when full, the oldest is cut over 20 ms (A-d);
  - one music slot, which loops and cuts the previous track.
- **The `Audio` service (`audio.manager.ts`), which also implements PRODUCT.1's `AudioBuses` seam:**
  - Unlock: nothing is built until the first `pointerdown`, `keydown` or `touchend` after `Hosting.ready`. Build and resume both run inside the gesture (A-a).
  - Host and page: the host's `audio.gain` multiplies the master (A-b). A hidden page, or a lifecycle `background` whose reasons include `hidden`, sleeps the graph; `active` wakes it (A-c).
  - Loading: decoding is cached per alias. An alias that wasn't preloaded is fetched.
  - Facts: `audio.unlocked`, `audio.unavailable` and `audio.decode.failed`.
  - Disposal: closing the scope stops every voice, closes the context and removes every listener.
- **Boot and game:**
  - `RuntimeServices` gains `Audio` and `AudioBuses`;
  - `RuntimeSeams.createAudioContext` is new;
  - `defineGame({ sounds })` maps a sim event id to a sound and is validated against the plugins' events;
  - `RuntimeTest` defaults to `fakeAudioContext`, which `./testing` exports along with `fakeBuffer`.
- **Example `audio/audio-sound.ts`:**
  - a bell rings every 60 ticks;
  - `chime.wav` is synthesized, with provenance in `examples/resources/sounds/PROVENANCE.md`;
  - new golden `audio-sound.replay`.
- **Checks:**
  - `examples/e2e/audio-sound.e2e.ts`: no `AudioContext` before the first gesture; exactly one, `running`, after it; the chime starts; no console errors or CSP violations.
  - `packages/runtime/src/audio/audio.browser.test.ts`: a new `browsers` project and a runtime `test:parity` script. It checks a real unlock and renders an `OfflineAudioContext` level check (master product, duck down and back).
- **Exports and reports:** API reports regenerated. runtime and game are private, so there is no changeset.

**For review (deviations in the plan):**
- `Audio` has no `Settings` dependency: M5.4's Audio section will call `setGain`, `setMuted` and `muteUnfocused`.
- It needs `PresentationBus` for its three facts.
- An alias is the asset path.
- `sounds` in `defineGame` is new design.
- Sleep follows FloorFifty: a blurred window keeps playing.
- The live real-browser unlock runs in Chromium only. This Linux container has no audio device: WebKit rejects `resume()` ("Failed to start the audio device") and Firefox's `resume()` never settles. The offline level check runs in all three engines.

## Gates (local, `TURBO_FORCE=true`)

GATES_TABLE

**Owner acceptance:**
- sound on a real iPhone (the iOS unlock risk);
- how the example sounds.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01QQDa25MEpciFkK7k5UV2dC
