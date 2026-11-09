# Saving on the device, the try-it apart, and sign in with GitHub: plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans to implement this plan task by task
> (the Owner allows no subagents), with superpowers:test-driven-development for every code change and
> superpowers:verification-before-completion before ticking a box. Steps use checkbox (`- [ ]`) syntax.

**Goal:** every edit on the web is kept on the device the moment it is made (typed words included), the try-it is its
own page that starts a real game, and a person who signs in with GitHub has their games on every device.

**Architecture:** the kit gains a typing registry, a saved line and a persist call; the write path joins one field visit
into one Undo step. A new `web-games` feature keeps each game in OPFS `games/<id>/` with an index. The site gains `/try`
and one stateless Cloudflare Pages Function for GitHub's web flow. The web syncs through #531's `kit/sync` loop with a
second `GitEngine` over GitHub's REST API.

**Tech stack:** as the stack: pnpm 10, turbo, Node 24, TypeScript, Vitest 5 (browser mode), Playwright, Svelte 5, Zod,
Biome, SvelteKit `adapter-static`. `fflate` 0.8.3 (already pinned). Web Crypto, Web Locks, OPFS. No new dependency.

**Spec:** [2026-11-08-sign-in-sync-spec.md](2026-11-08-sign-in-sync-spec.md), from the
[audit](2026-11-08-sign-in-sync-audit.md). Executors read both.

**Where it starts:** Task 0.1 starts the build branch from a merge of #532 (`claude/project-thread-szjdbh`, every editor
on the web), #531 (the apps build, `kit/sync` and `templateFiles`) and #521 (`claude/project-thread-k1ftgu`, the top of
the site stack: `write-headers.ts`, `app-offer.ts` and the site words phases 3 and 4 change), or from `main` once all
three have merged, and records the heads. Paths below are at that merge. If editors v2 (`claude/project-thread-q3zxgn`) has merged by then, the header is
v2's `SuiteHeader.svelte` with `SaveState.svelte`; otherwise `SuiteTopBar.svelte`. Task 1.3 names both.

**Sessions:** refreshed after 90 minutes. A session ends by ticking its steps, updating `progress.md`, pushing, and two
lines in this file's execution log.

**Pull requests:** one per phase, stacked, opened ready, with the attribution block.

**Copy:** every string a task adds goes in `docs/refactor/copy.md` ("Saving and sign-in") in the same commit and passes
the drunk grandma test.

**Real-thing rule:** every audit of this area makes a game on `/try`, edits it in the editors, reloads, closes and reopens
the browser, and checks the edits are there; the played half runs under `automata editor` on the same files.

## Global Constraints

- Nothing a person made lives only in memory. A browser that keeps nothing says "Not saved: this browser can't keep
  files. Save a copy to keep your work." (AGENTS.md: a missing capability fails and says so.)
- Typed words are written 500 ms after the last input, at once on leaving the field, and flushed on `pagehide` and on
  hidden.
- The GitHub token is never in `localStorage`, `sessionStorage`, OPFS or a URL. The function stores nothing and logs
  nothing. No game data passes through it.
- `/editor/app/`'s policy is `connect-src 'self' https://api.github.com`; every other page keeps its own.
- Never force-push; never write a conflict marker into a game file; `.automata/` is never pushed or pulled.
- A feature imports only itself and `shared/`; `app/` wires; `entries/` re-exports. Tests in `tests/`, imports as `#src/…`.
- Touch targets at least 44 px, primary actions 48 px; phone size first; the saved line shows at every size.
- Package names as on `main` (`@mcthaydt/automata-*`).
- Only published packages get a changeset (`patch`); `-editor`, `-editors` and the site are private.

## Review Focus

1. **A reload or a closed tab inside the half second after the last key.** Expect the words back from the `localStorage`
   draft on the next open, on every engine (Safari on iPhone and iPad has no "Leave site?" question). Test in tasks 1.1
   and 1.4.
2. **Two tabs of the editors open, both signed in, when the access token runs out.** Expect one refresh (the Web Lock),
   both tabs with a working token, never a 401 that signs the person out. Test in task 4.2.
3. **GitHub's redirect back after sign-in.** A `SameSite=Strict` start cookie is not sent on that cross-site navigation;
   expect `af_gh_start` to be `Lax` and the callback to succeed. Test in task 4.1.
4. **The first push to the empty repository the person just made.** The Git Data API refuses an empty repository;
   expect the Contents API first file, then one commit, and the pull before it to say nothing went wrong (a 409 is
   `unchanged`). Test in task 5.1.
5. **A number field on its way to a valid value** ("0." for "0.5", a cleared name being retyped). Expect the field left as
   typed, no refusal until it is left, and nothing written until the value is valid. Test in task 1.1.

---

## Tracking

`docs/refactor/progress.md`, section "Sign-in that syncs, and the try-it apart from the editors", holds the stage table
and, during the build, this table; the build's percentage is `done tasks / 18`:

```markdown
### Build: 0% (0 of 18 tasks)

| Task | Phase | Status | PR |
|---|---|---|---|
| 0.1 The base | 0 | Not started | |
```

At the end of each task, set its row to "Done, <date>" with the engines that ran, recompute the percentages (the
build's, and the overall `stages done / stages`), and commit the change with the task.

---

## Phase 0: The start

### Task 0.1: The base

**Files:**
- Modify: `docs/refactor/2026-11-08-sign-in-sync-plan.md` (execution log), `docs/refactor/progress.md`

- [ ] **Step 1:** Branch from the merge of #532, #531 and #521 (or `main`), resolve conflicts in their favour, run
  `pnpm install` and `pnpm check`. Expected: green, or the failures recorded as inherited with their owners.
- [ ] **Step 2:** Record the head, which header the page has (v2 or not), and the build table in `progress.md`. Commit
  `docs(refactor): start the saving and sign-in build`.

---

## Phase 1: Typed words and the saved line (PR `claude/saving-typed-words`)

### Task 1.1: Typed words are written as they are typed

**Files:**
- Create: `packages/editor/src/shared/kit/storage/typing-drafts.ts`, `packages/editor/src/shared/kit/fields/typed-save.ts`
- Modify: `packages/editor/src/entries/kit-storage.ts`, `packages/editor/src/entries/kit-fields.ts`,
  `extensions/editors/src/shared/ui/WordsField.svelte`, `extensions/editors/src/shared/ui/FieldRow.svelte` (a draft
  never resets the input or shows a refusal; `commit="leave"` for the id fields in `CharacterInspector`,
  `PlacesCanvas` and `ModeInspector`), `packages/editor/src/features/suite/tuner/ui/TunerRows.svelte`,
  `packages/editor/src/features/suite/tuner/ui/ControlsSection.svelte`,
  `packages/editor/src/shared/kit/fields/FieldEditor.svelte`, `packages/editor/src/shared/kit/widgets/Stepper.svelte`,
  `packages/editor/src/shared/kit/widgets/ColorField.svelte`, `packages/editor/src/features/characters/EntityInspector.svelte`,
  `.../characters/FieldDefEditor.svelte`, `.../characters/AnimationSection.svelte`,
  `packages/editor/src/features/tiles/RuleInspector.svelte`,
  `packages/editor/src/features/suite/shell/Suite.svelte` (creates the registry, sets it in context, `flushOnHide`,
  the `beforeunload` guard)
- Test: `packages/editor/tests/unit/shared/kit/storage/typing-drafts.test.ts`,
  `packages/editor/tests/unit/shared/kit/fields/typed-save.test.ts`, `extensions/editors/tests/unit/shared/words-field.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface TypingDrafts {
    field(commit: (value: string) => void): TypingField
    flush(): void                       // commits every waiting field now
    readonly waiting: number            // fields with typed, uncommitted text
    visit(): string | undefined         // the open visit's key (task 1.2)
    wrote(): void                       // the session saw the visit's write (task 1.2)
    subscribe(listener: () => void): () => void
  }
  interface TypingField { typed(value: string): void; left(value: string): void; dispose(): void }
  createTypingDrafts(deps: {
    timers: { after(ms: number, run: () => void): () => void }
    drafts?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>   // localStorage; absent or throwing: no drafts
    scope: string                                                    // the game, so two games' drafts never meet
  }): TypingDrafts
  // A field's draft key is scope + file + field; `field(commit, { key, valid?(value): boolean, leaveOnly?: boolean })`.
  pendingDrafts(drafts, scope): readonly { key: string; value: string; at: number }[]  // on open, newer than the file: commit
  setTypingDrafts(drafts: TypingDrafts): void        // Svelte context
  typingDrafts(): TypingDrafts                         // the context's, or a standalone one
  typedSave(node: HTMLInputElement | HTMLTextAreaElement, params: { drafts: TypingDrafts; commit(value: string): void }): ActionReturn
  ```
  `TYPING_DELAY_MS = 500`.

- [ ] **Step 1: Failing tests** (fake timers): `typed('a'); typed('ab')` commits `'ab'` once after 500 ms; `left('ab')`
  commits at once and cancels the timer; the same text is never committed twice; `flush()` commits every waiting field;
  every `typed` writes its draft to the fake `localStorage` synchronously and a landed commit removes it; a draft left
  by a closed page is returned by `pendingDrafts` and committed on open; a throwing `localStorage` changes nothing else;
  a value `valid` refuses is not committed while typing and the input is not reset (Review Focus 5); a `leaveOnly`
  field commits only on leave and on flush;
  `waiting` counts fields with uncommitted text and notifies subscribers; the action wires `input`, `blur`, `focus` and
  Ctrl/Cmd+Enter. WordsField: typing "Hello grandma" and waiting 500 ms calls `onchange('Hello grandma')` with focus
  still in the field. Suite: a `pagehide` event and `visibilitychange` to hidden call `flush()`; `beforeunload` calls
  `preventDefault()` while `waiting > 0` or a write is in flight, and not otherwise; a served write made while hiding
  passes `keepalive: true` (Review Focus 1).
- [ ] **Step 2:** Run `pnpm --filter @mcthaydt/automata-editor test:unit -- typing` and the editors' unit tests. Expected:
  FAIL, missing modules.
- [ ] **Step 3:** Implement. WordsField's comment changes to "saved half a second after the last key, and when left".
- [ ] **Step 4:** Run the same. Expected: PASS. Then `pnpm check`.
- [ ] **Step 5:** Copy rows. Commit `fix(editors): typed words are saved as they are typed (P14)`.

### Task 1.2: One Undo step per field visit

**Files:**
- Modify: `packages/editor/src/shared/editor-list/write-path.ts`, `.../editor-list/write-history.ts`,
  `packages/editor/src/features/suite/shell/suite-session.ts`, `packages/editor/src/shared/kit/history/history.ts`
  (`apply`'s options gain `join`), `extensions/editors/src/shared/toml-session.ts` and `content-session.svelte.ts`
  (the visit key reaches `History.apply`), the Writer, Feel, Audio, Sequence and Schematic sessions' `change`
- Test: `packages/editor/tests/unit/shared/editor-list/write-path.test.ts`,
  `packages/editor/tests/unit/suite/shell/suite-session.test.ts`, the kit history's test,
  `extensions/editors/tests/unit/shared/toml-session.test.ts`

**Interfaces:**
- Consumes: `TypingDrafts.visit()`, `.wrote()` (task 1.1).
- Produces: `WritePath.write(path, text, label, owner?, options?: { join?: string })`, `writeAll(files, label, owner?,
  options?)`; `History.apply(label, update, { coalesce?, join? })` (a `join` key joins the top step with the same key,
  with no time window); `createSuiteSession(raw, { drafts?: TypingDrafts })`; `SuiteSession.inFlight: number`.

- [ ] **Step 1: Failing tests:** three writes of `content/lines/shop.toml` with `join: 'v1'` make one step whose undo
  restores the text before the first; a write with `join: 'v2'`, or to another file, or after another step of the same
  owner, makes a new step; a redo stack is cleared by a joined write as by any write. Session: a write while
  `drafts.visit()` is `'v1'` passes `join: 'v1'` and calls `drafts.wrote()`; `inFlight` is 1 during a write and 0 after,
  and subscribers hear both. Drafts: a visit closes after `left` once `wrote()` is called, or 1 s after `left`. Writer:
  "Hello", a pause of 2 s, " grandma", leave: Undo once gives the line before "Hello" (the editor's own history, not
  only the write path's).
- [ ] **Step 2–4:** Fail (unknown option), implement, pass.
- [ ] **Step 5:** Commit `feat(suite): a field's typing is one Undo step`.

### Task 1.3: The saved line, at every size

**Files:**
- Create: `packages/editor/src/shared/kit/storage/save-line.ts`, `packages/editor/src/shared/kit/storage/keep-storage.ts`
- Modify: `packages/editor/src/features/suite/shell/open-suite-ports.ts` (`OpenedSuitePorts` gains `where` and
  `reason`), `Suite.svelte` (the line from `saveLine`, shown compact too; `saved={!sample && !compact}` goes),
  the header (`SaveState.svelte` + `SuiteHeader.svelte` on v2, where `SaveState` gains a `words` prop in place of its
  fixed "Saved"; else `SuiteTopBar.svelte:89`)
  (`kit/sync`'s `STATUS_LINES.saved` already reads "Saved on this device and on GitHub", #531 e66059ce)
- Test: `.../tests/unit/shared/kit/storage/save-line.test.ts`, `.../keep-storage.test.ts`,
  `.../tests/unit/suite/shell/open-suite-ports.test.ts`, `.../tests/browser/layout/` (the line on a phone)

**Interfaces:**
- Consumes: `TypingDrafts.waiting`, `SuiteSession.inFlight`, `SyncStatus` (#531).
- Produces:
  ```ts
  type Where = 'folder' | 'device' | 'nowhere'
  interface SaveLineInput { pending: number; failed?: string; where: Where; reason?: string; sync?: SyncStatus }
  saveLine(input: SaveLineInput): { state: 'saved' | 'saving' | 'failed'; words: string }
  keepStorage(storage?: { persisted?(): Promise<boolean>; persist?(): Promise<boolean> }): () => Promise<void>  // once
  ```

- [ ] **Step 1: Failing tests:** every row of spec 4.2's table, word for word, from `saveLine` (including "Checking
  GitHub…", a saved status with a pull's notes, and a stopped one); `pending > 0` wins over
  everything except `nowhere`; `keepStorage` calls `persist()` once when `persisted()` is false, never when true, never
  twice, and swallows a rejection; `openSuitePorts` with a refused probe returns `where: 'nowhere'` and the reason (P6);
  the header shows the line at 390×844 with the tick icon, text not clipped.
- [ ] **Step 2–4:** Fail, implement, pass. `keepStorage` runs on the first write of the page (suite session).
- [ ] **Step 5:** Copy rows. Commit `fix(suite): say where the game is saved, at every size (P6, P7, P8)`.

### Task 1.4: Journeys that reload without leaving the field

**Files:**
- Create: `extensions/editors/tests/e2e/journeys/typed-words-kept.test.ts`
- Modify: `extensions/editors/tests/e2e/harness/run-editor.ts` (a static run of `dist/suite` with no editor server and
  a persistent browser context)
- Test: the journey

- [ ] **Step 1: Failing journey,** for `automata editor` on a new game and for the page with no server, in Chromium and
  `editor-ipad-webkit`: in Writer type "Typed and never left the field.", wait for the line to read "Saved…" (served:
  "Saved in your game folder", web: "Saved on this device"; never a sleep), reload, read the line back; the same in
  Feel (the shake's "How hard"), a Levels 2D inspector field, and, served only, the Tuner (a control's name: the web
  Tuner has no field, spec 5); the same with the page hidden (`page.evaluate` to dispatch `visibilitychange`) and then a
  new page; type and close the tab at once (`page.close()` within 100 ms of the last key, no wait for the line): the
  words are back on the next open (Review Focus 1); served: the file on disk has the words, and the played game shows
  the Writer line.
- [ ] **Step 2:** Run on the base of task 1.1 (`git stash` the fix). Expected: FAIL, the old line back. Then PASS on the
  branch.
- [ ] **Step 3:** Commit `test(editors): typed words survive a reload without leaving the field`. Open the phase's PR.

---

## Phase 2: Your games on this device (PR `claude/saving-web-games`)

### Task 2.1: Games in the browser's storage

**Files:**
- Create: `packages/editor/src/features/web-games/games-index.ts`, `.../web-games/web-games.ts`,
  `packages/editor/src/entries/web-games.ts` (`./web-games` in `package.json`)
- Modify: `packages/editor/src/shared/kit/storage/handle-store.ts` (`createOpfsStore`'s `directory` may be `a/b`)
- Test: `packages/editor/tests/unit/web-games/games-index.test.ts`, `.../web-games/web-games.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface GameEntry { id: string; title: string; changed: number; github?: string }
  interface WebGames {
    readonly kept: boolean; readonly reason?: string
    list(): Promise<readonly GameEntry[]>                  // newest change first
    create(title: string, files: readonly { path: string; text: string }[]): Promise<GameEntry>
    store(id: string): Promise<ProjectStore>              // games/<id>/
    touched(id: string): Promise<void>                    // changed = now
    remove(id: string): Promise<void>
    last(): Promise<{ game: string; editor?: string } | undefined>
    remember(game: string, editor?: string): Promise<void>
    link(id: string, repo: string | undefined): Promise<void>
  }
  openWebGames(env: { storage?: WorkspaceEnv['storage']; now(): number }): Promise<WebGames>
  gameId(title: string, taken: readonly string[]): string    // "Lantern Run" → lantern-run; taken → lantern-run-2
  ```

- [ ] **Step 1: Failing tests** (fake OPFS from the kit's testing entry): `create` writes every file under
  `games/<id>/` and the index; `gameId` keeps `ID_REGEX`, strips accents and symbols, falls back to `my-game`;
  `list` sorts by `changed`; a corrupt `games.json` is rebuilt from the folders; `remember` then a new `openWebGames`
  over the same storage gives `last()` back (a restart); a refused probe gives `kept: false` with the reason and memory
  stores.
- [ ] **Step 2–4:** Fail, implement, pass.
- [ ] **Step 5:** Commit `feat(editor): the person's games, kept in this browser`.

### Task 2.2: The page opens the person's games

**Files:**
- Modify: `extensions/editors/src/app/suite/open-content-suite.ts`, `extensions/editors/src/app/suite/main.ts`,
  `packages/editor/src/features/suite/shell/open-suite-ports.ts` (a `local` game in place of the sample),
  `Suite.svelte` and `SuiteHome.svelte` (no "Sample game" title or banner: P13; the title is the game's name; the open
  editor is reported through `onEditor`)
- Test: `extensions/editors/tests/unit/app/open-content-suite.test.ts`

**Interfaces:**
- Consumes: `WebGames` (2.1), `templateFiles` (#531).
- Produces: `openSuitePorts(env & { local?: { store: ProjectStore; title: string; where: Where;
  reason?: string } })`; `openContentSuite` resolves to `{ kind: 'game', … } | { kind: 'games' } | { kind: 'new',
  startingPoint: string }` from `?game`, `?games`, `?new` and `last()`.

- [ ] **Step 1: Failing tests:** a `sample-game/` folder is neither read nor removed (spec 6.4); `/editor/app/` with no
  query opens `last()`; with no games it resolves `games`; `?new=2d` resolves `new`; `?game=nope` resolves `games`; a served page ignores all of these.
- [ ] **Step 2–4:** Fail, implement, pass.
- [ ] **Step 5:** Commit `feat(editors): the web editors open your games (P5, P12, P13)`.

### Task 2.3: Your games, a new game, and copies

**Files:**
- Create: `packages/editor/src/features/web-games/YourGames.svelte`, `.../web-games/NewGame.svelte`,
  `.../web-games/game-copy.ts`
- Modify: `extensions/editors/src/app/suite/main.ts` (mounts Your games or New game when `openContentSuite` says so; the
  suite's title links to `?games` on the web), `packages/editor/package.json` (`fflate` 0.8.3), `docs/versions.md`
- Test: `packages/editor/tests/unit/web-games/game-copy.test.ts`, `.../web-games/your-games.test.ts`,
  `.../tests/browser/layout/your-games.test.ts`

**Interfaces:**
- Produces: `saveCopy(store: ProjectStore): Promise<Uint8Array>` (zip, no `.automata/`);
  `openCopy(zip: Uint8Array, games: WebGames): Promise<{ ok: true; game: GameEntry } | { ok: false; why: string }>`.

- [ ] **Step 1: Failing tests:** `saveCopy` then `openCopy` gives the same files; a zip with one top folder is read
  below it; an entry over 16 MB, a `..` path or no `content/editors.toml` is refused with the reason in words ("This
  isn't an Automata game. Pick a .zip you saved from Automata."); New game asks "What's your game called?", shows the id it
  will use, and a taken name gets `-2`; Your games lists name, "Changed 5 minutes ago" (injected clock), "On this device";
  Remove asks "Remove {name} from this browser? A copy on GitHub stays." first; on a phone every button is at least
  44 px and the primary 48 px; signed out, a note says "Saved in this browser only. Save a copy, or sign in with GitHub,
  to keep it safe."
- [ ] **Step 2–4:** Fail, implement, pass.
- [ ] **Step 5:** Copy rows. Commit `feat(editors): your games, a new game, and Save a copy`.

### Task 2.4: The journey: made, reloaded, reopened

**Files:**
- Create: `extensions/editors/tests/e2e/journeys/web-game-kept.test.ts`

- [ ] **Step 1: Journey** on the static page, Chromium and WebKit: `?new=2d`, name "Grandma's Game", New level from
  Platformer, place three coins, change a Writer line (staying in the field until the line says "Saved on this device"),
  reload: the game and editor reopen with both edits; close the context, open a new persistent one on the same folder:
  both still there; Save a copy, remove the game, Open a copy: both there again.
- [ ] **Step 2:** Run. Expected: PASS. Commit `test(editors): a web game is kept through a reload and a restart`. Open
  the phase's PR.

---

## Phase 3: `/try` and the site's words (PR `claude/saving-try-page`)

### Task 3.1: The try page

**Files:**
- Create: `site/src/features/try/starting-points.ts`, `site/src/features/try/TryPage.svelte`,
  `site/src/routes/try/+page.svelte`
- Modify: `site/scripts/build-demos.ts` (`buildStartingPoints()`: `templateFiles` into a temporary workspace folder,
  `vite build --mode web`, copy to `static/try/<id>/`), `site/src/shared/html/security-headers.ts` (`/try/` builds take
  `DEMO_POLICY`), the site's nav ("Try it" → `/try`)
- Test: `site/tests/unit/try/starting-points.test.ts`, `site/tests/e2e/try.e2e.ts`

**Interfaces:**
- Produces: `interface StartingPoint { id: string; title: string; line: string; kind: '2d' | '3d'; build: string }`;
  `STARTING_POINTS: readonly StartingPoint[]` (the 2D starter; 3D added when Pixi 3D is public).

- [ ] **Step 1: Failing tests:** every starting point's `id` is a kind `templateFiles` makes and its `line` names only
  things the template has (the test reads the template's level for each noun it checks: coins, the player); `/try` shows
  each with its picture, a playing frame and "Make this game" linking to `/editor/app/?new=<id>`; the frame's game
  reaches its first frame; at 390 px the page has no horizontal scroll and the button is 48 px.
- [ ] **Step 2–4:** Fail, implement, pass.
- [ ] **Step 5:** Copy rows. Commit `feat(site): a try page that starts a real game`.

### Task 3.2: The site says what the page does

**Files:**
- Modify: `site/src/features/editor/EditorPage.svelte` ("Open the editors"; "Your games are saved in this browser"),
  `site/src/features/legal/Privacy.svelte` (the editors keep games in this browser's private storage),
  `site/tests/e2e/editor-try.e2e.ts`, `site/src/features/app/app-offer.ts` (drop "Sync with GitHub" and the editors the
  web has, P11; tell the apps thread in the commit body)
- Test: `site/tests/e2e/editor-try.e2e.ts`

- [ ] **Step 1: Failing test:** on the built site, make a game on `/editor/app/`, change a Writer line, reload: still
  there; the Editor page and Privacy contain "saved in this browser" and no longer "gone when you close" (P3).
- [ ] **Step 2–4:** Fail, implement, pass. Run `pnpm check:site`.
- [ ] **Step 5:** Commit `fix(site): say the editors keep your games in this browser (P3, P11)`. Open the phase's PR.

---

## Phase 4: Sign in with GitHub (PR `claude/sign-in-github`)

### Task 4.1: The sign-in function

**Files:**
- Create: `site/src/features/sign-in/server/github-routes.ts`, `.../server/seal.ts`, `.../server/pkce.ts`,
  `site/functions/api/github/[[route]].ts`
- Modify: `knip.jsonc` (`site/functions/**` is an entry), the style and boundaries lists if they skip it
- Test: `site/tests/unit/sign-in/github-routes.test.ts`, `.../seal.test.ts`, `.../pkce.test.ts`

**Interfaces:**
- Produces: `handleGitHub(request: Request, env: GitHubEnv, deps: { fetch: typeof fetch; now(): number; random(n:
  number): Uint8Array }): Promise<Response>`; `interface GitHubEnv { GITHUB_CLIENT_ID?: string; GITHUB_APP_SLUG?: string;
  GITHUB_CLIENT_SECRET?: string; COOKIE_KEY?: string; SITE_ORIGIN: string }`; `seal(key, value, expiresAt)` /
  `unseal(key, sealed, now)`; `pkcePair(random)`.

- [ ] **Step 1: Failing tests** (fake GitHub as `fetch`): `ping` is 404 with any variable missing; `start` sets
  `af_gh_start` with `SameSite=Lax`, `HttpOnly`, `Secure`, `Path=/api/github/`, `Max-Age=600` and redirects with
  `code_challenge_method=S256` (Review Focus 3); `start?back=https://evil.example/` is refused; `callback` with a wrong
  `state` is 400 and sets nothing; a good callback posts the verifier and secret, sets `af_gh` (`SameSite=Strict`) and
  redirects to `back` with no token in the URL; `access_denied` redirects to `back?github=denied`; `token` without
  `Origin` = the site or without `X-Automata: 1` is 403; `token` re-seals the rotated refresh token; GitHub refusing the
  refresh gives 401 and clears the cookie; `sign-out` revokes the access token the page sends
  (`DELETE /applications/{client_id}/token`, never `/grant`) and clears; every response has `Cache-Control: no-store`
  and the site's security headers (Cloudflare's `_headers` does not reach a Function); a sealed value tampered by one byte or past its
  expiry does not unseal; no response body or header ever holds the client secret.
- [ ] **Step 2–4:** Fail, implement, pass.
- [ ] **Step 5:** Commit `feat(site): sign in with GitHub through one function that stores nothing`.

### Task 4.2: Signing in from the editors

**Files:**
- Create: `packages/editor/src/shared/kit/sync/web-sign-in.ts`, `packages/editor/src/features/web-games/SignIn.svelte`
- Modify: `packages/editor/src/entries/kit-sync.ts`, `site/src/shared/html/security-headers.ts` (`EDITOR_POLICY` for
  `/editor/app/` with `connect-src 'self' https://api.github.com`), `site/scripts/write-headers.ts`,
  `extensions/editors/src/app/suite/open-content-suite.ts` (a session when `/api/github/ping` says ready)
- Test: `packages/editor/tests/unit/shared/kit/sync/web-sign-in.test.ts`, `site/tests/unit/shared/security-headers.test.ts`,
  `packages/editor/tests/unit/web-games/sign-in.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface WebGitHubSession {
    token(): Promise<string | undefined>     // in memory; renewed 60 s early through /api/github/token
    login(): Promise<string | undefined>     // GET api.github.com/user, cached
    signIn(back: string): void               // location.assign('/api/github/start?back=…')
    signOut(): Promise<void>
    subscribe(listener: () => void): () => void
  }
  createWebGitHubSession(deps: { fetch: typeof fetch; locks?: LockManager; channel?: BroadcastChannel; now(): number;
    navigate(url: string): void }): WebGitHubSession
  githubReady(fetch: typeof fetch): Promise<boolean>    // GET /api/github/ping
  ```

- [ ] **Step 1: Failing tests:** `token()` posts with `X-Automata: 1` once and reuses the token until 60 s before
  `expiresAt`; two sessions sharing a fake lock and channel refresh once (Review Focus 2); a 401 makes `token()`
  `undefined` and notifies; nothing is written to any storage (the fakes record none); `?github=denied` shows "GitHub
  said no. Start again if you want to connect."; signed out the sign-in card reads "Keep your games on all your devices"
  / "Sign in with GitHub (free)" / "Your games are kept in your own GitHub account. Automata keeps nothing."; with ping
  not ready, no card; the editor policy allows `https://api.github.com` and the demos' policy does not.
- [ ] **Step 2–4:** Fail, implement, pass.
- [ ] **Step 5:** Copy rows. Commit `feat(editors): sign in with GitHub on the web`.

### Task 4.3: Privacy and Terms

**Files:**
- Modify: `site/src/features/legal/Privacy.svelte` (`#github`: the sign-in, the cookie `af_gh` and why, tokens stay in
  the person's browser, "Automata keeps nothing"), `site/src/features/legal/Terms.svelte`,
  `site/scripts/site-checks/pages.ts` (refuse a build with `site/functions/api/github/` and no `#github`)
- Test: `site/tests/unit/scripts/site-checks.test.ts`

- [ ] **Step 1–4:** Failing check test, implement, pass.
- [ ] **Step 5:** Commit `docs(site): what signing in with GitHub keeps (for the Owner's approval)`. The PR's body quotes
  the new words and says it waits for the Owner's yes (spec section 12). Open the phase's PR.

---

## Phase 5: Sync on the web (PR `claude/sync-web`)

### Task 5.1: The REST engine

**Files:**
- Create: `packages/editor/src/shared/kit/sync/rest-engine.ts`, `.../kit/sync/blob-id.ts`,
  `packages/editor/tests/unit/shared/kit/sync/fake-github-rest.ts` (a repository in memory answering the REST routes)
- Modify: `packages/editor/src/entries/kit-sync.ts`
- Test: `packages/editor/tests/unit/shared/kit/sync/rest-engine.test.ts`, `.../blob-id.test.ts`

**Interfaces:**
- Consumes: `GitEngine`, `mergeFile`, `isGeneratedPath`, `generatedFolders`, `OfflineError`, `startSync` (#531).
- Modify too: `packages/editor/src/shared/kit/sync/sync-loop.ts` and `sync-status.ts` (a `stopped` state and
  `SyncStopped(words)`, shown as "Saved on this device. {words}", pulls paused until the person acts), unless the apps
  build has already added it.
- Produces: `createRestEngine(options: { fetch: typeof fetch; token(): Promise<string | undefined>; store: ProjectStore;
  repo: string; branch?: string }): GitEngine`; `blobId(bytes: Uint8Array): Promise<string>` (git's SHA-1);
  `interface SyncFile { repo: string; branch: string /* the repository's default_branch */; base?: { commit: string; tree: string }; files: Record<string,
  string>; etag?: string; pending?: { message: string; at: number } }` at `.automata/sync.json`.

- [ ] **Step 1: Failing tests** against the fake: `blobId` of "hello\n" is `ce013625030ba8dba906f756967f9e9ca394464a`;
  `fetchMain` sends `If-None-Match` and a 304 is `unchanged`; a file changed only on GitHub is written here; the flash
  here and the shake there in `content/feel/feel.toml` both land; the same key both sides is an ask and the file here is
  untouched; a deleted file is `sha: null` in the pushed tree; a fast-forward refusal is `rejected`; a network error is
  `offline`, `pending` stays, and the next push makes no second commit; on an empty repository `fetchMain` (a 409) is
  `unchanged` and the line never says "no internet", and the first push gets `content/editors.toml` through the
  Contents API, then one commit (Review Focus 4); the branch is the repository's `default_branch`; `.automata/` is never in a tree; a `truncated` tree stops
  with "This game is too big to sync on the web. Use the Automata app." through `SyncStopped`, and `startSync`'s line
  shows those words, not "no internet"; a 403 with `retry-after` waits and says "GitHub asked us to wait. Your game is
  saved on this device."
- [ ] **Step 2–4:** Fail, implement, pass.
- [ ] **Step 5:** Commit `feat(editor): sync a game over GitHub's REST API`.

### Task 5.2: GitHub games, Get it, and Keep this game on GitHub

**Files:**
- Create: `packages/editor/src/shared/kit/sync/github-games.ts`
- Modify: `YourGames.svelte`, `packages/editor/src/entries/kit-sync.ts`
- Test: `.../tests/unit/shared/kit/sync/github-games.test.ts`, `.../tests/unit/web-games/your-games.test.ts`

**Interfaces:**
- Produces: `listGitHubGames(fetch, token): Promise<readonly { repo: string; id: string; title: string }[]>`
  (installations' repositories with `content/editors.toml`); `getGame(fetch, token, repo, games: WebGames):
  Promise<GameEntry>`; `newRepoUrl(id): string`; `installUrl(slug): string`.

- [ ] **Step 1: Failing tests:** two installations, three repositories, two with `content/editors.toml`: two games;
  pagination followed; Get it writes the tree's files and a `sync.json` at that commit, and the game lists "On this
  device and GitHub"; Keep this game on GitHub opens `github.com/new?name=<id>&visibility=private`, shows "Make an empty
  place for your game on GitHub, then come back." and "I made it"; an unreachable repository shows "Automata can't reach
  this game on GitHub yet." with "Let Automata see this game", which opens the install page in a new tab and says
  "Choose your games on GitHub, then come back here."; coming back to the page (visibility) or **Check again** checks
  the repository again.
- [ ] **Step 2–4:** Fail, implement, pass.
- [ ] **Step 5:** Copy rows. Commit `feat(editors): your GitHub games on the web`.

### Task 5.3: The page keeps its game on GitHub

**Files:**
- Modify: `extensions/editors/src/app/suite/open-content-suite.ts` and `main.ts` (`startSync` with the REST engine for a
  linked game; the store's writes call `edited`; pulled paths reload open documents), `Suite.svelte` (the line takes
  `sync`), the conflict dialog when opened by sync (#531's words)
- Test: `extensions/editors/tests/unit/app/web-sync.test.ts`

- [ ] **Step 1: Failing tests** (fake timers, fake GitHub): opening a linked game pulls; an edit commits 10 s later as
  "Edited in Automata: Feel"; offline shows "Saved on this device. Not on GitHub yet: no internet."; after sign-out the
  line says "…sign in to GitHub."; an unlinked game never starts sync; a pulled change to an open Writer file reloads it
  when nothing waits, and opens the conflict dialog when a field is waiting.
- [ ] **Step 2–4:** Fail, implement, pass.
- [ ] **Step 5:** Commit `feat(editors): a web game keeps itself on GitHub`.

### Task 5.4: The journey: two devices, one game

**Files:**
- Create: `extensions/editors/tests/e2e/journeys/web-sync-two-devices.test.ts`,
  `extensions/editors/tests/e2e/harness/fake-github-server.ts` (the fake REST repository and the sign-in routes over HTTP
  on the runner's port, the page's `api.github.com` routed to it with `page.route`)

- [ ] **Step 1: Journey,** Chromium and WebKit: context A makes a game, signs in, keeps it on GitHub; context B signs in
  and gets it; A changes the flash, B the shake; both lines reach "Saved on this device and on GitHub"; after a pull both
  pages show both changes; B reloads and closes and reopens: still both; A goes offline (`context.setOffline`), edits,
  sees the offline line, comes back, and the fake has one new commit.
- [ ] **Step 2:** Run. Expected: PASS. Commit `test(editors): one game on two devices through GitHub`. Open the phase's
  PR. Update `progress.md` to stage 4 done.

---

## Self-review

- Spec coverage: 4.1 → 1.1, 1.2; 4.2 → 1.3; 4.3 → 1.3; 5 → 2.2, 2.3, 3.1; 6.1–6.2 → 2.1, 2.2; 6.3 → 2.3; 6.4 → 2.2;
  7.1 → 4.1; 7.2 → 4.2; 7.3 → 5.2; 8.1 → 5.1; 8.2 → 5.2; 9 → 3.2, 4.3; 11 → 1.4, 2.4, 5.4.
- Eighteen tasks: 0.1, 1.1–1.4, 2.1–2.4, 3.1–3.2, 4.1–4.3, 5.1–5.4.

## Execution log

- 2026-11-08 (stage 2): spec and plan written on #528's branch. `kit/sync` (#531) is the base for sign-in and sync;
  the web adds the web flow and a REST engine beside the app's device flow and git engine.
- 2026-11-08 (stage 2, later): #531 (e66059ce) changed `STATUS_LINES.saved` as asked, kept `GitEngine` and `startSync`'s
  options, and moved the player to `kit/player`. Play on the web still waits for the runtime bundles (spec section 5).
- 2026-11-08 (stage 3, plan audit, [record](2026-11-08-sign-in-sync-plan-audit.md)): A1 to A17 folded in. The base adds
  the site stack (#521); one Undo step per visit is carried by the editors' own history too; a draft never resets a field
  and id fields commit on leave; typed words are kept through a closed tab by a `localStorage` draft; the 2D fields join;
  the web Tuner leg is served only; `kit/sync` gains a `stopped` state; the empty repository's first pull, sign-out's
  token, the install page's way back and the Function's own headers are specified; the old `sample-game/` adoption is
  cut. Reproduced first: typed words are lost on a closed tab or a reload in Writer, Feel and the Tuner, web and served.
- 2026-11-09 (stage 4, build, phase 5): 5.1 to 5.4 done. Rulings: `kit/sync` is copied from #531 (e66059ce) with
  `SyncStopped`, `stopped`, a clock option and a pause added; `github-games.ts` takes a narrow `GameShelf` (a shared module
  may not import a feature's `WebGames`); the site's ping returns the app's public name; `startWebSync` lives in
  `kit/sync/web-sync.ts`, not in the extension, so it is tested with the fake GitHub, and the fake moved to
  `src/testing/kit` with its own entry (`kit/testing/github`) so the journeys can use it; the engine counts a file
  changed here and not committed as unpushed, so an edit saved just before a tab closed, and a game only on this device,
  go to GitHub on the next open; a pull opens the open editor again (it opens on its start, its selection is lost) once
  no word waits, after leaving a focused field, and the write path forgets the pulled files so the next edit is judged
  against them. The journey found the last two (a focused field written in the middle of its removal; "changed on disk").
  The try-it (`?sample`) page now opens on the editor the visitor left.
- 2026-11-09 (stage 4, build, the conflict dialog; the coordinator's word): a file changed on both sides is asked about
  in `SyncConflictDialog`: Keep mine, Keep GitHub's, Keep both (a deletion has two choices). Rulings: the engine stores
  GitHub's id for each waiting file in `.automata/sync.json` (`asked` is now a list of files, not paths), so a choice needs
  no new pull and a waiting file is still asked about after a reload (the loop asks the engine on every pull; before this
  it forgot on reload); a choice fetches before it writes, so a lost network changes nothing and the file keeps waiting;
  Keep mine makes GitHub's version the file's base, so what is here goes up as the next commit and is never forced; Keep
  both saves GitHub's copy at `-github` (`-github-2` if taken) for any file changed on both sides, not only a picture,
  because a clash in a TOML key has no other place to keep both; the dialog opens only once no word waits (never over a
  word being typed), "Not now" puts it away and the top bar's line becomes a button that asks again. The journey found
  that its fake GitHub signed a device out when the browser closed (the real cookie lasts), so the fake now keeps a
  device signed in by profile. The journey's page is the built suite: `vite build` in `extensions/editors` before it.
- 2026-11-09 (stage 5, build audit, [record](2026-11-09-sign-in-sync-build-audit.md)): at `4c855dfa`, in Chromium. Typed
  words are kept through a reload and a restart in every content editor. Three high findings for the fixes stage: drafts
  keyed by label put a closed tab's words in the wrong field or drop them (B1); a pull while typing overwrites the other
  device silently and shows words the file does not have (B2); "on GitHub" is said before the push (B3).
