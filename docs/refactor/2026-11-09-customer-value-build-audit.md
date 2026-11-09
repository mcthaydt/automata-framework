# Customer value build audit: the AI game maker fixes

Stage 5 (build audit) of the customer value pipeline, 2026-11-09. It audits the build on #538 (Tasks 1 to 14, 17 and 18)
and #539 (Task 7, the site) against the audit (#530), the spec and plan (#533) and the plan audit (#535). The question is
the Owner's: does a person making a game with an AI agent get the product we promise?

## The answer

Yes, once the skills mirror holds the plugin. From packed tools in an empty folder, a fresh Claude Code agent with the
Automata plugin loaded `automata`, `automata-content` and `automata-feature` and added coins and a score in 2.5 minutes,
with its test written first and `pnpm check` green. Its "Coin value" row appeared in the Tuner by itself. I placed two
coins in Levels, set Speed to 3 and Coin value to 13, and played: the square picked up both coins and the score read 26.
A reload and a restart of `automata editor` kept all of it. Publish made the zip, the zip played with the coins and the
score, and the itch.io step signed in and pushed with a stand-in butler.

Two things stop a real person today. The plugin every new game names cannot be installed, because the mirror holds only a
README (B1). And the site rewrite (#542) still carries the old agent prompt, so the fix in #539 can be lost when the site
stack merges (B2). On a phone held sideways, the touch buttons cover the middle of the level (B3).

## Journey

Run from the stack head `5377f355` with Node 22.23, pnpm 10 and Claude Code 2.1.319. The packs stood in for the registry,
in a folder outside any workspace (`tooling/consumer-smoke`'s helpers). Screens are in the shared folder,
`refactor/2026-11-09-customer-value-build-audit-screens/`.

| Step | Result |
|---|---|
| `pnpm build`, pack the 13 published packages, install the tools from the packs | Pass |
| `automata create-game my-game` | Pass. It printed "Created", "Started its git history" and "Next: cd my-game && pnpm install && pnpm editor". The game has `AGENTS.md`, `CLAUDE.md` (`@AGENTS.md`), `.claude/settings.json` and one commit |
| `pnpm install`, `pnpm check` | Pass, 0 findings |
| Add the plugin the way the game says (`claude plugin marketplace add mcthaydt/automata-skills`) | **Fail**: "Marketplace file not found … .claude-plugin/marketplace.json" (B1) |
| Add it from a stand-in (`agents/automata` on disk), install `automata@automata` | Pass |
| A fresh agent (scratch config, edits and `pnpm` only) gets the site's prompt with "add coins I can place in the level editor, and a score" | Pass. It loaded `automata:automata`, `automata:automata-content`, `automata:automata-feature` and Superpowers' TDD. It reported the skills honestly and did not claim to have installed the plugin. It wrote the test first, spawned coins from the level, listed them in `live`, made "Coin value" tunable, drew `Score N`, and emitted `coin.collected` for Feel and Audio. `pnpm check` was green. Time 152 s, cost $0.78 |
| Open the editors | Pass. Home lists every editor (screen 01). Levels opens on Collision with Solid chosen: the first brush paints ground (screen 02) |
| Place two coins in Levels, set Speed 2→3 and Coin value 10→13 in the Tuner | Pass. Both files were written (`start.af2d.json` and `start.toml`, `tuning.toml`) and the bar said "Saved in your game folder" (screens 03, 04) |
| Play | Pass. Both coins were picked up where the picture touches the square, and the score read 26 (screen 05) |
| Reload; stop `automata editor` with Ctrl+C and start it again | Pass. The coins and both numbers were still there (screen 06) |
| Publish: "Make my zip" | Pass. 4.8 s |
| "Put it on itch.io", not signed in, then "Connect to itch.io" (stand-in butler; no network) | Pass. Calls: `butler login`, then `butler push <zip> stand-in-maker/my-game:html5 --userversion 0.1.0 --if-changed`. It showed the link and "Copy link" (screens 07, 08). The page address was written to `ship.config.ts` |
| The same at phone size (390 × 844), from the Game menu | Pass (screen 09) |
| Unzip and play the zip | Pass, score 26 (screen 10). At 932 × 430 with touch, the buttons cover the field (screen 11, B3) |
| `pnpm check` after the editor's edits | Pass, 0 findings |

Not run: a real itch.io push (the Owner's account), WebKit, Firefox, a real iPad, hosted CI and the GPU runner. Also not
run: the site of #539 built or its e2e, and the story and 3D games (they need the beta packages, which are not published,
V15). I re-ran the unit tests of the places, the dialog, the publish client, the agent files and the player box: 90 in the
tools and the editor's Publish tests, all passing.

## Findings

### Critical

**B1. The plugin every new game names cannot be installed.** `.claude/settings.json`, `AGENTS.md`, the site prompt (#539)
and `llms.txt` all point at `mcthaydt/automata-skills`, which holds only a README. I checked it: Claude Code refuses the
marketplace. With the plugin, the agent did the job right first time; without it, the agent has only `AGENTS.md`. The fix
is the Owner's release with `SKILLS_TOKEN`; after it, run `claude plugin marketplace add mcthaydt/automata-skills` once.
Until then #539 must not deploy (plan audit A1 stands).

**B2. The site rewrite carries the old agent prompt.** #542 (the GTM rewrite, on #520) still has the prompt #539 replaces:
"Confirm Superpowers … Confirm the official PixiJS … If either collection is missing … stop", and it reads `README.md`, not
`AGENTS.md`. #539 is on #521, and #542 does not contain it. Whichever lands last wins, and if #542 lands last, V1 is back
on the site. Fix: bring #539 into #542's stack (or rebase #539 onto #542). The prompt test then holds the words.

### High

**B3. On a phone held sideways, the touch buttons cover the middle of the level.** Task 12 fits the level and leaves two
empty bars (84 px each at 932 × 430), but the four buttons stand in the middle of the field, over the floor and over a
coin (screen 11). The plan's gate is unmet, as the build said. A fix that keeps the TV text-scale contract: put the
buttons in the bars Task 12 already makes, when the bars are at least one 48 px button plus a gap wide. When they are not
(TV text scale, many buttons), keep today's row. No fixed bands are needed. The in-game text thread's HUD safe area reads
the same geometry, so tell it.

**B4. Say "Sign in to itch.io", not "Connect to itch.io".** I overturn this ruling. #544 says **Sign in with GitHub**.
The itch.io guide says "you are not signed in". And what happens is a sign-in: itch.io's own page opens and asks for the
password. A person who meets "Connect" here and "Sign in" there sees two different things. Use "Sign in to itch.io" on
the button, "Sign in to itch.io first, then press Put it on itch.io again." for the message, and "Finish signing in on
your computer, the one that runs the editor." for `--lan`.

**B5. Signing in can hang and hides the address.** `signIn()` runs `butler login` with no time limit and throws away what
it prints. If the browser does not open, or the person closes it, the button stays greyed out with no word. And the
sign-in address butler printed is never shown, though the code comment says it is kept. Fix: stop after three minutes
with "Signing in did not finish. Try again.", and show the address butler prints as a link.

### Medium

**B6. The first push goes to a page only its owner can see.** A new itch.io page starts as a draft (I believe this from
itch.io's page form; check it on the Owner's account). The dialog says "Your game is on itch.io." and offers "Copy link",
but a friend who opens the link sees nothing. Add: "Only you can see it until you set the page to Public on itch.io."

**B7. The one-place dialog is still a menu of one, with two green buttons.** I agree with the ruling, but the build did
not finish it. With one place the form opens, yet an "itch.io" button still stands above it, and it does not look pressed
(screen 07). After "Connect your itch.io account first", two green buttons show at once: "Put it on itch.io" and "Connect
to itch.io". The page address is asked for before the person is told to make the page; "Make a page on itch.io" shows only
after a failure. Fix: with one place, show no chooser; show one primary button at a time; put "No page yet? Make one on
itch.io" under the field.

**B8. The page address is not remembered.** The push writes it to `ship.config.ts`, but the next Publish asks again. Fill
the field from `ship.config.ts` unless it holds the placeholder `your-itch-user/…`.

**B9. A plain game offers things it never uses.** Levels lists Area, Checkpoint, Coin, Door, Moving platform and Slime; a
plain game acts on none of them until an agent writes the code. Home shows Writer, Sequence and Schematic with "Nothing
made yet. Open it to start.", and a plain game reads none of them (screen 01). A person places a slime or writes a line,
plays, and nothing happens. The Owner wants every editor shown, so the fix is words, not hiding: mark what the game does
not read yet ("Your game doesn't use this yet. Ask your agent to add it."). This is older than this build (V14's family),
so it goes to the every-editor and editors v2 threads.

**B10. One name for Publish.** The desktop button says "Publish". The phone's Game menu says "Make it ready to upload". The
dialog's title says "Make your game ready to upload", but the dialog now also puts the game online. Use "Publish" on both,
and "Publish your game" as the title.

### Low

**B11. The itch.io guide opens with programmer words.** "a game built for `itch` uses the web host adapter. ship packages
the build" sits above the person's four steps. I disagree with keeping it there: a sentence is still the first thing
read. Move it under "Pushing from your computer with a command".

**B12. The 241 plan comments in `packages/editor-3d/src`: agree to defer.** I counted 241 with the rule's own pattern. The
package is private and none of it reaches the API reference. Add a ratchet, though: a check that fails when the count
rises, so the debt cannot grow before the rewrite.

**B13. API pages stop at `## Beta:`: agree.** A beta package has no release, so a page for it would promise an install
that fails. One line is now wrong: `llms.txt` describes `/llms-api.txt` as "every export of the <version> packages", and
it also holds the beta ones. Say "and the beta packages a new game imports, marked beta".

**B14. Every new line of copy says `npx @automata/tools`.** On npm, `@automata` belongs to another account. The Owner chose
`@automataframework` on 2026-11-08, and the rename comes after the Plus port. This is not a bug in this build, but the site
and the guides cannot ship before the rename.

**B15. The Levels inspector wraps its `+` button under the number at 1280 × 800** (screen 03). Hand to editors v2 (V18).

**B16. Nothing asks for the work to be committed.** `create-game` starts the history, but the agent's coins and the
editor's saves stay uncommitted, and `AGENTS.md` does not say to commit. Add one line to `AGENTS.md`: "Commit when
`pnpm check` passes."

## The builder's rulings

| Ruling | Verdict |
|---|---|
| One place: the dialog chooses it | Right idea, not finished (B7) |
| `packages/editor-3d/src` left out of the plan-comment rule (241 comments) | Agree; add a ratchet (B12) |
| The site's API pages stop at `## Beta:` | Agree; fix one `llms.txt` line (B13) |
| "Connect" for itch.io | Overturned: "Sign in to itch.io", to match #544 and the guide (B4) |
| The guide's intro stays above the steps | Disagree (B11) |
| Pre-commit skipped with `LEFTHOOK=0`, suites run before each PR | Fine. The tests I re-ran pass |
| Task 14's dialog tests written beside the code, not watched failing | Accepted risk. The journey above passed through every branch but "butler missing", and the unit tests cover that one |

## Tasks 15 and 16

**Task 15 (what the site says) still blocks the launch copy.** The prompt says "I want to make a 2D browser game", the
page description says "Make 2D games for the web", `llms.txt` says "a deterministic 2D game framework", and the Editor page
says "Draw levels". This is true on #539 and on #542. Start's steps and `create-game`'s "Next:" line are still two sets:
Start says `pnpm dev`, then `pnpm exec automata editor` ("3. Draw its level"), then `pnpm build:web && pnpm prepare:web`
("4. Put it online"); `create-game` says `pnpm editor`, and the editor's Publish does the rest.
It no longer waits only on the free web editor work: #542 rewrote Home, so the task's step "write the copy on the
approved v2 layout" is out of date. Re-plan it onto #542's stack, together with B2.

**Task 16 (starter art) blocks the first impression, nothing else.** A new game is a green box, yellow dots and grey
bars (screen 05). Task 6's 16 × 24 player box is ready for a sheet. It waits on Arilyn's written permission for the DUEL
palette.

## Hand-offs

| To | What |
|---|---|
| The Owner | B1: the `SKILLS_TOKEN` release. B6: check the draft state on a real itch.io page. B14: the npm org |
| Site rewrite thread (#542) | B2 and Task 15 |
| In-game text thread | B3: the touch buttons move into the bars; the HUD safe area reads the same geometry |
| Every-editor and editors v2 threads | B9, B10, B15 |
| Stage 6 (fixes) | B3 to B8, B11 to B13, B16 |
