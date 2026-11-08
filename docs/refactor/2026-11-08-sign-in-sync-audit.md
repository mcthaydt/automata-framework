# Sign-in that syncs, and the try-it apart from the editors: audit

The Owner, 2026-11-08 21:34: "The try it page and editors should be separated? We should have sign in that syncs
progress by account". A minute later: "Why wasn't it caught that progress doesn't actually save lol".

Read as three asks:

1. **The bug.** Work made in the editors on the web does not stay. Find what is lost, where and why, and why no audit
   caught it. This needs fixing whatever is decided about sign-in.
2. **The split.** The site's try-it page (the templates and a quick demo) becomes its own thing, apart from the full web
   editors, where a person makes and keeps their games.
3. **Sign-in.** A person signs in, and their work follows them from device to device.

This is stage 1 (audit) of the pipeline for a new area. It was made on two heads of the open stack: the site at PR #521
(branch `claude/project-thread-k1ftgu`, head `5fd3933c`), and the editors at PR #522 (branch
`claude/project-thread-fxu792`, head `5cf0825b`). Like the apps audit (#511), it is filed against `main`, because a
docs-only branch cannot sit on both heads. File and line references under `packages/` and `extensions/` are at the
editors head, and those under `site/` are at the site head.

What it builds on:
- **Every editor is free on the web, and the apps sell the download.** The Owner, 21:25: "all editors are free on Web,
  you only have to pay to download". Apps audit #511, section 4.
- **The paid apps sync with GitHub through a GitHub App.** Apps spec #525, section 8.
- **Another thread is making the full set of editors the default on the web and on the try-it page.** This is
  "Show every editor in the free web editor". It is fixing finding P1 and finding P2 now.
- **Launch waits for Pixi 3D to be public.** The site's host is to be Cloudflare Pages (site audit #477, D3).

## 1. The answer

**What happens to a person's work today:**

| Where | What a person does | What happens | Proof |
| --- | --- | --- | --- |
| The every-editor page with no game behind it (what the try-it is becoming) | Changes a Writer line, reloads | **Lost.** The old line is back | Section 2, step 3 |
| The same page | Presses New level | Fails: "This row can't be opened: there is no such file", in dark text on a dark panel | Section 2, step 4 |
| Today's 2D try-it (`/editor/app/` on the site) | Makes a level, places three coins, reloads, closes the browser and comes back | **Kept**, in Chromium. But the site says the opposite: "Your level stays in this page and is gone when you close it" | Section 2, step 2 |
| `automata editor` on a real game | Places three coins, changes the keeper's line, reloads, plays | Kept on disk, and both show in play | Section 2, step 5 |

**Why no one caught it.**
- The requirement said the try-it keeps nothing ("Nothing is kept there: Share is how a level leaves", the site's
  try-it test). So the audits checked the try-it against "not kept".
- Every make-and-play check ran on a real game folder, where saving works.
- The one reload test checks that a new level is still listed. It never checks an edit, and it only covers the 2D page.
- The site's fix of 16:21 today measured localStorage, IndexedDB and the cache, but not the browser's private file
  storage (OPFS), where the try-it keeps the level. It concluded "the level is gone" and changed the Editor page and
  Privacy to say so (commit `de5712e9`).

**Recommendation.**
1. **Save on the device first, always, and say so.** Every web edit is written to the browser's private storage the
   moment it is made, with or without sign-in. The page asks the browser to keep that storage, and says in words where
   the work is: "Saved on this device". When a browser can't keep anything, the page says so and offers "Save a copy".
   This is the bug fix, and it is also what the sync is built on.
2. **Split the try-it from the editors.** The try-it becomes a page of the site, `/try`. It shows the templates, each
   playing in a small window, with one button each: "Make this game". The editors become the place your games live:
   "Your games", open on the game you had open last. The Owner's rule that templates live only on the try-it
   (2026-11-06) holds: the editors' "Start a new game" goes to `/try`.
3. **Sign in with GitHub, and keep each game in the person's own repository.** The web uses the same "Automata" GitHub
   App as the downloads, and the same game files, so a game made on the web opens in the app and in Claude Code. The web
   needs one small sign-in step on the site's own host that stores nothing (section 6.3). There is no account database
   and no store of people's games. Don't build Automata accounts now (option B), unless the Owner wants people with no
   GitHub account to sync. In that case it is a service to run, with legal duties (section 5).

**Decisions only the Owner can make:** how people sign in (D1), and whether the web gets sync free or it stays a reason
to buy the app (D2). See section 7.

## 2. What was done by hand

All of this ran in a cloud container: Node 24.22.1, Chromium from Playwright, each page built from its branch and
served by a small static server that answers `/api/ping` the way the site does ("not an editor server"). Screens are in
`/mnt/project-files/refactor/2026-11-08-sign-in-sync-audit-screens/`.

1. **Built:** `turbo run build` for `@automata/editor` (site head) and for `@automata/editors` and `@automata/tools`
   (editors head). All exited 0.
2. **Today's 2D try-it.** This is the page the site copies to `/editor/app/` (`packages/editor/dist/suite`).
   - New level, Platformer: OPFS held `sample-game/content/levels/untitled-platformer.af2d.json`, 56,414 bytes.
   - Three coins placed with the brush: within a second the file was 56,909 bytes, and the coin count went from 2 to 5.
   - Reload: Home listed "Untitled platformer". Opening it showed the three coins (`tryit-2d-2-after-reload-kept.png`).
   - Closing the browser and opening it again with the same profile: the file was still 56,909 bytes with 5 coins.
   - Seen on the way:
     - The reload lands on Home, not on the level.
     - Nothing on the page ever says "Saved".
     - The banner still says "This is a sample game, not yours."
3. **The every-editor page with no server.** `extensions/editors/dist/suite`, the page the try-it is about to serve.
   - Writer, Shop, first line changed to "Welcome, grandma. Saved?" and left for 3 s (`every-editor-1-line-edited.png`).
   - OPFS then held only the 2D sample's two files (`sample-game/content/tuning.toml`, `content/editors.toml`), and
     nothing of the content sample.
   - Reload, Writer, Shop: the line read "Welcome in. Mind the step." again (`every-editor-2-after-reload-lost.png`).
4. **New level on that page** showed "This row can't be opened: there is no such file. Your file is unchanged." in dark
   grey on the dark canvas panel, with no way out but Home (`every-editor-3-new-level-fails.png`).
5. **A small game made in the editors and played.** This used `automata create-game` (packages linked from Emberwick's
   install, as the journeys' `newGame` does), then `automata editor` on it, which served the every-editor page with
   "Saved in your game folder".
   - Levels, Start: three coins placed. The coin count in `start.af2d.json` went from 2 to 5, and `start.toml` gained
     3 (`served-1-three-coins.png`).
   - Writer: the keeper's first line changed from "Hello there. Mind the gate on your way out." to "Hello grandma, this
     was saved." It was written to `content/lines/keeper.toml` and to the generated content.
   - Reload: the line was still the new one.
   - Play, then the game's Play button: the three coins were drawn where they were placed (`served-2-coins-in-play.png`).
   - The right arrow walked the player to the keeper, whose box said "Hello grandma, this was saved."
     (`served-3-edited-line-in-play.png`).
   - **Made in the editors, kept through a reload, and seen in play.**
6. **GitHub's CORS was not checked again here.** This container's proxy refuses `api.github.com`. The facts used are
   GitHub's documentation (the REST API answers cross-origin requests from any origin) and the apps audit's check (the
   sign-in endpoints and the git endpoints send no CORS headers).

## 3. What exists today

| Piece | State | Where |
| --- | --- | --- |
| The try-it | `/editor/app/` is the editors' own 2D page (Levels 2D, Tuner) on a "Sample game". With no editor server it keeps the sample in OPFS, in the folder `sample-game`. The templates (Platformer, Top-down, Blank) show only here. Share sends a level out as a file. It can't Play (R8) | `packages/editor/src/app/suite/main.ts:35`, `open-suite-ports.ts:52`, `site/scripts/build-demos.ts` |
| The Editor page | `/editor`: two pictures, "Try the editor", "Get the app", and the command for your own game | `site/src/features/editor/EditorPage.svelte` |
| The every-editor page | Every editor. With no server it opens the content sample in memory (P1) | `extensions/editors/src/app/suite/open-content-suite.ts:9` |
| A game on the web | None. One sample, one name, no list of games, no new game, no Play, no Publish | |
| Storage in the editors | One port, `ProjectStore`. Five adapters: memory, OPFS, a picked folder, download, and HTTP to `automata editor`. A write probe decides between OPFS and memory | `packages/editor/src/shared/kit/storage/` |
| Keeping storage | No call to `navigator.storage.persist()` anywhere | |
| Saying where work is | The top bar's "Saved in your game folder" only on a served game, and not on a phone or narrow screen (`saved={!sample && !compact}`) | `Suite.svelte:232`, `SuiteTopBar.svelte:89` |
| The site's server | None. SvelteKit `adapter-static`; `/api/ping` is a prerendered file | `site/svelte.config.js:1`, `site/src/routes/api/ping/+server.ts` |
| The try-it's policy | `connect-src 'self'`: the page may talk to the site only | `site/src/shared/html/security-headers.ts:26` |
| Privacy | "No cookies", "No requests to other sites", "No accounts or forms" | `site/src/features/legal/Privacy.svelte:12` to `:14` |
| GitHub | None in the code. The apps spec designs sync for the downloads only: a GitHub App "Automata", device flow, isomorphic-git, tokens in the system keychain | apps spec #525, section 8 |
| A browser-side game compile | The site playground (one file, sucrase). The apps spec plans a whole-game player for phones: a prebuilt runtime, sucrase and a pure content compile | `site/src/features/playground/compile.ts`; apps spec section 7 |
| Players' saves in games | The web host keeps them in the game frame's `localStorage`. Not in this audit | `packages/automata/src/features/targets/web/hosting-web.ts` |

## 4. Findings

### High

**P1. The every-editor page keeps nothing when no server answers, and the try-it is about to become that page.**
Here is how it happens:
- `openSuitePorts` opens the OPFS store and loads the 2D sample into it.
- `openContentSuite` then throws those ports away. It calls `samplePorts(CONTENT_SAMPLE_GAME)` with no store, so the
  content sample sits in a fresh memory store (`open-content-suite.ts:9`).
- The file's own comment says "the content sample held in memory", and `main.ts:27` says the same.

Measured in section 2, step 3: a Writer edit is gone after a reload. The shared-editors plan (#509 S4, S10), the apps
spec (section 3) and the "Show every editor" thread all put this page on the try-it, so the try-it would start losing
work the day that lands.

*Direction:* hand the content sample to `openSuitePorts` as its `sample`, so it lands in OPFS like the 2D sample.
**Being fixed now** in "Show every editor in the free web editor" (told 21:48, with the test below).

**P2. "New level" fails on the every-editor page with no server.** The try-it's first button fails with "This row can't
be opened: there is no such file", in dark grey on the dark panel (section 2, step 4). The content sample's
`editors.toml` has no Levels 2D row, and `extensions/editors/src/app/suite/main.ts:37` gives `createLevels2d` no
`templates`. The 2D page gives it `templates: sample ? 'content/levels' : undefined` (`packages/editor/src/app/suite/main.ts:35`).

*Direction:* being fixed in the same thread (rows for Levels 2D, Levels 3D and the Studio). The message colour belongs
to the editors v2 build.

**P3. The site says the try-it loses your work, and in Chromium it doesn't.** Three places say so:
- `EditorPage.svelte:32`: "Your level stays in this page and is gone when you close it."
- `Privacy.svelte:15`: "they are gone when you close or reload it".
- `site/tests/e2e/editor-try.e2e.ts:9`: "Nothing is kept there".

The test's comment dates from `ad389beb` (04:19), before the sample moved to OPFS in `d63274de` (04:46). Commit
`de5712e9` (16:21) wrote the other two after measuring localStorage, IndexedDB and the cache, which are the wrong
places. Meanwhile the editors' own journey asserts the opposite: "the
level a visitor made is still there after a reload, kept in this browser" (`share-leaves-the-browser.test.ts:58`). Two
suites, both green, disagree.

*Direction:* the site's words follow what the page does, and one test on the built site proves it (P4). With section
6.2 the words become "Saved on this device".

**P4. No test makes an edit, reloads, and checks the edit; and the audits' make-and-play rule never leaves a game
folder.** This is why the bug was missed:
- The one reload test (`share-leaves-the-browser.test.ts:58`) checks that a new level is listed after a reload, on the
  2D page only.
- No test covers the every-editor page's sample.
- No test opens the browser again.
- Every audit's "make a small game and play it" ran under `automata editor`, where files are on disk.

*Direction:* section 6.5 lists the tests. The audit rule in project memory gains one line: "and reload, and open the
browser again, on every page a person can edit in, the try-it included".

**P5. On the web there is no "your game".** The try-it opens one "Sample game" that can't be renamed. Its banner says
"This is a sample game, not yours. Run automata editor inside your game's folder to edit it." There is no list of
games, no second game and no Play. A person who comes back finds Home, not their level. So "separating the try-it from
the editors" means building the editors' web home, not just moving a link.

*Direction:* section 6.1. The web editors open on "Your games". Play on the web uses the player the apps spec already
plans for phones (section 7 of #525). Build it once, where both the app and the web page can import it.

### Medium

**P6. A browser that refuses the write probe keeps the sample in memory, and the page says nothing.** `openPrivateStores`
returns `persistent: false` with a reason. `openSuitePorts` keeps only `.stores`, falls back to `createMemoryStore()`,
and drops the reason (`open-suite-ports.ts:52`). Old Safari private windows refuse writes this way (`workspace.ts`'s
own comment). The kit already has the words, "Not saved on this device" (`project-browse.ts:163`,
`StatusLine.svelte:24`), but the suite never shows them. This breaks AGENTS.md: a missing capability fails and says so.

*Direction:* pass `persistent` and `reason` through `OpenedSuitePorts`, and the top bar says "Not saved on this device.
Save a copy to keep your work."

**P7. The browser may clear the work, and the page never asks it not to.** Nothing calls `navigator.storage.persist()`.
- Chromium grants persistence silently to a site a person uses often or has installed. Otherwise it may evict the
  site's storage when the disk is short.
- Firefox asks the person.
- Safari deletes a site's script-writable storage after seven days of browsing with no visit to the site (WebKit,
  "Full Third-Party Cookie Blocking and More", 2020). Home Screen web apps are exempt. Whether OPFS counts, and whether
  `persist()` exempts a site in Safari today, was not checked here (no Safari).

*Direction:* ask once, at the first edit of a game. Never trust the answer alone: with sync on, GitHub is the copy that
lasts. Signed out, the person is told in plain words where the game is kept, with "Save a copy".

**P8. The editors don't tell a person their work is saved.**
- The try-it never says "Saved".
- On a phone or narrow screen, even a served game never says it: `Suite.svelte:232` passes
  `saved={!sample && !compact}`.
- After a reload the try-it opens on Home with no mention of the level.

Ask "did it save?" and the page has no answer, so it fails the drunk grandma test.

*Direction:* one short line, shown at every size: "Saved on this device", "Saved on this device and on GitHub", or "Not
saved: …". The web editors reopen the game that was open, on the editor that was open.

**P9. Sign-in needs four things the site doesn't have.**
- **Server code.** The site is `adapter-static`; GitHub's sign-in step needs a secret, so it can't run in the page.
- **A policy that lets the editors reach GitHub.** Today it is `connect-src 'self'`.
- **One cookie.** Today Privacy says "No cookies".
- **New Privacy and Terms words.** Today: "No accounts or forms" and "No requests to other sites".

*Direction:* section 6.3. One Cloudflare Pages Function (three routes), `connect-src 'self' https://api.github.com` on
the editors only, and one cookie that sign-in needs. The words are the Owner's to approve (section 8).

**P10. The apps spec says a web page can't sync with GitHub; that is true of git, not of GitHub's API.**
- The apps audit (section 4) and the apps spec (section 3) put sync in the downloads "for a technical reason":
  "a web page cannot reach GitHub's git or device sign-in: no CORS headers".
- That is right for `github.com`'s git endpoints and for the device flow.
- But GitHub's REST API answers cross-origin requests from any origin (GitHub docs, "Using CORS and JSONP"). Its Git
  Data endpoints can read a game's files and write a commit of many files at once.
- A web page can sync once it has a token. Getting the token takes the web sign-in flow, whose code exchange needs the
  app's client secret, so it has to run on a server.

So the web can sync with one small server step that stores nothing. Whether it should is D2, because sync is in the
apps' list of what the download adds (`site/src/features/app/app-offer.ts:52`, "Sync with GitHub").

### Low

**P11. `/app`'s lists predate the Owner's 21:25 decision.** `app-offer.ts` still lists "Levels for 3D games…", "Feel and
Audio" and "Schematic" as things the app adds. Every editor is free on the web now. The file's own comment says it
follows "option A until answered", and that question is now answered. The apps pipeline owns this file (apps audit
memory), so it is noted here, not fixed.

**P12. Two samples share one folder.** The 2D page and the every-editor page both keep their sample in OPFS
`sample-game`. `samplePorts` always rewrites `editors.toml` and keeps every other file a visitor already has. A visitor
who used the old 2D try-it and then gets the every-editor try-it has old 2D files mixed into the content sample. This
is told to the "Show every editor" thread. With section 6.1 each game gets its own folder, `games/<id>/`, and the
sample folder goes away.

**P13. The sample's words fit a throwaway, not a kept game.** "Sample game" and "This is a sample game, not yours" are
true of a demo. Once the work is kept, they tell a person that what they made isn't theirs. Section 6.6 has the words.

## 5. Three ways to keep a person's work

| | A. Sign in with GitHub; each game is a repository of the person's | B. Automata accounts; games kept on our servers | C. No sign-in; this device only |
| --- | --- | --- | --- |
| What a person does | Clicks "Sign in with GitHub". Makes a free GitHub account if they have none. Lets Automata reach their games' repositories | Signs in with an email link, a passkey, or Apple or Google | Nothing. Moves a game by "Save a copy" and "Open a copy" |
| Syncs across devices | Yes | Yes | No |
| Drunk grandma test | Passes for anyone with GitHub. For someone without, it means a GitHub sign-up and GitHub's "choose repositories" screen | Passes best | Passes, but the work is stuck on one browser |
| Who can use it | GitHub's terms: 13 and over | Ours to choose. Under 13 in the US means parental consent (COPPA); in the EU, 13 to 16 by country (GDPR article 8) | Anyone |
| What we store | Nothing. The sign-in step sees a code and a token in passing; the refresh token sits in a sealed cookie on the person's own browser | People's emails, games, pictures and sounds | Nothing |
| Legal duties | A Privacy line about the GitHub sign-in and one cookie. GitHub is the person's own processor, not ours | We control personal data: a lawful basis, export (GDPR article 20), deletion (article 17), breach notice within 72 hours (article 33), processor agreements (article 28), and EU transfers. The apps must offer account deletion inside the app (Apple 5.1.1(v)). Sign-in with Google means also offering Sign in with Apple (4.8). Hosting uploaded pictures brings abuse reports | None |
| Money | $0 at our size. The step is three Cloudflare Pages Function routes, and the free plan allows 100,000 requests a day. GitHub allows 5,000 API requests an hour per signed-in person | About $5 a month to start (Workers Paid; R2 storage at $0.015 per GB-month after 10 GB free), plus email for sign-in links. The money is small; the duties are not | $0 |
| Running it | One secret to keep (the GitHub App's client secret) | A service to keep up: backups, security, abuse, support email | Nothing |
| Claude Code can edit the game | Yes: it is a repository, and the apps' Review page works on it | No, unless we also copy games to GitHub, which brings back A | No |
| Reuses the apps' work | Yes: the same GitHub App, the same game files, the same merge rules (apps spec section 8) | No: a second sync system beside the apps' GitHub sync | Yes: the device storage the apps also need |
| Work to build | Medium: sign-in, the REST sync, the games list | Large: accounts, storage, sync, account pages, legal pages | Small: the bug fix and section 6.2 |

**Why A.**
- It is the only option that meets the ask without making the Owner run a service that holds people's work.
- It uses the same GitHub App and the same files as the downloads, so a game moves between the web, the app and Claude
  Code with nothing to convert.
- It keeps the Owner's line of "no relay, ever" (21:29) and "pay to download, not a hosted service" (apps audit,
  section 4).

Its cost is the GitHub sign-up for people who don't have an account. The editors' audience is people making a game with
a framework on GitHub, so most will have one.

**C is not an alternative to A. It is the floor under it.** It is the bug fix, and it is how the web works signed out
and offline.

**B is worth building only if the Owner wants people with no GitHub account to sync.** Then it should come later, as
its own area, with a privacy review before any code.

**A's choice inside A.** A GitHub App, as the apps chose, over an OAuth App:
- **GitHub App:** its token reaches only the repositories the person lets it in to, with only the permissions it asks
  for. But a GitHub App can't make a repository in a person's own account. The apps spec opens `github.com/new` instead,
  and the web does the same. People have reported the API refusing it (GitHub community discussion 172926), and asking
  for Administration permission would ask for far more than sync needs.
- **OAuth App with the `repo` scope:** one click, and it can make the repository. But GitHub's consent screen asks for
  "full control of private repositories": every private repository the person has. That is too much to ask for a game.

## 6. Designs for the plan

### 6.1 The split

| Address | What it is | Who uses it |
| --- | --- | --- |
| `/try` (a site page) | Each template, with its picture, one line and a small window playing it (built at site build time, framed like Home's demo). One button each: **Make this game**. 3D templates join when Pixi 3D is public | Anyone, nothing to install, nothing to sign in |
| `/editor/app/` (the editors, every editor) | **Your games**: the games on this device and, when signed in, on GitHub. It opens on the game that was open last, on the editor that was open. **Start a new game** goes to `/try`. **Sign in with GitHub** is at the top (if D1 is A) | A person making their game |
| `/editor` (a site page) | What the editors do, the app, and the command for a game on your computer. Its button becomes "Open the editors" | Anyone reading |
| `automata editor` on a folder | Unchanged: the folder is the game. No games list and no sign-in (the folder is already in the person's own git) | A person with a game on their computer |

- **The handover.** "Make this game" writes the template's files into a new folder `games/<id>/` in OPFS, then opens
  `/editor/app/?game=<id>`. Both pages are on the site's own origin, so they share OPFS with nothing in between.
- **A web game is a real game.** It holds the same files `create-game` writes. That needs `create-game`'s templates as
  plain data a page can read, which the phone app also needs to start a game. So plan it once.
- **One page.** The editors stay the one page `automata editor` serves. With no server answering, `openSuitePorts`
  opens the web workspace (Your games) instead of a sample. That is the seam that already exists.
- **Play on the web.** Play arrives with the in-page player (P5). Until it does, Play says why, as the try-it's note does
  today.

### 6.2 Saving on the device (all of it is needed for any choice in D1)

1. Each game is a folder, `games/<id>/`, in OPFS. A small index (`games.json`) keeps each game's name, when it was last
   changed, and where it syncs to.
2. Every write goes to OPFS when it is made, as today. The line says "Saved on this device".
3. At the first edit of a game, the page calls `navigator.storage.persist()` once (P7).
4. If the write probe fails, the line says "Not saved: this browser can't keep files", and **Save a copy** is the main
   button (P6). The try-it never pretends.
5. **Save a copy** downloads the game as a `.zip` (the files as they are, not a build). **Open a copy** takes one back.
   This moves a game between browsers without sign-in.
6. The page remembers the open game and editor, so a reload or a new visit opens where the person left off (P8).

### 6.3 Signing in (if D1 is A)

**The GitHub App.** It is the same "Automata" app as the downloads (apps spec section 8), with its callback URL turned on
next to its device flow. The permissions are the apps spec's: Contents (read and write), Metadata (read), Pull requests
(read and write), Checks (read), Commit statuses (read).

**The steps.**
1. The editors call `/api/github/start`. It sends the person to GitHub's authorize page, with `state` and a PKCE
   challenge. GitHub supports PKCE since July 2025.
2. GitHub sends the person back to `/api/github/callback`. The function exchanges the code for a user access token and
   a refresh token, using the app's client secret. That secret is a Cloudflare secret and never in the code.
3. The function sets one cookie and returns the access token to the page.
   - The cookie holds the refresh token, sealed with a key the function holds.
   - The cookie is `HttpOnly`, `Secure`, `SameSite=Strict`, with `Path=/api/github/`.
   - The page keeps the access token in memory only (it lasts 8 hours).
4. `/api/github/token` swaps the cookie for a fresh access token when the old one runs out. Refreshing a web-flow token
   needs the client secret too, so this step also runs on the function.
5. `/api/github/sign-out` clears the cookie.

**The function stores nothing.** There is no database. GitHub's tokens pass through it and live in the person's own
browser.

**The site changes.**
- The editors' policy gains `connect-src https://api.github.com`, and nothing else.
- No GitHub script runs on the page.
- The token is never in `localStorage`.

**Which repositories.** After signing in, GitHub's install page asks which repositories Automata may reach, as the apps
spec says: "Choose which games Automata may sync".

**A new game on GitHub.** The page opens `github.com/new?name=<game>&visibility=private` and waits: "Make an empty place
for your game on GitHub, then come back". It pushes when the person comes back.

**Your games, signed in.** The page lists the repositories the app reaches that have `content/editors.toml`, next to the
games on this device. Opening one that isn't on this device downloads it into OPFS first.

**Signing out** keeps the games on the device, because they are the person's. On a shared computer, "Sign out and
remove my games from this browser" clears them too.

### 6.4 Sync on the web

GitHub's REST API, not git.
- A web page can't reach `github.com`'s git endpoints. isomorphic-git in a page would need a proxy that carries people's
  repositories through our server.
- **Pull.** Get the branch's commit. Use a conditional request: GitHub doesn't count a 304 against the rate limit. Then
  get the tree (recursive), then the blobs that changed.
- **Push.** Create blobs, a tree on the base tree, a commit, then move the branch, fast-forward only.
  - The timing is the apps': 10 s after the last save, one commit per batch ("Edited in Automata: Feel, Levels
    (Start)").
  - If GitHub refuses the move (someone else pushed), pull and merge, then push again.
- **Merging.** The base of a merge is the last synced commit, kept in the game's folder in OPFS (`.automata/sync.json`).
  The merge rules are the apps' eight (apps audit section 7, apps spec section 8):
  - TOML and JSON are merged by key.
  - Generated files are made again.
  - Pictures and sounds are chosen whole.
  - When an overlap is left, the person chooses ("Keep mine", "Keep GitHub's", "Keep both").
  - Never a force-push.
- **One set of rules, two transports.** The merge rules and "what changed where" are one module, used by the apps
  (isomorphic-git) and the web (REST). The plan decides where it lives; it can't be inside `apps/editor`, or the web
  can't import it.
- **When.** Pull when a game opens, when the tab comes back to the front, and every 60 s while it is open.
- **Offline.** Commits wait, and the line says "Saved on this device. Not on GitHub yet: no internet."
- **Review on the web.** The Review page (Claude's changes waiting for a yes) needs "Play it" on a branch, so it needs
  the in-page player. It follows D2: if the web gets sync, Review comes to the web once the player exists.

### 6.5 Tests that would have caught this

1. **A journey for each page a person can edit in, without a server:** the 2D page, the every-editor page, and later
   the web editors.
   - Make an edit (a coin, and a Writer line), reload, and check the edit.
   - Then close the browser context, open a new persistent one, and check it again.
   - Run it in Chromium and in WebKit (the `editor-ipad-webkit` project exists).
2. **Unit tests:**
   - `openContentSuite` writes its sample into the store it is given.
   - `openSuitePorts` reports `persistent: false` with the reason.
   - The top bar shows the saved line when it is compact.
3. **A site test on the built site.** Make a level on `/editor/app/`, reload, and check that it is still there. Then read
   the Editor page and Privacy, and check their words say the same thing as what happened.
4. **When sign-in exists:**
   - A sync test against a fake GitHub (the REST calls answered from a fixture, as the editors' fake HTTP store does).
   - Two pages edit the same game: one changes the flash and the other the shake, both push, and both edits are there.
5. **The audit rule** (project memory): every audit's make-and-play check also reloads and reopens, on the try-it too.

### 6.6 Words (the drunk grandma test)

- **The try-it.** "Try it". "Pick a game to start from." "Platformer: jump between platforms and pick up coins." "Make
  this game." "Nothing to install. Your game is saved in this browser."
- **The editors' home.** "Your games". "Start a new game". Each game shows its name, "Changed 5 minutes ago", and "On
  this device" or "On this device and GitHub".
- **Signing in.** "Keep your games on all your devices", then "Sign in with GitHub (free)". Under it: "Your games are
  kept in your own GitHub account. Automata keeps nothing."
- **The saved line.**
  - "Saved on this device"
  - "Saved on this device and on GitHub"
  - "Saved on this device. Not on GitHub yet: no internet."
  - "Not saved: this browser can't keep files. Save a copy to keep your work."
- **Signing out.** "Sign out". "Your games stay on this device." "Sign out and remove my games from this browser".
- **Gone.** "Sample game" and "This is a sample game, not yours." (P13).

## 7. Decisions only the Owner can make

**D1. How do people sign in?**
- **A. With GitHub; each game in their own repository (recommended).** No account database. It is the same GitHub App
  as the downloads, and Claude Code can edit the game. People without GitHub must make a free account.
- **B. Automata accounts (email, Apple or Google), with games on our servers.** Easiest for anyone. But the Owner runs a
  service that holds people's work: GDPR duties, account deletion in the apps, Sign in with Apple if Google is offered,
  and about $5 a month to start.
- **C. No sign-in.** Each browser keeps its own games; a game moves by file. This doesn't meet the ask.

Whichever is chosen, section 6.2 is built first, because it is the bug fix.

**D2. Does the web get GitHub sync free, or does sync stay a reason to buy the app?**
- **Free on the web (recommended).** The Owner asked for sign-in that syncs, and every editor is already free on the
  web. The download still sells:
  - one install on a computer with nothing else needed;
  - Publish, which builds the game to upload and needs a computer (the web has no Publish);
  - the phone and tablet app;
  - MCP.
  The site's `/app` list drops "Sync with GitHub".
- **Only in the app.** The web keeps each game on the device (section 6.2) and offers the app for sync. This keeps the
  apps' list as it is, but it doesn't meet the ask on the web.

## 8. The Owner's steps

These are only needed if D1 is A:
- [ ] In the "Automata" GitHub App's settings (registered for the apps), add the callback URL
      `https://automataframework.com/api/github/callback`, and keep "Expire user authorization tokens" on.
- [ ] Generate the app's client secret, and put it in Cloudflare Pages as a secret, with the key that seals the cookie.
      It is never written anywhere else.
- [ ] Approve the new Privacy and Terms words: the GitHub sign-in, the one cookie it needs, and "Automata keeps nothing".

These are already on the Owner's list: register `automataframework.com`, and set up the site's host as Cloudflare Pages.
The sign-in function needs that host.

## 9. Not run

- Safari, iOS WebKit and Firefox. There are no such browsers in this container. The editors' journeys run
  `editor-ipad-webkit` on the runners.
- A real GitHub App, a real sign-in, and any request to `api.github.com` (refused by this container's proxy).
- The site's own e2e suite. The pages were built and served by hand, as in section 2.
- `pnpm check`. This stage adds documents only.

## Sources

Checked 2026-11-08:
- GitHub REST, [Using CORS and JSONP](https://docs.github.com/en/rest/using-the-rest-api/using-cors-and-jsonp-to-make-cross-origin-requests).
- GitHub, [generating a user access token for a GitHub App](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app).
- GitHub, [PKCE support for OAuth and GitHub App authentication](https://github.blog/changelog/2025-07-14-pkce-support-for-oauth-and-github-app-authentication/).
- GitHub [community discussion 172926](https://github.com/orgs/community/discussions/172926) (a GitHub App making a repository in a personal account).
- Cloudflare [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/) and [R2 pricing](https://developers.cloudflare.com/r2/pricing/).
- WebKit, [Full Third-Party Cookie Blocking and More](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/) (the seven-day cap on script-writable storage).
- MDN, [origin private file system](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system).
- Apple [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) (4.8, 5.1.1(v)).
- The apps audit (#511, sections 4 and 7) and the apps spec (#525, sections 3, 7 and 8).
