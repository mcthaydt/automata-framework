# Saving on the device, the try-it apart, and sign in with GitHub: plan audit

Stage 3 (plan audit) of the area. It reads the [spec](2026-11-08-sign-in-sync-spec.md) and
[plan](2026-11-08-sign-in-sync-plan.md) on #536 (head `ad01b943`, on the [audit](2026-11-08-sign-in-sync-audit.md),
#528) for completeness, consistency and cohesion, checks their claims against the code they build on, and runs the real
thing: type into Writer, Feel and the Tuner, close the tab before leaving the field, reload, close and reopen the browser,
and play. The spec and plan are fixed in the same pull request; this file says what changed and why.

- **Code read:** #531 (`claude/project-thread-hvpv4a`, `1b28d4d6` and `e66059ce`), #532
  (`claude/project-thread-szjdbh`, `829039d5`), the site stack's top #521 (`claude/project-thread-k1ftgu`, `5fd3933c`),
  editors v2 (`claude/project-thread-q3zxgn`).
- **Docs read:** GitHub's "Generating a user access token for a GitHub App" and "Refreshing user access tokens"
  (docs.github.com, 2026-11-08): PKCE with `S256` is supported, `client_secret` is required for the code exchange and
  for a refresh of a web-flow token, access tokens last 8 hours, refresh tokens 6 months and rotate.
- **Ran:** #532's built every-editor page (`extensions/editors/dist/suite`) served statically with `/api/` answering
  404 (what `/editor/app/` is today), and the real `automata editor` (built `@automata/tools`) on a fresh copy of the 2D
  story, both in Chromium with a persistent profile. Screens in
  `/mnt/project-files/refactor/2026-11-08-sign-in-sync-plan-audit-screens/`.
- **Not run:** WebKit and Firefox (not runnable in this session), `api.github.com` (blocked by the container's proxy),
  Cloudflare Pages Functions, `pnpm check` (docs only).

## 1. The real thing, before the build

Each row: the field was filled with new words by typing, the page waited 1.5 s with the focus still in the field, then
the tab was closed (or reloaded); a new tab opened the same editor; then the whole browser was closed and opened again.

| Where | Field | How it ended | After the new tab | After the browser restart | On disk / in play |
| --- | --- | --- | --- | --- | --- |
| Web page (no server) | Writer, a line | tab closed in the field | **lost** | lost | n/a |
| Web page | Writer, a line | reloaded in the field | **lost** | lost | n/a |
| Web page | Writer, another line | Tab pressed, then closed | kept | kept | n/a (Play is not on the web) |
| Web page | Feel, flash colour (text) | tab closed in the field | **lost** | lost | n/a |
| Web page | Feel, shake "How hard" (number) | tab closed in the field | **lost** | lost | n/a |
| Web page | Tuner | nothing to type into: "player: A table or a list: change it in the file", "This game's controls are in its code" | | | |
| `automata editor` | Writer, keeper's first line | tab closed in the field | **lost** | lost | file unchanged |
| `automata editor` | Writer, keeper's line 1 | reloaded in the field | **lost** | lost | file unchanged |
| `automata editor` | Writer, the player's answer | Tab pressed, then closed | kept | kept | in `keeper.toml` and the compiled content; **the played game shows it** as answer 1 (`served-play.png`) |
| `automata editor` | Feel, shake "How hard" | tab closed in the field | **lost** | lost | file unchanged |
| `automata editor` | Tuner, a control's name | tab closed in the field | **lost** | lost | file unchanged |

All through, the served header read "Saved in your game folder" while the typed words were not saved; the web page's
header says nothing about saving at all ("Sample game"). This is P14 exactly as the audit found it, and it is what the
plan's phase 1 must turn green. Words that were left (blur) are kept through a reload and a browser restart on both, and
reach play on the served game.

## 2. Findings

| # | Severity | Finding | Fixed in |
| --- | --- | --- | --- |
| A1 | High | The plan's base misses the site stack | spec 3, plan "Where it starts", task 0.1 |
| A2 | High | One Undo step per visit is built on the wrong history for the editors it fixes | spec 4.1, task 1.2 |
| A3 | High | Committing every 500 ms breaks FieldRow's refusals and renames ids mid-word | spec 4.1, task 1.1 |
| A4 | High | A flush on `pagehide` cannot finish an async write, and iOS has no leave question | spec 4.1, 14, Review Focus 1, task 1.1 |
| A5 | Medium | Typed save leaves out the 2D and 3D editors' text fields | spec 4.1, task 1.1 |
| A6 | Medium | The Tuner has nothing to type into on the web | spec 5, task 1.4 |
| A7 | Medium | `startSync` turns every error into "no internet", so the REST engine's words never show | spec 8.1, tasks 5.1, 5.3 |
| A8 | Medium | A ref read on an empty repository is a 409, which the loop calls "no internet" | spec 8.1, task 5.1 |
| A9 | Medium | Sign-out has no access token to revoke | spec 7.1, task 4.1 |
| A10 | Medium | After GitHub's install page the person is left on GitHub | spec 7.3, 12, task 5.2 |
| A11 | Medium | Cloudflare's `_headers` do not reach a Function's responses | spec 7.1, task 4.1 |
| A12 | Low | Review Focus names tasks that do not exist | plan Review Focus |
| A13 | Low | `saveLine` has no row for "Checking GitHub…" or for a pull's notes | spec 4.2, task 1.3 |
| A14 | Low | Editors v2's `SaveState` shows fixed words | task 1.3 |
| A15 | Low | The old `sample-game/` adoption protects visitors who do not exist | spec 6.4, Review Focus 5, task 2.2 |
| A16 | Low | Words a drunk grandma stumbles on | spec 6.3, 7.3, tasks 2.3, 5.2 |
| A17 | Low | A test path that does not exist, and #532 already passes `kept` | tasks 1.3, 4.3 |

### A1 (High): the base misses the site stack

Task 0.1 starts from #532 + #531. Phase 3 and 4 edit `site/scripts/write-headers.ts` and
`site/src/features/app/app-offer.ts`, which exist only on the site stack (#517 to #521; checked with `git cat-file` on
each head), and the site words P3 asks to change (EditorPage, Privacy) are #521's. The site stack shares its base with
#532 (`379eb744`) but neither contains the other; #531 is on `main` at #474 and contains neither. **Fix:** the base is
the merge of #532, #531 and #521 (or `main` once they are in), and task 0.1 records all three heads.

### A2 (High): Undo is the editor's own history, not the write path

Writer, Feel, Audio, Sequence and Schematic each give the suite an `undo` hook (`*-suite-editor.ts`), and `Suite.svelte`
uses the hook when there is one (`undoHook`, "the open editor's own history"). Their steps are the kit `History` in
`toml-session.ts`, which already joins applies that share a `coalesce` key within 600 ms (`kit/history/history.ts`);
Feel already passes its field's key. The plan's task 1.2 adds `join` to `write-path.ts` and `write-history.ts` only, so
the editors P14 is about would still get one Undo step per half-second pause (a pause of 500 ms plus typing is past the
600 ms window). **Fix:** the visit key goes to both: `History.apply`'s `coalesce` gains `join` (same key, no time window,
while it is the top step), passed through `TomlSession.edit` and the content sessions' `change`; the write path's `join`
stays for editors without a hook (the Tuner, the 2D editors).

### A3 (High): a draft commit is not a leave commit

`FieldRow.svelte`'s commit is written for a field that is being left: on a refusal it puts the old value back into the
input (`event.currentTarget.value = String(value)`) and shows "This cannot be empty.", "Type a number." or "The least is
0.1.". Called 500 ms into typing, it wipes "0." on its way to "0.5" and a name the person cleared to retype. Several
`FieldRow`s rename an id (`renameCharacter`, `renamePlace`, `renameMode`), and the Tuner's control name calls `rename`:
committing them at every pause renames "Guard" to "G", then "Gu"… each a key change, and any can collide. **Fix:** the
action commits a draft only when the value is valid, never resets the input or shows a refusal while the field has the
focus (the refusal shows on leave, as now), and a field that names something (`commit="leave"`) keeps its leave commit;
its waiting text is still flushed on hide (A4).

### A4 (High): the reload inside half a second is not safe on the devices that matter

The plan flushes on `pagehide` and hidden, and relies on `beforeunload`'s leave question for a reload in the first half
second (Review Focus 1). Two gaps: a flush starts an asynchronous OPFS write (or an HTTP PUT when served), which the
browser does not wait for while the page goes away; and Safari on iPhone and iPad shows no `beforeunload` question at
all, so on the phone and tablet the rules design for, words typed just before a reload go in silence. **Fix:** the typing
registry also keeps each waiting field's text in `localStorage` synchronously on every input (not `sessionStorage`, which a closed tab takes with it) (a draft per game, file and
field, cleared once its commit has landed). On open, a draft newer than the file's text is committed as the person's
edit, so nothing typed is lost to a reload. Served writes made while hiding use `fetch(…, { keepalive: true })`. The leave
question stays for desktop browsers that have it. Drafts are the person's own words, not a token, so the token rule is
untouched.

### A5 (Medium): the 2D and 3D editors' text fields

The spec says "text and number fields write a moment after typing stops", but task 1.1 changes four files. The kit's
`FieldEditor.svelte` (the Levels inspectors), `Stepper.svelte`, `ColorField.svelte`, and the Characters editor's
`EntityInspector.svelte`, `FieldDefEditor.svelte`, `AnimationSection.svelte` and Tiles' `RuleInspector.svelte` also write
only on `change`, so a reload in them loses words the same way. **Fix:** task 1.1 puts the action in the kit's
`FieldEditor`, `Stepper` and `ColorField`, and lists the Characters and Tiles fields; the journey adds one 2D field.

### A6 (Medium): the Tuner on the web

On the page with no server the Tuner shows "Your game shows here when you open the editors in your game's folder", the
sample's tuning as "A table or a list: change it in the file", and "This game's controls are in its code"
(`peek-Tuner.png`): there is no field to type into. Its rows come from the compiler's `tuning-meta.json`, which the web
does not make. Task 1.4's web leg ("the Tuner (a control's name)") cannot run. **Fix:** the web journey types in Writer,
Feel and one 2D field; the Tuner leg runs served. The spec says the Tuner on the web waits for the same compile step as
Play (`kit/player`'s `compileGame`), in the next area.

### A7 (Medium): the loop's error words

`startSync`'s `queue` catches every error that is not an `OfflineError`, passes it to `onError` and sets
`statusOf('offline')`: "Saved on this device. Not on GitHub yet: no internet." So "This game is too big to sync on the web",
"GitHub asked us to wait" and "Automata can't reach this game on GitHub yet" would all read as no internet.
**Fix:** `kit/sync` gains a `stopped` state whose line is the error's own words (`SyncStopped`, thrown by an engine);
the loop shows it and stops pulling until the person acts. It is a change to #531's loop, asked of the apps build as
`STATUS_LINES.saved` was; the plan's task 5.1 makes it if the apps build has not.

### A8 (Medium): the empty repository

Review Focus 4 covers the first push. But `startSync` pulls first, and `GET /repos/{repo}/git/ref/heads/main` on an empty
repository is a 409 ("Git Repository is empty"), which reaches the loop as an error and reads "no internet". The branch is
also not always `main` (a person's default branch setting). **Fix:** `fetchMain` treats 409-empty as `unchanged`; the
branch is the repository's `default_branch`, read once and kept in `sync.json`.

### A9 (Medium): sign-out's token

`POST /api/github/sign-out` "revokes the token (`DELETE /applications/{client_id}/token`)", but the function holds only
the sealed refresh token, and that endpoint takes an access token. Revoking the whole grant
(`DELETE /applications/{client_id}/grant`) would also sign the person out of the Automata app on their other devices.
**Fix:** the page sends its access token in the sign-out body; the function revokes that one token and clears `af_gh`.
The refresh token goes with the cookie. Never the grant.

### A10 (Medium): back from GitHub's install page

Spec 7.3 opens `github.com/apps/<slug>/installations/new`. After the person chooses, GitHub goes to the app's Setup URL,
which the Owner's steps do not set, and one App serves the web and the apps, so a web Setup URL would take app users to
the site. **Fix:** the install page opens in a new tab; Your games says "Choose your games on GitHub, then come back
here." and checks again when the page comes to the front (and on **Check again**). No Setup URL.

### A11 (Medium): the Function's headers

`site/scripts/write-headers.ts` writes `_headers`, and Cloudflare Pages does not apply `_headers` to responses a Function
makes. The token and callback responses would go out without the site's security headers and with no cache rule.
**Fix:** `handleGitHub` sets `Cache-Control: no-store` and `securityHeaders('/api/github/')` on every response; task 4.1
tests it. `knip` and `pnpm style` must see `site/functions/` as an entry (task 4.1).

### A12 (Low): Review Focus task numbers

Review Focus 2 says task 5.2 (the Web Lock test is in 4.2), 3 says 5.1 (4.1), 4 says 6.1 (there is no phase 6; it is
5.1). Fixed.

### A13 (Low): `saveLine`'s missing rows

`kit/sync`'s states include `pulling` ("Checking GitHub…"), and `savedWithNotes` gives a `saved` status whose line is
only the notes about generated files. The table has neither. **Fix:** "Checking GitHub…" while pulling and nothing waits
locally; a pull's notes follow "Saved on this device and on GitHub" in the same line.

### A14 (Low): `SaveState` on editors v2

v2's `SaveState.svelte` takes `save: 'saved' | 'saving' | { failed }` and prints "Saved" itself; the spec's words
("Saved on this device", "Saved in your game folder") need a `words` prop. Task 1.3 says so.

### A15 (Low): nobody has an old `sample-game/`

The site has never been deployed (spec 14: the host is not set up; the stack waits for Pixi 3D to be public), so no
visitor has a `sample-game/` folder; only people who ran the site locally do. Adopting it as "Your first game" (spec 6.4,
`adoptSampleFolder`, Review Focus 5) is code and a test for nobody. **Fix:** cut. The editors on the web never read
`sample-game/`; it is left as it is. If a deploy of #532 ever ships before this build, the cut is undone.

### A16 (Low): words

- "This isn't an Automata game: it has no content/editors.toml." names a file. Now: "This isn't an Automata game. Pick a
  .zip you saved from Automata."
- "Choose which games Automata may sync" uses "sync". Now: "Choose which games Automata may keep on GitHub".
- "Let Automata see this game" stays; with A10 the line after it says where to come back.

### A17 (Low): small facts

- Task 4.3's `site/tests/unit/site-checks/pages.test.ts` does not exist; the site checks' tests are
  `site/tests/unit/scripts/site-checks.test.ts`.
- #532 already passes the probe's result through as `kept` (P6's first half); the build adds `reason` and `where`.

## 3. What was checked and holds

- `kit/sync` (#531): `GitEngine` (`fetchMain`, `mergeMain`, `commitAll`, `hasUnpushed`, `push`), `startSync` with
  `isSignedIn`, `store.notifyChanged`, `edited`, 60 s pulls and a 10 s commit, `mergeFile`, `isGeneratedPath`,
  `generatedFolders`, `OfflineError`, `STATUS_LINES` (saved now "Saved on this device and on GitHub", `e66059ce`),
  `fake-github.ts`; `templateFiles` and `ID_REGEX` at `@mcthaydt/automata-tools/template-files`. All as the spec says.
- #532: `openSuitePorts` keeps the sample in OPFS `sample-game/`, `samplePorts` keeps a visitor's files over the sample's
  except the editor list; `createOpfsStore` takes one `directory` (a nested one is the plan's change); `flushOnHide` is
  used only by the 2D and 3D document controllers.
- The field files the plan names exist where it says (`WordsField`, `FieldRow`, `TunerRows:100–105`,
  `ControlsSection:65–69`); `write(path, text, label, owner?)` is the write path's signature; `fflate` 0.8.3 is pinned
  in `editor-3d`, whose import skips entries over 16 MB and unsafe paths.
- GitHub: PKCE `S256` and the token lifetimes are as the spec says; the web flow's code exchange and refresh need the
  client secret, so a function is needed; the device flow's refresh does not.
- The cookie plan holds: `af_gh_start` must be `Lax` for GitHub's redirect back; `af_gh` can be `Strict` because the
  page's `POST /api/github/token` is same-site.
- `wrangler pages deploy build` runs in `site/`, so `site/functions/` is the folder it bundles.
- Eighteen tasks; the self-review's coverage map is right once A2 to A6 are folded in.

## 4. Verdict

Ready to build once the fixes above are in the spec and plan (they are, in this pull request). Nothing needs the Owner:
A1 to A17 are corrections inside the decisions already taken. The Owner's steps gain nothing (A10 removes the need for a
Setup URL).
