# APP: the editor suite as paid mobile apps; Plus becomes free

**Status:** draft for review, 2026-10-30. It amends the [PRODUCT spec](2026-10-16-product-core-and-plus-design.md) (PD-1, §6) and the business model in [00 Overview](../../00-overview.md). It is accepted once its review is done, under the Owner's "Auto accept all spec and plans" (2026-10-30). Every agent default below stays open to the Owner's veto.

## 0. The Owner's words (2026-10-30, coordinator session)

> "I kinda want to change our plans for paid - we'll make the editor suite paid for iOS and Android instead as apps; priced like nomad sculp"

The Owner then chose three options from the coordinator's questions, each one the recommended option:
- **Plus becomes free.** The extensions go open alongside core, so the only paid thing is the editor apps.
- **Web and desktop free, mobile paid.** `automata editor` stays free in the browser on desktop; the iPad and phone apps are the paid product.
- **One-time purchase.** Pay once per platform with updates included, as Nomad Sculpt does. The exact price stays the Owner's to set (D-7 stays a placeholder).

Later the same day:

> We need to be able to push to git; our biggest priorities for the editors are tablet ready, cloud collaboration, and designed for non-game devs to be able to work with it (a student filmmaker can hop in and make cutscenes even though they're no developer)

The Owner then chose two options from the coordinator's follow-up questions, each one the recommended option:
- **Cloud collaboration is git-backed and async first.** GitHub is the cloud: each person edits on their own branch, Ship pushes and opens a PR, and others pull. Real-time co-editing can come later.
- **GitHub sign-in.** The editors push with a "Sign in with GitHub" device flow over HTTPS. A non-developer never sees git, only Ship and Get latest.

## 1. The product after this change

| Part | Price | Form |
|---|---|---|
| Core | Free | MIT, as today |
| Extensions, kits, starters and agent packs (formerly Automata Plus) | Free | Packages and copy-in source, published like core |
| Editor suite on the web and desktop (`automata editor`, ED2D.9 and EDS.1d) | Free | A CLI command that serves the editors against a game checkout |
| Editor suite on iOS and Android | **Paid once per platform** | Store apps that wrap the same editors |

Nothing paid ever runs inside a game. A game built with the apps is the same game built with the free web editor.

## 2. Scope

**In scope:**
- Making Plus free (§3).
- The mobile app shell (§4).
- What the apps do differently from the web editor (§5).
- The store and release flow up to the Owner's gates (§6).

**Out of scope:**
- The editors themselves. They stay in the ED, EDFF and EDS rows, unchanged; the apps add no editor features.
- Pricing figures, the store listing copy, the licence text and any money flow. These are the Owner's.

## 3. Plus becomes free

Agent defaults, open to the Owner's veto:
- **APP-D1, licence.** Plus packages take core's MIT licence. Licence text is the Owner's, so the switch happens only with the Owner's word on the text (Owner gate).
- **APP-D2, where Plus lives.** The `mcthaydt/automata-plus` repo stays a separate repo for now. Merging it into AF is not worth the churn before 1.0. Its packages publish on core's registry and release line rather than a private one.
  - Making the repo public is the Owner's action.
  - PRODUCT.5h (private registry and buyer smoke) and M8.9p (a Plus release on its own line) are restated as a free publish.
- **APP-D3, `automata add`.** `automata add <kit>` keeps working, but reads a public source instead of the buyer's git credentials. Access-on-purchase is dropped.
- **APP-D4, the website.** M10.0's "store for paid extensions" becomes "links to the App Store and Google Play". The website gets no checkout of its own.
- **The core and extensions line is unchanged.** Extensions never edit core files, and core never imports an extension. Being free changes the price, not the architecture.

## 4. The app shell

**APP-D5, the wrapper:** Tauri 2, decided by a spike (APP.S1) before any build row.
- **Evidence for Tauri:** AutomataEngine-LegacyV2 (`18525fc`, `docs/measurements/2026-08-17-tauri-android.md`) built a Tauri 2 Android app, installed it on a Galaxy S25 and passed seven of eight functional checks there. The same toolchain also covers desktop.
- **The alternative:** Capacitor, which is more widely used on iOS.
- **What the spike measures on both:**
  - the editors' bundle loading in the iOS and Android web views under Ruken's CSP rules (no `eval`);
  - Apple Pencil and touch input reaching the editors;
  - file access (§5);
  - the cold start time.
- **Fallback:** if Tauri fails a check that Capacitor passes, the spike records the evidence and Capacitor is used.

The shell holds no editor logic. It loads the built editor suite and provides the ports listed in §5.

## 5. What the apps do differently

The editors run on EDS.1's ports (EDS.1b holds the fakes and EDS.1d the Node adapters). On a phone or tablet there is no Node, git or `gh`, so the apps provide their own adapters for the same ports. They never fork the editors.

| Port | Web and desktop (EDS.1d) | iOS and Android apps |
|---|---|---|
| Workspace | Disk, with the allowlist from `editors.toml` | A project folder the user picks: Files on iOS, the Storage Access Framework on Android. The same allowlist applies. |
| Change set and Ship | A git branch per change, and Ship opens a draft PR | **The same, without a git CLI.** The app signs in with GitHub (device flow, token in the platform keychain) and uses a JavaScript git client over HTTPS (isomorphic-git, chosen in APP.S1) to branch, commit, push, pull and open the draft PR. (The Owner, 2026-10-30: "We need to be able to push to git"; APP-D6 is replaced.) |
| Checks runner | `automata check` and the game's own checks | The checks that run in the browser (content schemas, level checks). Checks that need Node are shown as "run on desktop", never faked as passing. |
| Ask | The developer's own Claude credentials | The user's own API key, held in the platform keychain. With no key, Ask is hidden, not broken. |
| Gates | Read only | Read only |

**Collaboration (git-backed, async):**
- Each person works on their own branch.
- "Get latest" pulls main into the branch. A conflict is shown in plain words, on the level or the shot, never as raw git markers. The user keeps theirs, takes theirs, or asks for help.
- Ship pushes and opens a draft PR, and the Review desk (EDS.2c) shows it.
- Real-time co-editing is a later milestone and is not planned here.

**Failure policy:**
- A denied folder permission shows the picker again. It never falls back to app-private storage without telling the user.
- A failed write keeps the edit in memory and says so.
- The app never claims a check passed that it did not run.

## 5b. Editor priorities (Owner, 2026-10-30)

These three apply to every editor row from now on (ED, EDFF and EDS), on the web and in the apps.

1. **Tablet ready.**
   - Every editor PR carries its WebKit iPad journeys and layout checks.
   - Pencil, touch and 44 px targets are tested from the first PR, not left to the polish rows (ED2D.8, EDS.10).
2. **Cloud collaboration, git-backed.**
   - GitHub sign-in, Ship and Get latest, as described in §5.
   - On desktop, the change set and Ship land in EDS.1d and EDS.2c. The app gets the same flow without a git CLI.
3. **For people who aren't developers.**
   - The editors use plain words: Ship, Get latest, Undo, Preview. Never branch, commit, merge or a file path, unless the user opens the details.
   - A first run guides a new user through making something small.
   - Errors say what to do next.
   - Cutscenes are the reference journey: a student filmmaker makes one with no code (APP-f). This puts the Sequence editor (EDS.8) and the `cutscenes` extension (M6.9a and M6.9b) on the priority path. Their Plus prerequisites (M6.4a, M6.5, M6.8a and M6.8c) are paused with the Plus lane. **APP-D9, decided by the Owner (2026-10-30): "Cutscenes should be in plus".** `cutscenes` and its prerequisites stay in automata-plus, so the filmmaker journey moves up when the Plus lane runs.

## 6. Store and release

- **APP-D7, one-time paid apps.** The apps are paid upfront in each store. There is no in-app purchase, no account and no licence server.
- **Owner gates:**
  - an Apple Developer account and a Google Play developer account;
  - signing identities;
  - the price per platform (D-7);
  - store listings, screenshots and privacy labels;
  - every real-device acceptance test.
- **CI:**
  - The iOS build runs on the Mac (af-mac), the only machine that can build it.
  - Android builds can run on Linux.
  - Release builds are signed only in a protected release environment that the Owner approves, like the npm publish today.

## 7. Order and the 1.0 launch

**APP-D8:** the apps are not part of the AF 1.0 launch.
- The launch still waits for GAME-3D, M9 and Pixi 3D's public release.
- The apps ship after EDS.11 (the editor suite on two games), on their own release.
- The free web editor ships with 1.0.

## 8. Acceptance cases

- **APP-a.** On an iPad and an Android tablet, the app opens a game project folder. It edits a level in the 2D level editor and a scene in the 3D one, writes the files, and the same project then passes `automata check` on a desktop. (Owner, on real devices.)
- **APP-b.** With the folder permission revoked, the app asks again and loses no edit.
- **APP-f.** A filmmaker with no git or code knowledge signs in with GitHub on an iPad, makes a cutscene in the Sequence editor, presses Ship, and the PR appears. A teammate on desktop presses Get latest and sees the cutscene. (Owner, on real devices.)
- **APP-g.** Two people change the same level on different branches. Get latest shows the conflict in plain words, and neither change is lost.
- **APP-c.** With no API key, Ask is hidden. With a key, a proposed diff is checked before it is written (EDS.2b's rule).
- **APP-d.** A Plus package installs from the public registry with no credentials, and the buyer smoke test becomes a plain consumer smoke test.
- **APP-e.** The built app bundle passes the no-`eval` scan.

## 9. Tasks (rows in docs/02)

| Row | Work | Prerequisites |
|---|---|---|
| APP.0 | This spec, reviewed | — |
| APP.S1 | Tauri 2 against Capacitor spike on iOS and Android (§4) | ED2D.4c3b (a Pixi editor canvas to load) |
| APP.1 | The app shell: loads the built editor suite; iOS and Android builds in CI | APP.S1, EDS.2a |
| APP.2 | Mobile workspace, change history and export adapters (§5) | APP.1, EDS.1b |
| APP.3 | Ask with a keychain-held key; the checks that run in the browser | APP.2, EDS.2b |
| APP.4 | Signed release builds and the store submission flow (Owner gates) | APP.3, EDS.11 |
| APP.5 | Acceptance APP-a to APP-e (APP-a is the Owner's, on real devices) | APP.4 |
| COLLAB.1 | GitHub device-flow sign-in and a JavaScript git client behind the change-set port (branch, commit, push, pull, draft PR), shared by the web editor and the apps | EDS.1b, EDS.1d |
| COLLAB.2 | Get latest, and the plain-words conflict view (APP-g) | COLLAB.1, EDS.2c |
| NDX.1 | Plain-words pass across the suite shell, first-run guide, error copy | EDS.2a |
| NDX.2 | The filmmaker journey (APP-f) as an end-to-end test on the WebKit iPad profile | EDS.8, COLLAB.1 |
| PLUS.FREE | Plus is free: licence switch (Owner's word on the text), public publish on core's line, `automata add` without credentials, PRODUCT.5h, M8.9p and M10.0 restated | APP.0 |
