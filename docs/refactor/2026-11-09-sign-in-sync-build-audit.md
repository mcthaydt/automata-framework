# Saving and GitHub sync: build audit

Stage 5 (build audit) of the area the [audit](2026-11-08-sign-in-sync-audit.md) (#528) opened, checked against the
[spec](2026-11-08-sign-in-sync-spec.md), the [plan](2026-11-08-sign-in-sync-plan.md) (#536) and the
[plan audit](2026-11-08-sign-in-sync-plan-audit.md) (#537). The build is PR #544, audited at head `4c855dfa` (the saved
line's ellipsis fix on top of `da36bd01`). This area started from the Owner's "progress doesn't actually save", so the
question asked of every step is the Owner's: is what the person made still there, and does the page tell the truth?

## The answer

Mostly yes, and not yet. Typing in every kind of field and leaving the cursor where it is, then reloading, closing the
browser and opening it again: everything was there, in every editor, and the line said "Saving…" then "Saved on this
device" each time. That is the bug the Owner was angry about, and it is fixed for reloads and restarts.

Three things still lose or misplace work, and the build's own tests miss all three because they only ever type into the
first field and never type while a pull arrives:

1. **A tab closed mid-typing puts the words in the wrong field, or drops them** (B1).
2. **A pull that arrives while the person is typing silently writes over the other device's change, eats the next
   keys, and leaves the screen showing words that are not in the file** (B2).
3. **The line says "Saved on this device and on GitHub" for ten seconds or more before GitHub has the change** (B3).

The fixes stage should take B1 to B3 before #544 merges. Nothing here needs the Owner's decision.

## How it was checked

All in Chromium in this cloud session, on the built page (`vite build` in `extensions/editors` first), with no editor
server behind it (the web) and, for the played half, under `automata editor`. GitHub was the build's fake
(`kit/testing/github`), never a real account. WebKit, Firefox and a real iPhone were not run: they are not installed here.
The scratch journeys that found each finding, their logs, the zipped files and the screenshots are in the project's files
under `refactor/2026-11-09-sign-in-sync-build-audit/` (the journeys are in `journeys/`, ready for the fixes stage to turn
into real tests).

| Check | Result |
| --- | --- |
| The builder's journeys `typed-words-kept`, `web-game-kept`, `web-sync-two-devices`, phone and iPad projects | 14 of 14 pass |
| A new web game, "Grandma's Game", typed and never left in Writer (text), Feel (number, text), Audio (text, number), Sequence (number), Schematic (number) | Each read "Saving…" then "Saved on this device" with the cursor still in the field |
| Reload, then close the browser and open it again on the same profile | All ten values back both times; the page opened on the editor left open (Schematic) |
| A tab closed within 100 ms of the last key: Writer's third line, Schematic's third "Waits", Schematic's name, Feel's limits page | Lost, wrong field, kept, not put back (B1, B4) |
| Two devices on the fake GitHub: keep, get, edit, offline, back, a clash while typing | B2, B3, B6, B7 |
| The saved line at 360×740, 390×844, 844×390, 820×1180 and 1280×800, synced and offline, in Writer and Levels 3D, at `4c855dfa` | The Dock toggle and Play stay on screen; the line itself is cut on phones (B5) |
| Played half: `writer-words-show-in-game` and `feel-shows-in-game` under `automata editor` | Writer's words and the cutscene flash show in play; the Feel shake test fails, as it does on the #532 base (the build's own note) |
| Unit suites of `packages/editor`, `extensions/editors` and the site's sign-in, headers and site-check tests | 3477, 673 and 108 pass; none of them catches B1 to B3 |

## Findings

### High

**B1. A draft is keyed by the field's label, so a tab closed mid-typing restores into the wrong field, or loses it.**
`typedSave` names a draft by `draftKey`, and every caller passes the label (`WordsField`, `FieldRow`): Writer's six lines
are all "What it says", Schematic's three stops each have "Waits". On the next open every field with that label reads the
same draft; the first whose current text equals the draft's `base` commits it, and a field whose text differs *removes*
it (`typing-drafts.ts`, `field()`).

- Writer: typed "Closed mid typing." into the third line and closed the tab at once. Next open: the third line still read
  "Grandma typed this.", and `content/lines/shop.toml` never got the words. The first line ("Welcome in…") read the
  draft first, saw a different base, and deleted it.
- Schematic: the door and the window both wait 2 s. Typed 7 into the **window's** Waits and closed the tab. Next open:
  the **door** read 7 and the window 2, and the saved `content/systems/hall.toml` has `node = "door"` `dwell = 7`,
  `node = "window"` `dwell = 2`. The person's edit landed on another stop, in the file.

This is the iPhone and iPad path: Safari there never asks "Leave site?", so the draft is the only thing that saves a tab
closed inside the half second (spec 4.1, plan audit A4). The journey `typed-words-kept` passed because it types into the
first field. Fix: key each draft by what the field edits (the file and the value's place in it: a row id or key path),
never by its label; a field removes only its own draft; journeys for a non-first field and for two fields holding the
same value.

**B2. A pull while the person is typing writes over the other device's change, drops the next keys, and shows words the
file does not have, under "Saved on this device and on GitHub".**
Device A changed Writer's first line to "Offline words." and pushed it. Device B, which had not pulled it, was typing
"Bob is typing here" into the same line when its pull arrived (the tab came to the front), and kept typing " and more".

- B's field was blurred by the pull and the editor opened again on "Offline words."; the focus went to the page, so
  " and more" went nowhere.
- Blurring committed "Bob is typing here" over the pulled file (`showPulled` blurs, `writePath.forget` lets the write
  through), and the next push sent it: GitHub's line became "Bob is typing here". A's "Offline words." was gone with no
  question asked, and A's page took B's words on its next pull.
- For the rest of that visit B's screen showed "Offline words." while its file and GitHub held "Bob is typing here", and
  the line said "Saved on this device and on GitHub". Only a reload showed the truth.

Plan task 5.3 asked for "opens the conflict dialog when a field is waiting"; no test types during a pull. Fix: a pull
must not write a file that has a waiting field or an open visit; either it waits until the visit closes and the field's
text is committed (then merges it like any change here, which asks when both sides changed the same line), or it treats
the file as a clash. Never blur the person's field to make room for a pull. Test: the scenario above, ending with the
dialog, and A's and B's words both kept or chosen.

**B3. "Saved on this device and on GitHub" is said before GitHub has the change.**
The loop commits ten seconds after the last edit (`SAVE_AFTER_MS`) and its status stays `saved` meanwhile, so the line
claims GitHub straight after the local write. Measured: right after the local save and again 4 s later the line read
"Saved on this device and on GitHub" and the fake had nothing. A tab closed inside that window goes up only on the next
open (checked: it does), so the line was wrong for as long as the tab was closed. Fix: `edited()` moves the status to a
waiting state ("Saved on this device. Sending to GitHub…") until the push lands; `saveLine` tests for it.

### Medium

**B4. A draft is only put back when that same field is on screen again.** Typed 33 into Feel's "Most shake" (the limits
page) and closed the tab. The next open showed Feel on its first page and `content/feel/feel.toml` had no shake limit,
under "Saved on this device". The words wait in `localStorage` until the person happens to open that page again, then land
as a fresh edit. The spec says "On open, a draft newer than its file is committed as the person's edit" (4.1). Fix: with
B1's keys, commit pending drafts when the game opens, not when a field mounts.

**B5. On a phone the saved line is cut to "Saved on this de…", so the part that matters is never seen.** At `4c855dfa`
the line gives way with an ellipsis (the coordinator's fix for the Levels 3D Dock toggle, which now stays on screen at
390 px). At 390×844 the synced line shows 108 of its 210 px and the offline line 129 of 308 px; at 360×740, 92 and 110 px.
"Not on GitHub yet: no internet", "sign in to GitHub" and the stopped reasons are cut off, and the full words are only in
`title`, which a phone cannot hover. The title "Lantern Run" shows as "Lant". At 360×740 with the offline line in Writer,
Redo is pushed off the right edge. Landscape, iPad and desktop show the whole line in Writer; in Levels 3D on an iPad the
offline line is cut too. No layout test covers the line on a phone (plan 1.3 asked for one at 390×844). Fix: short phone
words that keep the state ("On this device · not on GitHub yet"), or the icon plus a tap that shows the whole line; a
layout test at 360 and 390 for every `STATUS_LINES` row with the title and Undo/Redo on screen. Screens:
`s-offline-writer-phone.png`, `s-offline-writer-small-phone.png`.

**B6. "Get it" with GitHub out of reach says "Failed to fetch".** The browser's own words, under the game. Fix: "Can't
reach GitHub. Check your internet and press Get it again."

**B7. Signed in, Your games still says "Saved in this browser only. Save a copy, or sign in with GitHub, to keep it
safe."** It is said under "Signed in as alice." (`s-games-signed-in.png`). Signed in, say which games are on GitHub and
which are only here.

**B8. The note about generated files names Claude and says something untrue.** `generatedNote` (copied from the apps):
"Claude edited content/world.toml, but the app rebuilds that file from your level. Claude's edit is kept on GitHub, not
in the game." On the web the other writer is usually the person's other device. And the edit is not kept: `mergeMain`
skips a generated path but records GitHub's id for it, so the file here counts as changed and the next push sends this
device's copy over GitHub's. With two devices editing levels, the one that did not regenerate pushes stale TOML. Read from
the code, not run (it needs Levels 2D on two devices). Fix: web words without "Claude"; regenerate from the merged level
before pushing, or leave GitHub's generated files alone until a level edit here rewrites them; a test with the fake.

**B9. A game made on the web cannot be played anywhere yet.** New game copies the content sample (the 3D hall, Wick, the
shop's lines), not a starter: there is no Play on the web (spec 5) and the copy has no `package.json` or `src/`, so
`automata editor` cannot run it either. Known (task 3.1 waits for `templateFiles` and the site stack), but it means the
"make a small game and play it" check could only be done on the 2D story under `automata editor`, where Writer's words
showed in play.

**B10. "Make an empty place for your game on GitHub" does not tell the person what to do on GitHub.** A drunk grandma does
not know a repository is "a place", and nothing says to leave "Add a README" unticked. A repository with a README is not
empty, so the first push is refused and goes through the pull-then-push path, which no test covers. Fix: "On GitHub, press
**Create repository** and change nothing else. Then come back here."; a test with a README already there.

### Low

**B11.** A game fetched with Get it is named by the repository's id ("lantern-run"), not its title ("Lantern Run"), in the
list and the top bar. Read the title from the game's files or keep it in `games.json` on GitHub.

**B12.** The first push and a push made on reopening carry "Edited in Automata" with no editor named (fake's commit log:
three of five), not "Edited in Automata: Feel" as plan 5.3 says.

**B13.** The clash dialog names a file, not a thing ("Shop changed here and on GitHub", "You and GitHub both changed
Shop"); GitHub changed nothing, the person's other device did. Keep both adds a second Feel file (`feel-github.toml`) that
the game then holds. Words: "Your other device changed the shopkeeper's lines too."

**B14.** The builder's known gaps were seen as described: a pull reopens the open editor on its start; `/try` and Play wait
for #531 and the site stack; Privacy and Terms wait for the Owner. The phone top bar's truncation is B5.

### What holds

- Typed words with the cursor left in the field: kept through a reload and a browser restart in every content editor on
  the web, and on disk under `automata editor` (the build's journeys).
- The id field (`commit="leave"`, Schematic's Name) waited while typed and was flushed when the tab closed: "keeper" was
  there on the next open, as spec 4.1 says.
- A tab closed inside the ten seconds before a commit: the change went to GitHub on the next open.
- Offline: "Saved on this device. Not on GitHub yet: no internet." at landscape, iPad and desktop sizes, and one commit
  once back.
- The clash dialog when nobody is typing (the build's journey): Not now, the top bar's button, a reload, Keep both.
- `4c855dfa`: Play, Publish and the Levels 3D Dock toggle stay on screen at 390 px.

## Not run

WebKit, Firefox and a real iPhone or iPad (not in cloud sessions); the real GitHub and Cloudflare (need the Owner's steps
in spec 12); the full `pnpm check` (the editor and editors unit suites, and the site's sign-in tests, were run); the 17
layout tests the builder reported as failing on the base were not re-run.
