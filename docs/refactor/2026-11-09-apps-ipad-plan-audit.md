# The iPad update to the apps plan: plan audit

Stage 3 again for the apps area, on the 2026-11-09 update (PR #557, `bd77d5f1`): the [spec](2026-11-08-apps-spec.md),
the [plan](2026-11-08-apps-plan.md) (30 tasks to 50) and the [iPad gap list](2026-11-09-ipad-end-to-end-gaps.md). It is
measured against the Owner's words of 2026-11-09:

- 01:50 "No, desktop and mobile are separate"; 01:52 "Let's add all of them" (the seven paid features);
- 01:53 "I'd like apple pencil to be first class supported, iPad is our actual primary device for creation, between
  Claude code and automata framework suite app; games should be able to be completed end to end";
- 01:58 "with Claude code app and our app - we can take a game from idea to shipped online on our iPad; end to end. Our
  primary surface is Claude code, the editors are just so we can modify things by hand if we need to".

The code was read at `4c855dfa` (the tip of #544, every editor), as the gap list was. Every finding names a file and line
there, or the plan's own text.

## The answer first

The update is the right shape: the five-step iPad loop is the measure, every gap names its task, the two separate
purchases and all seven extras are in, and the "never sell a web limit" rule is written into the constraints. **The two
Pencil and palm bugs it found are real and are in the tasks**: the timelines' raw pointer drags (G8, task 1.5) and a
Pencil counted as a mouse in a played game (G12, task 1.7). Five things would still stop a game going from idea to
itch.io on an iPad, or leave a promise with no task (H1 to H5 below). Fix them in the spec and plan before task 1.5.

**The Owner's three calls.** I recommend keeping all three:
- **Review free on the web:** keep. It follows the 01:46 rule. But no task builds it yet (H1).
- **Games "On My iPad", not iCloud Drive:** keep. iCloud evicts files on its own schedule, which breaks a `.git` folder,
  and GitHub is already the copy kept elsewhere.
- **The Pencil code open source (MIT, in this repository):** keep. It matches "everything open source except deployment"
  (2026-11-08 14:53); a fork still can't ship as "Automata" (`TRADEMARK.md`).

## The real thing: a small game made with a Pencil, reloaded, reopened and played

A journey (scratch, not committed; copied to the project files with its screens,
`refactor/2026-11-09-apps-ipad-plan-audit/`) ran the built `automata editor` on a new game, in Chromium at the iPad size
and the phone size. Both passed (38 s):

1. **Levels, with a Pencil and a resting palm:** a touch pointer landed on column 12 and moved a little, then a pen tapped
   column 5, then the touch lifted. The level file's collision row 2 became `".*5 1 .*10 1 .*15"`: the Pencil's wall, the
   starter's own wall at column 16, and nothing where the palm was.
2. **Tuner:** J added to "left". **Feel:** a 30-frame flash on "square bumped".
3. **Reload:** all three were still in the editors.
4. **Close and reopen:** the command was stopped and the tab closed, then both started again. The wall, the key and the
   flash were all there.
5. **Play:** the wall was drawn where the Pencil put it and the palm's cell was still the empty background; J moved the
   square; bumping a wall flashed.

WebKit is not installed in cloud sessions, so the WebKit run at iPad size is the Owner's Mac's. The app itself does not
exist yet, so this proves the editors the app will carry, not the app.

## High: would stop the iPad loop, or a promise has no task

**H1. "Review is free on the web" has no task, and neither does Play on the web, which it needs.** Spec section 3 says
the web keeps "the in-page player, and the Review page", and the plan's constraints say "sync, Review and the in-page
player stay on the web". But every Review task builds an app-only port (`apps/editor/src/features/review/review-port.ts`,
tasks 6.1 to 6.5), "Play it" on a phone plays through the app's play scheme (task 3.4), and the merge fallback uses the
app's isomorphic-git engine. The sign-in and saving spec, built in #544, says the opposite of the apps spec: "Play on the
web is not in this spec … Play says 'Play isn't on the web yet.'" and "Not in this spec: … Review on the web (needs
Play)" (`2026-11-08-sign-in-sync-spec.md` sections 6 and 13). So today nobody builds either.
**Fix:** add task 6.6, "Review on the web": a `ReviewPort` over the REST engine (`kit/sync/rest-engine.ts`): list, merge
(`PUT …/merge`) and close through REST; export a branch from its tree into the web store's `.automata/review/<branch>/`;
the 405 fallback through the REST engine's `mergeMain`; the same `ReviewPage`. Add the task (or name the area) that
serves the runtime bundles at the manifest's URLs on the site, so `kit/player` plays on the web; until then web Review
shows "Play it" off with words, never a blank. If the Owner reverses the call, delete the sentences instead.

**H2. A game made on the iPad can't pass its own check or publish: it has no lockfile.** `release.yml` runs
`pnpm install --frozen-lockfile` (lines 35 and 79) after `actions/setup-node` with `cache: pnpm`; the planned
`check.yml` copies it ("pinned actions as `release.yml`"). A game made in the phone app comes from `templateFiles`
(task 4.2) with no Node, and `create-game` writes no `pnpm-lock.yaml` (nothing under `create-game/` mentions one). pnpm
refuses `--frozen-lockfile` with no lockfile, and setup-node's pnpm cache fails without one. So step 3 (the check on
Claude's change) and step 6 (Publish) both fail for the iPad's own games. Claude Code may commit a lockfile, but nothing
makes it.
**Fix:** in task 5.6, both workflows install with `--frozen-lockfile` only when `pnpm-lock.yaml` exists (plain
`pnpm install` otherwise) and use setup-node's cache only then; the game's `AGENTS.md` asks Claude to commit the
lockfile. Test on `templateFiles`' own output (no lockfile), not on a desktop-made game.

**H3. Tasks 1.1 and 3.4 still build "Publish your game from a computer."** G20 ("the biggest gap") is closed in spec
10.5 and phase 9, but spec section 6 still reads `readonly publishes: boolean // false on a phone`, task 1.1's first test
asserts the phone notice, and task 3.4's `playerHost` is `publishes: false`. Phase 9 never turns it on, and `SuiteHost`'s
`publishes` and `showPublished` now duplicate the new `PublishPort`.
**Fix:** drop `publishes` and `showPublished` from `SuiteHost`; the Publish dialog reads only `PublishPort` (no port:
today's download). Task 1.1's test becomes "no port, today's download"; task 3.4 leaves Publish to task 9.1, which fills
the phone's port. Delete the sentence from the copy list.

**H4. A played game can't reach the haptics it is promised.** Spec 7, point 5, gives the game its own origin "with no
Tauri capability, so the game cannot reach the app's native bridge" (Apple 4.7.2). Task 11.2 then "fills the game's
haptics port through `Hosting` in the player" with the plugin's `impact`. Inside the game's origin there is no plugin to
call. Feel's "This iPad can't vibrate" also needs a fact from the host that no port carries.
**Fix:** task 11.2 adds a narrow message channel: the game posts `{ kind: 'haptic', strength }` to the app page, the
page's handler checks the source and the game origin from `app-origins.ts` (AGENTS.md), and calls the plugin. Add
`vibrates: boolean` to what the host tells the page, and test the refusal of any other origin.

**H5. The iPad loop needs two things outside the app that no step names.** First, Claude Code in the cloud pushes to a
repository only where the Claude GitHub App is installed, which is separate from the "Automata" GitHub App of section 8.
Second, a game asks for `@automata/*` at `^<version>` from the public registry (`template-file.ts:31-32`), so Claude
Code's `pnpm install`, `check.yml` and `release.yml` all fail until the first npm release and rename (audit A5). Spec 14
waits on A5 only for "the desktop's first install".
**Fix:** spec 1 and 14 say the iPad loop also waits on A5; task 5.7's "Work on this with Claude" adds one line, "First
time? Let Claude see this game on GitHub too." with the link to install Claude's own GitHub App; task 7.5's device step
lists both.

## Medium

**M1. The drag-surface test would fail on the wrong files and miss the right one.** Task 1.5 says that today it "names
the two timelines". It would also name `WalkHud.svelte:39` and `WalkSticks.svelte:53` (native `pointerdown`, not kit
widgets, not `attachGestures` users). And it exempts any file that uses `attachGestures`, which hides `StudioCanvas`'s
own handle listeners (`StudioCanvas.svelte:211-245`). Those take any pointer kind, keep one `dragging` slot and never
check `pointerId`, so a finger or a resting palm on a handle drags it, and a palm and the Pencil fight over it. That is
G9's bug as well as the empty-stage one.
**Fix:** the test checks each listener, not each file; the sticks and lift buttons are allowed by name (they are on-screen
controls, and the sticks already track `pointerId`); Studio's handles move to the kit or filter by kind and id, with
the palm-on-handle case in `studio-pencil.test.ts`.

**M2. The Sequence ruler takes a palm too, and nothing ends a cancelled drag.** The playhead ruler seeks on any
`pointerdown` (`SequenceTimeline.svelte:91-99`), so a palm moves the playhead. The keys have no `pointercancel`, so a
drag the system takes away stays half done. Add both to task 1.5's tests.

**M3. "Put it on GitHub" from the iPad needs a second trip that the plan leaves out.** A GitHub App reaches only the
repositories it is installed on. A repository made at `github.com/new` after the install is outside it unless the
person chose "All repositories", so the first push is refused. Task 5.5 has both screens but never chains them. **Fix:**
after "come back", if the app can't see the new repository it goes straight to "Let Automata see this game" on the same
sheet, and the test covers a selected-repositories install.

**M4. The widget can sign the person out.** GitHub App user tokens last 8 hours and their refresh tokens rotate (the
sign-in spec's own risk for two tabs). A widget that refreshes from the shared keychain spends the refresh token the app
holds, or races it. **Fix:** task 11.4's widget never refreshes. It asks GitHub only with a token that is still valid, and
otherwise shows the last count with its time ("2 waiting, 3 h ago").

**M5. A green release run doesn't mean the game is on itch.io.** The itch job's first step passes when
`BUTLER_API_KEY` is missing and publishes nothing (`release.yml`, "Is BUTLER_API_KEY set?"), so the run ends green.
**Fix:** task 9.2 reads the "Publish to itch.io" step's own result. If that step was skipped, the app says "itch.io
didn't get your key. Paste it again".

**M6. On a real iPad, G12 may be a flicker, not hidden controls.** A Pencil also sends `touchstart` (touch type
`stylus`) after its `pointerdown`, and `hosting-web.ts:181` turns `touchstart` into `touch`. So the mode likely goes to
keyboard-and-mouse and straight back. The fix in task 1.7 is still right. Its test should send the pen's `pointerdown`
then `touchstart` and expect one change to `touch` and none away from it. The device step confirms what a person saw.

**M7. Five tasks name files that moved.** The execution log moved the sync code to `packages/editor/src/shared/kit/sync/`
and the player to `.../kit/player/`, but tasks 3.3, 5.1, 5.3 and 5.4 still list `apps/editor/src/features/player/` and
`.../sync/`, and the Tech stack line still says the editors gain "two app-only" ports, though sync is on the web. Correct
the file lists so the builder doesn't make second copies.

## Low

- **L1.** Spec 10.2 gives a third of the screen as 320 to 507 pt, and Slide Over is 320 pt, but every layout test uses
  375 × 820. Add 320 × 820.
- **L2.** Task 1.5's Pencil-tap list leaves out the Tuner, which is an editor (`tuner-suite-editor.ts`). It also names
  no control for Document.
- **L3.** "Work on this with Claude" opens "the Claude app's URL" but never names one. Use `https://claude.ai/code`,
  which opens the Claude app where it is installed, and keep the copied name as the step that always works.
- **L4.** `automata check-player` checks against the runtime of the `-tools` version the game pins, not the app the
  person has. The Review card (task 6.5) is the check against the app on the device. Say so in the game's `AGENTS.md`.

## Checked and true

G2 (`release.yml` runs only on `v*` tags); G8 (`SequenceTimeline.svelte:91,136`, `StudioTimeline.svelte:99`, no
pointer-kind check); G9 (`StudioCanvas.svelte:157`, the stage's drag turns the camera for every kind); G10 (no drag
surface in Tiles, Characters, Document, Audio, Feel, Schematic or Writer); G12 (`hosting-web.ts:179` against
`input-method.svelte.ts:36`); G13 (`attach-gestures.ts:49`, `touch-action: none` only on the surface); G14
(`AddTilesDialog.svelte:109`, a file input only); G15 (pressure and tilt sampled, `attach-gestures.ts:61-63`); G16
(`shell-mode.ts:20`, compact at 760 px); G21 and G22 (`release.yml` builds, pushes with butler and tells the person to
run `butler login`); the haptics port (`game-definition.ts:55`). The kit's palm rule held in the journey above.

## Not run

`pnpm check` (this change is documents only). WebKit and Firefox (not installed here). No device or Owner's Mac step.
