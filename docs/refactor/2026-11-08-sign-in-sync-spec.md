# Saving on the device, the try-it apart, and sign in with GitHub: spec

Stage 2 (plan and spec) of the area the [audit](2026-11-08-sign-in-sync-audit.md) (#528) opened. The plan is
[2026-11-08-sign-in-sync-plan.md](2026-11-08-sign-in-sync-plan.md).

## 1. What done looks like

A person opens automataframework.com/try, picks a starting point that plays in a small window, and presses **Make this
game**. They name it, and the editors open on it. Every change, typed words included, is in the browser's storage half a
second after the last key, and the line at the top says "Saving…" and then "Saved on this device", at every screen size.
They reload, close the browser, come back the next day: the editors open on the same game and the same editor, with
everything there. They press **Sign in with GitHub**, choose "Keep this game on GitHub", and the game is a repository of
theirs. On a second computer they sign in, open the game from "Your games", change the shake while the first computer
changes the flash, and both changes are on GitHub and in both browsers. A browser that keeps nothing says so and offers
**Save a copy**. `automata editor` on a folder works as before, and its typed words are saved the same way.

## 2. The Owner's decisions this spec carries

| When | Decision | Where |
| --- | --- | --- |
| 2026-11-08 21:34 | The try-it page and the editors are separate; sign-in syncs progress by account | Sections 5, 7 |
| 2026-11-08 21:35 | Progress must persist; every audit reloads, closes and reopens | Sections 4, 11 |
| 2026-11-08 22:30 | D1 = A: sign in with GitHub, each game in the person's own repository | Section 7 |
| 2026-11-08 22:30 | D2: GitHub sync is free on the web; `/app` drops "Sync with GitHub" | Sections 7, 8, 9 |
| 2026-11-06 | Templates live only on the try-it page | Section 5 |
| 2026-11-08 21:25 | Every editor is free on the web (#532 serves every editor on the try-it) | Section 5 |
| 2026-11-08 21:29 | No relay, ever | Section 7: the sign-in step carries no game data |

## 3. What it builds on

- **#532** (every editor free on the web): the every-editor page keeps its sample in OPFS `sample-game/`, with a `kept`
  flag. This spec replaces the sample with the person's own games (section 6.4 says why the old folder is left alone).
- **#531** (apps build): `@mcthaydt/automata-editor/kit/sync` holds the merge-by-file-kind rules (`mergeFile`), the
  generated-file rules, the sync loop (`startSync` over a `GitEngine`), the status words (`STATUS_LINES`) and device-flow
  sign-in (`signIn`, `githubToken`). Nothing in it is gated on the app. The web uses it as it is, adding a second
  `GitEngine` (REST) and a second way to get a token (the web flow), both beside it in `kit/sync`.
- **#531**'s `templateFiles(options)` (`@mcthaydt/automata-tools/template-files`): a new game's files as text, with no
  Node and no Effect. The web makes a game with it, as the phone does.
- **Editors v2** (`claude/project-thread-q3zxgn`): the header's `SaveState.svelte` already has `'saved' | 'saving' |
  { failed }`, fed a constant today. This spec feeds it.

- **The site stack** (#517 to #521, top `claude/project-thread-k1ftgu`): the site's headers file
  (`write-headers.ts`), the `/app` offer (`app-offer.ts`) and the site words this spec changes. Neither #532 nor #531
  contains it (plan audit A1).

Package names follow `main` (`@mcthaydt/automata-*`); the editors and site stacks still say `@automata/*`, and the plan's
first task starts from the merge of the three.

## 4. Saving on the device (the bug fix; it comes first)

### 4.1 Typed words

Text and number fields write a moment after typing stops, not when the field is left.

- **One helper.** A typing registry (`TypingDrafts`, kit storage) and a field action (`typedSave`, kit fields). The
  field calls its editor's commit 500 ms after the last input, again at once when it is left or Ctrl/Cmd+Enter is
  pressed, and never twice for the same text.
- **Where.** Writer's `WordsField.svelte`, the content editors' `FieldRow.svelte` (text and number), the Tuner's string
  value (`TunerRows.svelte:105`) and control name (`ControlsSection.svelte:69`), the kit's `FieldEditor.svelte`,
  `Stepper.svelte` and `ColorField.svelte` (the 2D and 3D inspectors), and the Characters and Tiles editors' text fields
  (plan audit A5). Any later field uses the same action.
- **A draft is not a leave.** While the field has the focus, a draft is committed only when it is valid; it never puts
  the old value back into the input and never shows a refusal (that waits for the leave, as today), so "0." on its way to
  "0.5" and a name cleared to be retyped are left alone. A field that names something other files point at (a
  character's, place's or mode's id) commits on leave only, and its waiting text is still flushed on hide (A3).
- **One Undo step per visit.** Each focus of a field opens a visit. Writes the visit makes to the same file join the
  owner's top Undo step (its `before` stays, its `after` moves) instead of pushing a step per pause. Two histories carry
  it: the editors with their own Undo (Writer, Feel, Audio, Sequence, Schematic: the kit `History` in their
  `TomlSession`) take the visit key as `join` on `History.apply` (the same key joins with no time window while it is the
  top step), and the write path, for editors without their own (the Tuner, the 2D editors), gains `join` on
  `write`/`writeAll` with the same rule, for the same files (A2). A visit closes once the field is left and its last commit has reached the
  write path, or 1 s after it was left, whichever comes first.
- **Flush on hide.** The suite flushes every waiting field on `pagehide` and on `visibilitychange` to hidden (the
  kit's `flushOnHide`). A flush only starts a write, which the browser does not wait for, and Safari on iPhone and iPad
  never asks "Leave site?". So the typing registry also copies each waiting field's text into `localStorage`
  synchronously on every input (one draft per game, file and field, removed once its commit has landed). On open, a draft
  newer than its file is committed as the person's edit. Served writes made while hiding use `fetch` with
  `keepalive`. Where the browser has it, `beforeunload` still asks while anything waits (A4).

### 4.2 The saved line

One pure function, `saveLine(input): { state, words }`, gives the line from: writes in flight plus fields waiting, the
last write's failure, where the game lives (a folder, this device, a browser that keeps nothing) and the sync status.
The suite session counts writes in flight. The header shows the line at every size, phones included (P8).

| Situation | Words |
| --- | --- |
| A field waiting or a write in flight | Saving… |
| Signed in, checking GitHub, nothing waiting here | Checking GitHub… |
| `automata editor`'s folder | Saved in your game folder |
| This browser, signed out or not synced | Saved on this device |
| Synced and nothing waiting | Saved on this device and on GitHub (and a pull's notes about generated files after it) |
| Sync stopped (too big, GitHub asked to wait, can't reach the game) | Saved on this device. {the reason in words} |
| Synced, offline | Saved on this device. Not on GitHub yet: no internet. |
| Synced, signed out since | Saved on this device. Not on GitHub yet: sign in to GitHub. |
| Sync conflict | A file changed here and on GitHub. Choose which to keep. |
| A write failed | Not saved: {the store's message} |
| The browser keeps nothing | Not saved: this browser can't keep files. Save a copy to keep your work. |

The synced rows are `kit/sync`'s `STATUS_LINES`; #531 already changed its `saved` to "Saved on this device and on GitHub"
(e66059ce), so the app and the web say the same.

### 4.3 Keeping the storage

- The first write to a game in a page load calls `navigator.storage.persist()` once, if `persisted()` is false (P7). The
  answer is not shown; it changes nothing the person does.
- `openSuitePorts` passes the private store's `persistent` and `reason` through (P6), so the line can say "Not saved".

## 5. The split

| Address | What it is |
| --- | --- |
| `/try` (site page) | The starting points, each with a picture, one line, a small window playing it and **Make this game**. |
| `/editor/app/` | The editors. With no editor server: the person's games on this device ("Your games"), opening on the last one. |
| `/editor` (site page) | What the editors are; its button becomes "Open the editors". |
| `automata editor` | Unchanged: the folder is the game. No games list and no sign-in. |

- **Starting points are data:** `site/src/features/try/starting-points.ts`, one entry per game `create-game` makes (the 2D
  starter today; the 3D starter once Pixi 3D is public). Each has `id`, `title`, `line` (what the game does, in words a
  drunk grandma follows, checked against the template by a test), `kind`, and the folder of its playable build.
- **The playable build** is made by `site/scripts/build-demos.ts`: the starter is written with `templateFiles` into a
  temporary folder in the workspace, built for the web, and copied to `static/try/<id>/`. Framed like Home's demo.
- **Make this game** links to `/editor/app/?new=<id>`. The editors ask "What's your game called?", make the id from the
  name (`ID_REGEX`), write `templateFiles` into `games/<id>/`, and open it. The site page writes no storage.
- **Your games** (the editors' web home): each game's name, "Changed 5 minutes ago", "On this device" or "On this device
  and GitHub"; **Start a new game** (to `/try`); **Open a copy**; signed in, the GitHub games not on this device. Each
  game: Open, **Save a copy**, **Remove from this device** (asks first: "Remove {name} from this browser? A copy on GitHub
  stays.").
- **The Tuner on the web** has nothing to type into until the game is compiled in the page: its rows come from the
  compiler's `tuning-meta.json` (plan audit A6). It comes with Play on the web.
- **Play on the web** is not in this spec. The in-page player is now shared (`@mcthaydt/automata-editor/kit/player`,
  #531 e66059ce: `compileGame` over a `ProjectStore` and a `RuntimeManifest`), but the web still needs the runtime bundles
  served at the manifest's URLs, which the apps build has not made yet. Until then Play says "Play isn't on the web yet.
  Open your game in the Automata app, or run automata editor on your computer.", as R8 does today. Play on the web is the
  next area once the runtime build exists.
- **New level** keeps offering the level templates (`templates: 'content/levels'`), as #532's try-it does.

## 6. Games in the browser

### 6.1 Layout in OPFS

```
games.json             the index: per game { id, title, changed, github?: "owner/name" }; and last: { game, editor }
games/<id>/            the game's files, as create-game writes them
games/<id>/.automata/sync.json   the last synced commit, tree and blob ids (section 8), only once synced
```

`games.json` is parsed with Zod. A missing or unreadable index is rebuilt from the folders (title = id) and the page
says nothing went missing. A game's folder is a `ProjectStore` over `games/<id>` (`createOpfsStore` accepts a nested
directory).

### 6.2 Remembering where the person was

The suite reports the open editor. `games.json`'s `last` keeps the game and editor, so `/editor/app/` with no query opens
there. `?game=<id>` opens a game; `?games` opens Your games; `?new=<starting point>` makes one.

### 6.3 Save a copy and Open a copy

**Save a copy** downloads `<id>.zip` of the game's files as they are (no `.automata/`), with `fflate` (already pinned at
0.8.3 for `editor-3d`). **Open a copy** reads a zip with one top folder or none, refuses entries over 16 MB and unsafe
paths with the reason (as `editor-3d`'s import does), needs `content/editors.toml` (else "This isn't an Automata game. Pick a .zip you saved from Automata."), and adds the game (`name 2` when the
id is taken).

### 6.4 The old sample folder

The site has never been deployed, so no visitor has #532's `sample-game/`. The web editors never read it and leave it as
it is (plan audit A15). If #532 is ever deployed before this build, adopting it as "Your first game" comes back.

## 7. Signing in with GitHub on the web

The apps sign in with the device flow; its token endpoint sends no CORS headers, so a page can't. The web uses the same
GitHub App with the **web flow**, whose code exchange and refresh need the client secret, through one Cloudflare Pages
Function on the site that stores nothing.

### 7.1 The function

`site/functions/api/github/[[route]].ts` calls `handleGitHub(request, env)` (`site/src/features/sign-in/server/`).
Configuration is Cloudflare's: `GITHUB_CLIENT_ID`, `GITHUB_APP_SLUG`, secrets `GITHUB_CLIENT_SECRET` and `COOKIE_KEY`
(32 random bytes, base64).

| Route | Does |
| --- | --- |
| `GET /api/github/ping` | `{ "github": "ready" }` when configured; 404 otherwise. The page shows sign-in only on "ready". |
| `GET /api/github/start?back=<path>` | Makes `state` and a PKCE verifier, seals them with `back` into cookie `af_gh_start` (`HttpOnly; Secure; SameSite=Lax; Path=/api/github/; Max-Age=600`; Lax because GitHub's redirect back is a cross-site navigation), redirects to `https://github.com/login/oauth/authorize` with `client_id`, `redirect_uri`, `state`, `code_challenge`, `code_challenge_method=S256`. `back` must be a path under `/editor/app/`. |
| `GET /api/github/callback` | Checks `state` against the cookie, exchanges the code (with the verifier and the secret), seals the refresh token into `af_gh` (`HttpOnly; Secure; SameSite=Strict; Path=/api/github/`, `Max-Age` = the refresh token's life), clears `af_gh_start`, redirects to `back`. The access token is not sent to the page here. GitHub's `error=access_denied` redirects to `back?github=denied`. |
| `POST /api/github/token` | Needs `Origin` = the site and header `X-Automata: 1`. Refreshes with the sealed refresh token, re-seals the new one (GitHub rotates it), returns `{ token, expiresAt }`. No cookie or a refused refresh: 401 and the cookie cleared. |
| `POST /api/github/sign-out` | Same checks. The page sends its access token in the body; the function revokes that one token (`DELETE /applications/{client_id}/token`, never the whole grant, which would sign the person out of the Automata app too), clears `af_gh`, 204. |

Sealing is AES-GCM with Web Crypto, a fresh 12-byte IV per seal, and the payload carries its own expiry. Nothing is
logged. Cloudflare's `_headers` file does not reach a Function's responses, so every response sets
`Cache-Control: no-store` and the site's `securityHeaders` itself (A11). No game data passes through the function: the page talks to `api.github.com` itself.

### 7.2 The page

- `createWebGitHubSession({ fetch, locks })` in `kit/sync/web-sign-in.ts`: `token()` keeps the access token in memory,
  renews it 60 s before it ends through `/api/github/token`, and runs that call inside a Web Lock
  (`automata-github-token`), so two tabs never spend the same rotating refresh token. `signIn(back)` navigates to
  `/api/github/start`; `signOut()` posts sign-out. It satisfies what `startSync`'s `isSignedIn` and the REST engine need.
  The token is never in `localStorage`, `sessionStorage` or OPFS.
- The editors' policy on `/editor/app/` gains `connect-src 'self' https://api.github.com` and nothing else. The demos keep
  `connect-src 'self'`.
- Words: "Keep your games on all your devices" / **Sign in with GitHub (free)** / "Your games are kept in your own GitHub
  account. Automata keeps nothing." Signed in: the login and **Sign out**, with "Your games stay on this device." and
  "Sign out and remove my games from this browser" (asks first).

### 7.3 Which repositories

After the first sign-in, the page opens `https://github.com/apps/<slug>/installations/new` in a new tab: "Choose which
games Automata may keep on GitHub". A game whose repository the app can't reach says "Automata can't reach this game on
GitHub yet." with **Let Automata see this game** (the same page, in a new tab). Either way the page says "Choose your
games on GitHub, then come back here.", and checks again when it comes to the front and on **Check again**. The App
needs no Setup URL, which would also catch the apps' users (A10).

## 8. Sync on the web

### 8.1 The REST engine

`createRestEngine({ http, token, store, repo, branch })` in `kit/sync/rest-engine.ts` implements #531's `GitEngine`
over GitHub's REST API (CORS allowed), so `startSync`, its timings (pull on open, on coming to the front, every 60 s;
commit 10 s after the last save), its commit messages and its offline handling are the app's.

| `GitEngine` | REST |
| --- | --- |
| `fetchMain()` | `GET /repos/{repo}/git/ref/heads/{branch}` with `If-None-Match`; 304, the same commit as `sync.json`, or a 409 for an empty repository is `unchanged` (A8). The branch is the repository's `default_branch`, read once into `sync.json`. |
| `mergeMain()` | The commit's tree (`?recursive=1`); paths whose blob id differs from `sync.json` changed there; local files whose git blob id (SHA-1 of `blob <n>\0` + bytes) differs changed here. One side changed: take it. Both: `mergeFile` with the base blob; an ask is left for the person. Generated files follow `isGeneratedPath`. `sync.json` moves to the merged commit. |
| `commitAll(message)` | Records `{ message, at }` as `pending` in `sync.json` when anything changed here; else `undefined`. |
| `hasUnpushed()` | `pending` is set. |
| `push()` | Blobs (base64), a tree on `sync.json`'s base tree (deleted paths as `sha: null`), a commit whose parent is the base, then `PATCH` the ref with `force: false`. 422 (not a fast-forward) is `rejected`; a network failure is `offline`. Success clears `pending` and moves the base. |

- `startSync` turns every error that is not an `OfflineError` into "no internet". `kit/sync` gains a `stopped` state:
  an engine throws `SyncStopped(words)`, the loop shows "Saved on this device. {words}" and stops pulling until the
  person acts (A7). It is asked of the apps build; task 5.1 makes it if that has not.
- A tree GitHub returns `truncated` stops sync with "This game is too big to sync on the web. Use the Automata app."
- **An empty repository** (just made on `github.com/new`) refuses the Git Data API. The first push writes
  `content/editors.toml` with the Contents API, then everything else as one commit on top.
- `.automata/` is never pushed and never pulled.
- Rate limits: the conditional ref read is free on 304; a 403 or 429 with `retry-after` waits that long and says
  "GitHub asked us to wait. Your game is saved on this device."

### 8.2 Your games, signed in

- GitHub games are the repositories in the person's installations (`/user/installations`, then each one's
  repositories) that have `content/editors.toml`. They show beside the device's games; one not on this device has
  **Get it**, which downloads the tree into `games/<id>/` and writes `sync.json`.
- **Keep this game on GitHub** on a device game: opens `github.com/new?name=<id>&visibility=private` in a new tab and
  shows "Make an empty place for your game on GitHub, then come back." with **I made it**. The page then checks the
  repository is reachable (else section 7.3's words) and pushes.
- Conflicts open the existing conflict dialog with "Keep mine", "Keep GitHub's", "Keep both" (#531's words).

## 9. The site's words and checks

- `/editor`: "Open the editors". EditorPage, Privacy and the site's try-it test say games are saved in this browser
  (P3), and a site e2e test makes a change, reloads and finds it.
- Privacy gains: the GitHub sign-in, the one cookie it sets and why, that tokens stay in the person's browser, and
  "Automata keeps nothing". Terms gains a line that GitHub's terms cover the person's repositories. **The Owner approves
  these words** before the PR that adds them is merged (audit section 8).
- `/app`'s list (`app-offer.ts`) drops "Sync with GitHub" (D2) and the editors the web now has (P11). The apps pipeline
  owns the file; this area makes only these removals.
- `check:site` refuses a build whose Privacy lacks a `#github` section once the function exists.

## 10. Where the code lives

```
packages/editor/src/
  shared/kit/storage/typing-drafts.ts   the typing registry (4.1)
  shared/kit/storage/save-line.ts       saveLine (4.2)
  shared/kit/storage/keep-storage.ts    persist() once (4.3)
  shared/kit/fields/typed-save.ts       the field action (4.1)
  shared/kit/sync/web-sign-in.ts        the web token session (7.2)
  shared/kit/sync/rest-engine.ts        the REST GitEngine (8.1)
  shared/kit/sync/github-games.ts       GitHub games and Get it (8.2)
  features/web-games/                   games.json, the games' stores, copies, Your games (6)
extensions/editors/src/app/suite/       open-content-suite.ts wires web games, sign-in and sync into the page
site/functions/api/github/[[route]].ts  the Cloudflare entry (7.1)
site/src/features/sign-in/server/       the routes, sealing, PKCE (plain TypeScript, tested in Node)
site/src/features/try/                  /try (5)
```

Tests sit in each package's `tests/` (`unit/<feature>/`, `browser/`, `e2e/`), importing `#src/…`.

## 11. How it is proved

- Unit: each module above against fakes (a fake GitHub serving REST from a fixture, as #531's `fake-github.ts`).
- Journeys, without a server (the site's built `/editor/app/`) and with `automata editor`, in Chromium and WebKit:
  type in Writer, Feel and a 2D inspector field (and the Tuner, served only) and reload or close the tab **without leaving
  the field**; the same with the page hidden; make a game
  from `/try`, place three coins, change a line, reload, then close the browser context and open a new persistent one.
- Sync: two pages on one game against the fake GitHub, one changes the flash and one the shake, both push, both see
  both.
- The real-thing rule: the build audit makes a game on `/try`, edits it in the editors, reloads and reopens; Play on the web
  waits for the shared player, so the played half runs under `automata editor` on the same files (Save a copy, then
  unzip).

## 12. The Owner's steps

- [ ] In the "Automata" GitHub App: add the callback `https://automataframework.com/api/github/callback`, keep "Expire
      user authorization tokens" on, leave "Request user authorization (OAuth) during installation" off and the Setup URL
      empty, and note the app's slug.
- [ ] Generate the client secret and a cookie key; put both in Cloudflare Pages as secrets, with `GITHUB_CLIENT_ID` and
      `GITHUB_APP_SLUG` as variables.
- [ ] Approve the Privacy and Terms words (section 9).

## 13. Not in this spec

Play on the web (the shared in-page player), Review on the web (needs Play), Publish on the web, Automata accounts (D1 B),
syncing players' saves.

## 14. Risks

- **Safari's seven-day rule** may clear OPFS for a site not visited in a week. Signed in, GitHub is the lasting copy;
  signed out, Your games says "Saved in this browser only. Save a copy, or sign in with GitHub, to keep it safe."
- **A reload inside the half second** is covered by the `localStorage` draft, written as each key is typed; the
  browser's leave question is a second guard where it exists (not on iPhone or iPad). A browser that refuses
  `localStorage` (some private modes) loses up to half a second of typing to a reload.
- **The rotating refresh token** breaks if two tabs refresh at once without the Web Lock; a browser without Web Locks
  (none current) refreshes in one tab only (`BroadcastChannel` hands the token to the others).
- **The site host** (Cloudflare Pages) is not set up yet; the function cannot run until it is.
