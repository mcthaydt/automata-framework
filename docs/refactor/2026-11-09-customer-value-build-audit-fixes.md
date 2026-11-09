# Customer value build audit fixes

Stage 6 (fixes) of the customer value pipeline, 2026-11-09. It closes the findings of the build audit
([2026-11-09-customer-value-build-audit.md](2026-11-09-customer-value-build-audit.md)). Code is on this branch, stacked
on #550. The site parts are on #552, stacked on the site rewrite (#542).

## The answer

A person who asks an agent for a game now gets one that looks like a game, plays on a phone held sideways without
covering the level, and can be put on itch.io in plain words. From packed tools in an empty folder (outside any pnpm
workspace):

- `create-game` made a plain game. Its first look is a person on grass and platforms, not a green box (screen 1).
- A fresh Claude Code agent, with the plugin loaded from a stand-in, added coins and a score in 134 s (53 turns, $0.63)
  with its test first and `pnpm check` green. It drew the coin from the `coin` character, so the starter's turning coin
  shows (screen 3). Walking into one made the score read "Coins 1".
- The Levels editor shows the agent's three coins on the starter's tiles (screen 5). Speed changed in the Tuner saved
  to `content/tuning.toml`, and the Tuner still showed it after `automata editor` was stopped and started again.
- Publish "Make my zip", then "Put it on itch.io" with a stand-in butler: the first press says "Sign in to itch.io
  first", the Sign in button runs `butler login`, and the push then goes through with `--if-changed` and says the game is
  on itch.io and private until set to Public. The page address was written to `ship.config.ts`. The unzipped game played
  with the same coins and score.
- At 932 × 430 with touch, the four buttons sit in the left bar and the pause button in the right one; the level is
  clear (screen 2).

## Findings

| Finding | What changed |
| --- | --- |
| B2 (critical) | #539's agent prompt is in the site rewrite (#552), then reworded: "make a browser game" (the "2D" word is gone). |
| B3 (high) | The touch buttons move into the letterbox's side bars when a bar is wide enough, and stay at the foot otherwise. The renderer publishes `--af-bar-left` and `--af-bar-right`; `PlayScreen` chooses. Unit tests, and a real-browser test at the iPhone 14 and iPhone Pro Max landscape sizes (the 932 × 430 gate). |
| B4 (high) | "Sign in to itch.io" is the button and the words. The label lives in `publish-client.ts`, since the style check's platform-chrome rule bars that wording from component markup, and the editor is not a game. |
| B5 (high) | `butler login` times out after three minutes. If the browser did not open, or it timed out, the address butler printed shows with the failure. It cannot show while waiting: the request is one HTTP call. |
| B6 (medium) | The result says the page is private until set to Public. Verifying this on a real itch.io account is not done. |
| B7 (medium) | One place shows no chooser, and one green button. |
| B8 (medium) | The dialog fills the page address from `ship.config.ts` and writes it back after a push. |
| B10 (medium) | "Publish" is the word everywhere (top bar, menu, dialog title "Publish your game"). |
| B11, B12, B16 (low) | The guide's steps match the dialog; the `AGENTS.md` commit line is added; the editor-3d plan-comment debt is held by `check-style --ratchet 241`, so it cannot grow. |
| B13 (low), Task 15 | Home says "Finish the game your agent started." The "2D" launch words are gone from Home, Start, the docs, `llms.txt` and the command menu. Start's steps are the ones `create-game` prints (a test compares them). `site/tests/unit/home/launch-words.test.ts` pins this. |
| Task 16 | Starter art: a player (stand and blink), a turning coin, a slime and a ground tile set. `scripts/write-starter-art.ts` draws it from our own palette; a drift test regenerates it and compares. Plain 2D games only. |
| B1, B9, B14, B15 | Not this stage's: B1 is the Owner's `SKILLS_TOKEN` push; B9, B14 and B15 were handed off in the plan. |

## Gates

Run: `pnpm check` (lint, typecheck, boundaries, style, source-names, knip, every unit test, the site's too). It passes
except `check:changesets`, which fails on `.changeset/stage-characters-3d.md` ("@automata/3d is not a published
package"), a file from the 3D commit `9a7127af` lower in the stack. It is not part of this stage and is left for its
owner. `pnpm api-report` reports 106 undeclared breaks in `@automata/tools`; they come from the refactor's reshaping of
that package, none touches the touch controls, the letterbox or the places. `pnpm api-index` and `pnpm agent-skills`
pass. The game's own `pnpm check` and `pnpm test` pass.

Not run: WebKit and Firefox, a real iPad or phone, hosted CI, the GPU runner's landscape baselines, the 3D and story
games, a real itch.io push (needs the Owner's account), the site's e2e.

## Open for the Owner

- Starter art is drawn in our own colours, not DUEL: the licence is still open. Swapping the palette is one file
  (`scripts/starter-art/palette.ts`) and a regenerate.
- The story game keeps its old look; only the plain game has pictures.
- When the code and site stacks join, the two sides write three of the same lines (the `Next` line in `cli.ts`, its test in
  `bin.test.ts`, and the game README). Take #538's.

Screens: `/mnt/project-files/refactor/2026-11-09-customer-value-fixes-screens/`
(`pristine-desktop`, `phone-landscape`, `agent-play`, `walk1`, `levels`, `pub-2`, `itch-b`).
