# What stops a game being made and shipped on an iPad alone

Checked 2026-11-09 for the apps [spec](2026-11-08-apps-spec.md) and [plan](2026-11-08-apps-plan.md), from the Owner's
words of that day:

- 01:53: "I'd like apple pencil to be first class supported, iPad is our actual primary device for creation, between
  Claude code and automata framework suite app; games should be able to be completed end to end".
- 01:58: "with Claude code app and our app - we can take a game from idea to shipped online on our iPad; end to end. Our
  primary surface is Claude code, the editors are just so we can modify things by hand if we need to".

The code was read at `4c855dfa` (`claude/project-thread-nkdoj4`, the tip of #544), which carries every editor. The
go-to-market thread's own list is in the shared folder (`gtm/2026-11-09-paid-app-features.md`); every item of it is
below. Each gap names the task that closes it. "Device" means only a real iPad can prove it, and that run is the Owner's.

## The loop this list is measured against

1. **Idea.** The person asks Claude Code, in the Claude app on the iPad, for a game. Claude Code runs in the cloud and
   works on a GitHub repository.
2. **A game to work on.** The person makes the game in the Automata app ("Make a new game") and puts it on GitHub, or
   gets one Claude already made ("Get a game from GitHub").
3. **Claude builds it.** Claude pushes `claude/…` branches and opens pull requests. The game's own check workflow runs
   on each one.
4. **The person plays each change on the iPad** (Review, "Play it") and says yes or no.
5. **The person fixes things by hand** in the editors, with a Pencil or a finger. The app keeps the game on GitHub,
   so Claude sees the hand edits.
6. **Shipped online.** Publish makes the zip, then puts the game on itch.io through the game's own release workflow.

## Gaps

### The agent loop (steps 1 to 4)

| # | Gap | Evidence | Closed by |
| --- | --- | --- | --- |
| G1 | Claude Code on an iPad runs in the cloud, and the app's agent link is local Wi-Fi only with no relay, so the iPad's only link to Claude is GitHub. The spec told it as a computer story. | spec 11.4 | Spec 1 and 9.4 (GitHub is the iPad's loop); no code |
| G2 | Nothing checks Claude's change before the person says yes: a new game's only workflow runs on release tags, so Review's "This change broke a check" has nothing to read. | `create-game/template-ci/release.yml` (`on: push: tags`) | Task 5.6 (a `check.yml` on pull requests) |
| G3 | Claude can write code the iPad player can't run (a package the app lacks, its own `.svelte` files, another Vite plugin, `paraglide`), and the person finds out only when Play refuses. | spec 7's list; `kit/player` refusals | Tasks 5.7 (`automata check-player`, in the check workflow and the game's `AGENTS.md`) and 6.5 (the Review card says so first) |
| G4 | Pushing a new game's `.github/workflows/*.yml` needs the GitHub App's Workflows permission, which section 8 did not ask for. The first push from the iPad would be refused. | spec 8, "Sign-in" | Task 5.6 (permissions) |
| G5 | Review and sync were app-only. Sync is now free on the web (#528), and the Owner's rule (01:46) is that the app never sells a limit of the web. | spec 3, #536 | Spec 3: Review is free on the web too, through GitHub's REST API |
| G6 | A new game needs an empty repository made on GitHub's own page first, because the app does not ask for the permission to create one. | spec 8, "A new game on GitHub" | Kept: one prefilled page, in the app's own browser sheet, with words. Spec 16 says why |
| G7 | Nothing takes the person from the app to Claude Code with the game ready. | none | Task 5.7 ("Work on this with Claude": copies the repository's name and opens the Claude app) |

### Hand edits with a Pencil (step 5)

| # | Gap | Evidence | Closed by |
| --- | --- | --- | --- |
| G8 | The Sequence and Studio timelines take raw pointer events, outside the gesture kit, so a palm resting on the glass drags a key and the Pencil gets no "Pencil edits, fingers move the view" rule. | `SequenceTimeline.svelte:45,91,136`, `StudioTimeline.svelte:58,99` | Task 1.5 |
| G9 | The Studio's stage uses the kit but has no Pencil rule: a Pencil drag on empty stage turns the camera, as a finger does. | `StudioCanvas.svelte:157` | Task 1.5 (in Pose, the Pencil moves only handles; fingers turn the camera) |
| G10 | The rest of the editors (Tiles, Characters, Document, Audio, Feel, Schematic, Writer) are buttons, fields and taps. A Pencil tap is a click there, which is right; no editor proves it. | by search: no drag surface in them | Task 1.5 (one pen-tap test per editor) |
| G11 | No Pencil double-tap or squeeze. Safari and WKWebView do not report them: they need `UIPencilInteraction` in Swift. | none | Tasks 1.6 (the command) and 11.3 (the native half) |
| G12 | A game being played treats a Pencil tap as a mouse: the on-screen controls hide after the person taps with a Pencil. Another file in the same package already counts a pen as touch. | `hosting-web.ts:179` against `input-method.svelte.ts:36` | Task 1.7 |
| G13 | Handwriting into fields (Scribble) has never been tried. The gesture kit sets `touch-action: none` only on drag surfaces, so fields should take it. | `attach-gestures.ts:52` | Task 7.5, device step |
| G14 | Pictures come in only through the file picker. On an iPad they come from Photos, Files or another app (a drawing app in Split View), and there is no drop target. | `AddTilesDialog.svelte:109` | Task 4.5 |
| G15 | Pressure and tilt are read and not used. | `attach-gestures.ts:61` | Not a gap: tiles and walls are whole cells, so there is nothing to draw with pressure. Spec 16 |

### The iPad itself

| # | Gap | Evidence | Closed by |
| --- | --- | --- | --- |
| G16 | The app's iPad window must allow Split View, Slide Over, Stage Manager and every orientation (`UIRequiresFullScreen` false). At a third of the screen the window is 320 to 507 pt wide and must take the compact layout. | v2 layouts: compact at 760 px or less | Task 4.5 |
| G17 | Web Audio follows the silent switch on an iPhone (and Silent Mode on an iPad), so Audio and a played game can be silent with no reason given. | none | Task 11.1 (the playback audio session) |
| G18 | An iPad has no vibration motor. "Real vibration" is an iPhone and Android feature, and on an iPad the Feel editor must say the device can't. | Apple's hardware | Task 11.2 |
| G19 | Games in iCloud Drive: iCloud downloads and evicts files on its own schedule, which breaks a git folder. | Apple's iCloud Drive behaviour | Spec 10.2: games live in Files under "On My iPad", GitHub is the copy kept elsewhere |

### Shipped online (step 6)

| # | Gap | Evidence | Closed by |
| --- | --- | --- | --- |
| G20 | Publish is not offered on a phone or tablet ("Publish your game from a computer."). This is the biggest gap. | spec 5 and 10.2 | Tasks 9.1 and 9.2 |
| G21 | The game's release workflow already builds and pushes to itch.io on a `v*` tag, so the iPad needs only to set the version, tag, push and follow the run. | `template-ci/release.yml` | Task 9.2 |
| G22 | The itch.io key: the workflow's words say to run `butler login` on a computer. itch.io's own site makes an API key, and the app can keep it as the repository's `BUTLER_API_KEY` secret (sealed with the repository's public key), which needs the Secrets permission. | `release.yml` comment; GitHub's secrets API | Task 9.2 (and the Secrets permission in 5.6) |
| G23 | Following the release run needs the Actions permission (read). | GitHub's Actions API | Task 5.6 |
| G24 | A zip to upload by hand: the player already compiles the game on the device, but a zip of it must also carry the runtime it plays on, and must play the same as the computer's build. | spec 7 | Tasks 9.1 and 3.5 (the same hashes as the Vite build) |
| G25 | Mac, Windows and Linux downloads can't be built on an iPad: iOS has no Rust and the game's workflow builds only the web and itch.io targets. | `release.yml` | Not in this spec (16). The computer app makes them (task 10.2) |

## What the iPad already does well

- The gesture kit: once a Pencil is used, fingers only move the view, a resting palm never paints, every coalesced
  sample of a stroke counts, and hover reaches the editor (`recognizer.ts`, `attach-gestures.ts`). Levels and Levels 3D
  use it, with a two-finger tap to undo and three to redo, a loupe under the Pencil and a nudge pad (`plan/loupe.ts`,
  `plan/NudgePad.svelte`).
- The testing kit sends pen pointers with tilt (`testing/kit/pointers.ts`), so DOM tests can prove Pencil behaviour.
- The in-page player (`kit/player`) compiles a game with no computer, and the app's store keeps every edit through a
  restart (tasks 3.3 and 4.1, half and whole).
- Sync, its merges and its status words are in the editor kit and shared with the web (tasks 5.3 and 5.4, half).
