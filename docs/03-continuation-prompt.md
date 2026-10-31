# AutomataFramework: living continuation

> Updated 2026-10-31 ~08:00Z by the coordinator (session_01QYLU1iZKdmysJwC6Hc9Pn8). Source HEAD verified before this update: `5d9b46e` on `main`. Merged since 04:05Z: #305 EDS.2c-c, #301 ED2D.7a, #306 CI.MAIN1, #311 DIST.0/STANDALONE.0 (ADR 0006), #317 DIST.1 spec; website#26 WEB.PLAY.10, #27 WEB.PLAY.11, #28 DX.10a; plus#16 M7.5b, #17 (plus issue #14's races). Closed unmerged: #315 (the FloorFifty 2D profile was dropped). The earlier history of this line is in git.

## Prompt for the next agent

Work in the `mcthaydt/automata-framework` checkout. Read, in this order: `AGENTS.md`; [00 Overview](00-overview.md) with the [Ruken-first master spec](superpowers/specs/2026-10-11-automata-framework-ruken-first-design.md) and the [extraction map](superpowers/specs/2026-10-11-core-and-extensions-extraction-map.md); [01 Decomposition](01-decomposition.md); [02 Master delivery plan](02-master-delivery-plan.md), the only task list ("if it is not here, nobody builds it"); this file; [04 How we build](04-how-we-build.md). Then the task's milestone spec, its ADR and spike references, and its plan when one exists. The source repositories are read-only and the local clones are shallow, so record the commit you read: RukenApp `d0fa2fe`, SNEKPRTY/FloorFifty `677d456`, The Last Light (`mcthaydt/PixiJS3D_Experiment_001`) `92e6704`, and `mcthaydt/FigureBuilder` `a1f7246`.

**Owner direction.** 2026-10-11: AF is Ruken first; core comes from proven FloorFifty, The Last Light and Ruken code and everything else is an opt-in extension; PixiJS renders 2D and 3D; Effect runs outside the sim and the sim stays on Koota. 2026-10-16: a game publishes to Ruken or itch.io (ADR 0005); DX.0, PRODUCT.0, EX.0, QB.0 and PUB.0 are approved on their defaults; core is MIT on public npm and the extensions are Automata Plus. 2026-10-18: 2.5D is dropped. 2026-10-23: "3D ships 1.0", with procedural figures on an IK rig, Crow Country's angle on a 24 mm lens (25° down, 5 m back, turned freely), and the Ocarina-style base 3D game authored in the editors; "we launch when pixi 3D goes public". **2026-10-30:** plan to completion, the website included; the agent merges its own green PRs; there is no orchestrator; the eleven decisions below. The full direction note is in `AGENTS.md`. **2026-10-31:** "Let's not couple the automata framework so tightly to Ruken - that's just one of the many places we can distribute content to easily; we have tauri export, Ruken export, and itch export": `web`, `itch`, `ruken` and `tauri` are peer targets, all core and free, and AF owns its host contract ([ADR 0006](adr/0006-distribution-targets.md), DIST.0 to DIST.6; this supersedes "Ruken first" where Ruken's contracts won). AF is standalone: source-project names leave code, docs and the website, and provenance lives only in `docs/provenance/sources.md` (STANDALONE.0 to STANDALONE.3); the FloorFifty 2D profile is dropped ("Drop the profile"; the EDFF rows with it). "Reminder that everything is auto approved and accepted, do not wait on me to do any approvals": specs, plans, visual and copy acceptance, veto defaults and workflow changes no longer wait on the Owner (record the words where acceptance is recorded); credentials, money, real-device tests, release-environment publish approvals, branch deletions and licence text stay the Owner's.

**Lane rules (2026-10-30).**

- One task per branch and draft PR, each in its own git worktree under `/home/user/wt/<slug>` (`git -C <clone> worktree add /home/user/wt/<slug> -b <branch> origin/main`). Never touch another lane's worktree, a main checkout's working tree or a process you did not start; never `git stash`.
- The integration owner edits 02, 03, 00, 01 and `AGENTS.md`; a lane records its progress in its own plan under `docs/superpowers/plans/`, and a task without a plan starts with a commit of its TDD plan.
- Strict TDD in `packages/`, `tooling/`, `examples/` and `games/`. Before a push: `pnpm format` and `TURBO_FORCE=true pnpm check`; after an export or doc-comment change, `pnpm build`, `pnpm api-report --update`, `pnpm api-index` (and `pnpm cheatsheet` when it says stale) and `pnpm agent-skills --write`; a changeset only for a published package.
- Parity runs in this container: `export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-local` (Chromium, WebKit and Firefox are installed there). The container has 4 CPUs shared by the lanes, so run focused tests while iterating and one full run at the end. Since 2026-10-30 22:10Z the checks, the games' CI and the consumer smoke run on the Owner's PC (`owner-pc-wsl-af`, label `af-linux`, WSL2 Ubuntu; the repository variable `AF_LINUX_RUNNER` is `af-linux` again, it was `af-mac`); parity, the release jobs and the heavy GPU, visual, frame-budget and full e2e suites stay on the Owner's Macs (`af-mac`, `af-mac-2`).
- Merge when green: the agent merges its own PR with a merge commit once every check, parity included, is green on the head. Never tick an Owner gate (real devices, visual acceptance, the real itch.io push, the site deploy); ask the Owner in the session.

## Owner decisions of 2026-10-30

Given in this session's chat on 2026-10-30. The Owner's own words are quoted where they were short; 6 to 9 are the Owner's answers to the remaining-work map's questions.

1. **Merging.** "Merge" (PR #186), then "you can merge PR": the agent merges its own PRs once every check, parity included, is green on the head.
2. **Completion.** "pixi drops in 2 weeks, so proceed as if we can go to completion, I want everything done including website": plan to completion, the website included. The AF 1.0 launch waits for Pixi 3D's public release, about 2026-11-13.
3. **No orchestrator.** "no more orchestrator, we're only working on AF": no hub and no bus. Questions, device-test requests and acceptances go to the Owner in the session. Anything older that says to file on the bus is history.
4. **Pixi 3D.** "beta.2 is the latest, vendor it": `@pixi/3d` 0.1.0-beta.2 is vendored in `vendor/pixi-3d` (PR #188, merged `b7ef19d`).
5. **FigureBuilder.** "we also enhanced our proc characters, and created a new repo for that": `mcthaydt/FigureBuilder` (`a1f7246`) is the Owner's enhanced procedural character builder. M3.5, M3.6's reference clips and the Studio (EDS.9) extract from it; The Last Light keeps the rig, hold and library tests and every render, camera, light and fog source.
6. **Figure look.** 3D meshes on Endesga 64, built from FigureBuilder's body generator, garments, hair and motion (the approved M3 spec's reading); FigureBuilder's painter and DUEL swatches stay in FigureBuilder.
7. **Tiers.** `games/base-3d` is free and uses core only, like Emberwick: its rooms, keys, feel and cutscenes are game code. The M6 extensions are built in Plus. M9 promotes the 3D runtime pieces (controller, camera, figures) as free and the gameplay systems (combat, lock-on, items, dungeon pieces) as Plus.
8. **Other repositories.** AF-side only. Extractions record each source repository's commit and fix leaks during the rewrite in AF or Plus (M6.3 does not edit The Last Light); the M8 adoption slices are AF-side patches that the reference job applies at the pin (FloorFifty and The Last Light are not edited).
9. **Game server.** Staging evidence comes from a local VM or container; 1.0 ships the server package and deploy target with no production game server.
10. **ritmo-tools.** `@typeonce/ritmo-tools` (MIT, 0.19.1): "throw this in where it fits". The agent's placement: the pixel fixer and pixel lint in the asset build (`automata-content assets`, M5.6) and an `automata check` step on the Endesga 64 palette; sound recipes rendered to WAV at build for core sound (M5.3), edited by the Audio editor (EDS.5), with `audio-synth` deciding whether to adopt the format; music songs rendered at build for core music and `audio-stream` (M5.8); the agent skills and the `create-game` template add it as a dev dependency. It runs as a separate CLI and is never imported, because its Effect 4.1 does not meet AF's Effect 3.22. Rows ASSET.0 to ASSET.4 in 02.
11. **Owner-supplied inputs.** The Owner will supply `NPM_TOKEN`, site hosting and DNS, a Discord server and bot, and an itch.io account with `BUTLER_API_KEY`.

Later the same day, recorded in PR #192's merge (`89ff04d`): **"Publish from my Mac"**. The plan, version and publish jobs of `release-packages.yml` now run on the Mac runner label (`AF_RELEASE_RUNNER`, default `af-mac`) with no hosted fallback (CI.BILL in 02 is ticked).

Later the same day, in the session's chat:

- **"Did I mention I want the code editor thing that pixi has for the website? That click a button to see changes crap is useless"**: the live playground, WEB.PLAY.0 to .11 in 02 (website PR #14, the spec, approved with PLAY-D1 changed: examples run when the page opens and update live on every edit).
- **"Yes, MIT it"**: MIT for Ruken's `sdk`, `sdk-host`, `manifest` and `cli`, with the agent allowed to make the RukenApp change: RukenApp PR #396, waiting on the Owner's merge (PRODUCT.4r).
- **"Yes, fan out"**: one cloud session per lane (editors, 3D, Plus, website), with this session as the coordinator (lane map below).
- **"Yes, affected-only on PRs"**: a pull request's parity job runs only the suites `turbo --affected` selects (CI.PAR, PR #219); `main` and the nightly run every suite.
- **"That's too much effort, just use the Mac"** (on a second runner on a Windows PC under WSL): everything stays on the Mac. There is no `af-pc`, and `AF_LINUX_RUNNER` stays unset.
- **S7-Q1, answered in the session's question card:** "AF-owned shim". `@pixi/3d` 0.1.0-beta.2 throws on its first draw under `render-pixi/no-eval`, so render-pixi3d ships its own `no-eval` entry with the spike's shim, a test pins pixi's parser count and order, the bug goes to the Pixi 3D beta, and the shim leaves when a fixed release lands (M9.10). M3.4 onward is unblocked.
- **RukenApp #396, the same card:** "You merge it": a one-off merge with Ruken checks red that the licence change does not touch. Merged as RukenApp `e376a2d`; PRODUCT.4r's repack follows.
- **"Auto accept all spec and plans"**: a spec or plan is accepted once its review is done, and its veto-defaults stand (GL-D1 to D10, EDS.0's, #12's 15, #237's Decision 3, #238's exact round-trip, #242's OPFS versions). Recorded on GL.0 (#243), EDS.0 (#196) and GAME-3D.0 (#229) in 02.
- **"Auto approve all visual acceptance too"**: the agent records visual acceptance once a reviewer has opened the actual expected/actual/diff images and the PR explains every change. Unexplained golden or screenshot changes still block (never rebaseline to hide them), sim hash mismatches are still investigated, and real-device testing stays the Owner's. First use: #210's xx-long captures. The 3D lane asked the Owner to confirm this ruling to it directly and holds its visual ticks until then.
- **"You can do all 3 as well"**: (a) three lanes until the Mac's CI queue drains, so Plus and the website pause; (b) `consumer-smoke.yml` and `release-packages.yml` install Chromium (CI.CHR, #248, merged); (c) push access to RukenApp.
- **"let's make new replacement sessions every 2hrs"**: the coordinator hands off to a fresh session every two hours, with the handoff prompt, the PR subscriptions and the lane map.
- **EsperRedux layout, "make the restructure when it makes sense to"**: the GL spec (#243, merged) and GL.0 to GL.7 in 02.
- **The four open questions, answered at 13:25Z** ("1. Yes / 2. Yes / 4. No veto I think? / 3. On it"): (1) "Yes": website #17 adds `deploy.yml` (a dry run, no secrets, read-only, after ci on `main`) and one `ci.yml` comment line (merged as website `5b5b601`); (2) "Yes": 3D #250 adds a `base-3d` job to `ci.yml`, and any game's game-ci job has a standing OK; (4) "No veto I think?": ASSET-D1 to D4 stand; (3) "On it": the Owner confirms the visual-acceptance ruling to the 3D session directly.
- **"Apply all 4, no more subagents, do everything inline using opus medium"** (14:05Z, after the day's spend, about $1,000 for 47 merged AF PRs, was mostly lanes re-reading 500k to 600k-token contexts on every wake): (1) only the coordinator and one build lane (3D) run, and the editors, Plus and website lanes pause; (2) a lane rotates to a fresh session once its context passes about 200k tokens; (3) only the coordinator watches PRs and CI, and a lane sends it one "ready" line per PR; (4) at most about six AF PRs in flight. No subagents or workflows; reviews are inline; sessions work at medium effort.
- **Sessions go through the launcher ("Do 2", ~23:40Z).** Coordinators used to start successors and lanes as their own children, so each rotation went one level deeper; at depth 8 (the platform limit) `create_session`, `send_later` and `create_trigger` were refused and the lanes could not be replaced. The Owner started one **launcher** session, `session_01QYLU1fJPdbAybiTAWuSqLd` (depth 0). It creates every coordinator and lane, so all of them sit at depth 1. No session calls `create_session` itself: it sends the launcher `LAUNCH tag=<af-coordinator|af-lane-3d|af-lane-editors|af-lane-website|af-lane-plus> source=<repo url> title=<title>`, a `---PROMPT---` line and the full prompt, and gets back `launched <session_id> <title>`; `ARCHIVE <session_id>` archives one. The coordinator rotates every 2 hours (Owner: "let's make new replacement sessions every 2hrs"): a `send_later` at 120 minutes; when it fires it starts no new work, sends its updated handoff to the launcher as an `af-coordinator` LAUNCH, unsubscribes from every PR, deletes its check-ins and stops; the successor subscribes to the open PRs, schedules its own rotation and a ~50-minute PR check-in, tells each lane and the Owner, and has the launcher archive the predecessor. A lane past ~200k tokens sends its handoff to the coordinator, which LAUNCHes its successor; lanes never create sessions, subscribe to PRs or schedule.
- Still the Owner's: other workflow changes (each needs the Owner's words quoted in the PR), hosting, DNS and deploy credentials, licence, pricing and terms text, money, and real-device tests.

### Agent defaults, open to the Owner's veto

Taken under the Owner's "keep doing what you're doing"; these are the agent's, not the Owner's words.

- The editor kit, 2D editor and 3D editor specs proceed on every recommended default, as amended by the merged slices: EDK-D1 to D8 (the kit stays private; an inline-SVG icon set); ED2D-D1 to D13 with FF-D1 to D4 and the §17 defaults; ED3D-D1 to D15 and the §15 defaults (under D6 the 3D editor keeps its own flat-shaded PixiJS v8 viewport and does not use the vendored `@pixi/3d`).
- Plus pricing and the merchant of record (D-7, QB-D2) stay placeholders, and money stays mocked.
- The S8 size budget is held: PUB.3s trims Hosting's streams first.
- The frame budget is not loosened: CI.N1a makes the probe exclusive instead.

Readings the agent applied in 02 on 2026-10-30, also open to veto:

- M3.7c: a core-only base-3d cannot install the Plus `post-retro`, so its look (a palette lock on Endesga 64, an outline) is game code on core's `postFilter` verb.
- GAME-3D.1c and GAME-3D.1f drop their M6 prerequisites (hitstop, keys and doors are game code); GAME-3D.1k authors in the suite only where EDS.0 gives base-3d a format the suite edits, since the Feel, Audio, Writer and Sequence editors edit Plus content.
- M9.3 to M9.6 land in automata-plus, and base-3d keeps its own lock-on, combat, items and dungeon code (M9.9).
- M9.8 (brush-based environments) drops the map's M6.4 prerequisite: base-3d uses core only, so the brush meshes do not wait on the Plus `sectors` extension.
- PRODUCT.5h no longer waits on QB.5a (the map listed each as the other's prerequisite).
- DX.10 uses the website map's six slices (DX.10a to DX.10f); the DX map's four-slice split folds into them.
- M8.9a and M9.10 are one task under two ids; M7.1b's re-vendor is QB.1f's repack (PR #189).
- DX.5 waits on DX.2a, DX.5a, DX.7b and DX.11a; DX.11b and DX.11d break the DX.5 and DX.11 loop.
- The Owner's 2026-10-23 feature freeze is read as ended by the 2026-10-30 direction.

## Facts found on 2026-10-30

- **The moving-base api-report bug** (CI.API1): `pnpm api-report` compared the checkout with `origin/main`'s tip, while CI checks out the merge commit built when the run was queued, hours earlier on the Mac; exports `main` gained meanwhile read as "removed". Fixed by #252 (`24591dd`, merge base). A PR whose branch predates #252 needs `main` merged once more; after that, later moves of `main` no longer break it.
- **Nothing has ever been published.** Every GitHub-hosted job since 2026-10-24, including `release-packages.yml` (pinned to `ubuntu-latest` because its jobs hold write tokens), is refused before it starts with "recent account payments have failed or your spending limit needs to be increased" (run 40212186695 at `6422142`; run 40977777388 at `106b42a`). #31 versioned 9 packages to 0.0.3, and none was published. Owner action: fix the billing, or approve a dedicated self-hosted publish runner (CI.BILL in 02). Answered the same day: "Publish from my Mac" (#192). The first release run started on the Mac (run 40987523255 at `89ff04d`: the plan job passed, the version job was running, publish skipped), so nothing is published yet; hosted billing is still unfixed, which leaves npm provenance unavailable (DX.11a).
- **The nightly's only red is the frame budget**, from the shared Mac's load: the same commit, `6422142`, passed on 2026-10-26 and 2026-10-28 and failed on 2026-10-27 and 2026-10-29 (desktop work p95 25.70 ms against 12.63 ms on 10-29, while work p50 stayed at 9.5 to 10.9 ms). CI.N1a fixes the probe; CI.N2 is the other recent nightly red (Emberwick's compact touch journey on 10-27 and 10-28).
- **The PRODUCT.5e local bundle is lost** (`cc77cc6`). automata-plus `main` holds only its initial commit `3000c20`, and 5e is being redone (automata-plus PR #1, draft).
- **Three-browser parity runs in this container** with `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-local`.
- **The website remote is `mcthaydt/automata-website`**, not `automata_website` (`gh -R` with the underscore fails). 02 uses the new name; the history keeps the old one.
- Ruken's `@ruken/*` packages are still 0.0.0, unpublished and without a licence at RukenApp `d0fa2fe`, so AF vendors them (D-6) and bundles them into its public packages (D-8). `d0fa2fe` pins zod 4.6.6 (QB.1f is unblocked) and parses `[store]` (M7.1b, M7.8s).
- `pixijs-userland/pixi-3d-beta` is not reachable from the session (403); the vendored tarball works without it. Before the AF repository goes public, the tarball must be gone from the tree and its history unless Pixi 3D is public by then.
- M3 will not finish within the two weeks before Pixi 3D goes public (the map puts M3's critical path, M3.0A through the figures to M3.10, at about three weeks for one agent), and the launch also waits on GAME-3D.1 and M9.0.
- `mcthaydt/automata-skills` holds only its initial commit `e14c0ba`. This session's Discord plugin failed to connect (CONNECTION_CLOSED).

## Open PRs and lanes in flight

Each lane is a cloud session that works only in its own worktrees and PRs, never edits 02, 03, 00, 01 or `AGENTS.md`, and reports "ready: #N <task> head <sha>" lines to the coordinator; the coordinator reviews, marks the PR ready, watches its CI, merges it on green (merge commit, full head sha) and ticks 02. Sessions are created and archived only by the launcher `session_01QYLU1fJPdbAybiTAWuSqLd` (every coordinator and lane sits at depth 1); the coordinator rotates every two hours and lanes are replaced when their context fills. No Agent or Workflow tool anywhere ("Apply all 4, no more subagents").

| Lane | Session | State on 2026-10-31 ~08:00Z |
|---|---|---|
| Coordinator (core and 2D path, CI, docs 02/03/00/01 and `AGENTS.md`, the Ruken repacks, APP and PLUS.FREE docs, the runtime); the only session that watches PRs and CI | `session_01QYLU1iZKdmysJwC6Hc9Pn8` (since 07:45Z) | Watching and merging on green: #294 M3.7b part 4, then the 3D stack (#297, #300, #304, #307, #309, #313, #314, #318, #319, #320, #324: each retargets to `main` once its parent merges); #303 EDS.2d, #308 ED2D.7b then #325, #310 ED2D.6b then #322, #312 DX.2d, #316 STANDALONE.3, #321 DIST.2 then #323 DIST.4; website#30 STANDALONE.1, #31 QB.4c, #32 QB.4b. All reviewed and accepted. |
| 3D (M3, GAME-3D, M9 free parts) | `session_01QYLU1fetRTT3kToxUAx8FS` | GAME-3D.1d done (#318, #319, #320, #324); GAME-3D.1e (the HUD) next, stacked on #324's branch. Carries: hearts.max 3 against DESIGN §7.8's 4; 1h's drag and flick cycling; 1i, 1j. |
| Editors (ED2D, ED3D, EDK, EDS) | `session_01QYLU1hYdgks6bMrvZX4wba` | Done #316, #322, #325 (no Ruken words left in editor UI text); next ED2D.8 (the iPad pass), then the unticked editor rows in order. |
| Website and Plus | `session_01QYLU1igkd7HH81jef9VqhB` | The home-page hydration fix, then M6.0a (amend the M6 spec for ADR 0006), then M6.3 and the M6 chain (M6.4a, M6.5, M6.6a, M6.8a, M6.8c, M6.9a, M6.9b). PLUS.FREE waits on the Owner's licence text; DX.9w waits on a successful `main` `ci` run with an `evidence` artifact; DX.11w on DX.11a. |
| DIST (host contract and targets) | `session_01QYLU1hgfPKpcAxfBmeF78F` | #321 DIST.2 (fixing api-report's undeclared breaks), #323 DIST.4; then DIST.3 (stacked on #323), DIST.5, DIST.6. |

**CI bottleneck.** One PC runner (`owner-pc-wsl-af`, label `af-linux`) runs every checks, game-ci and consumer-smoke job, one at a time; a PR's game-ci jobs queue only after its checks job, so they land behind every newer checks run (#294's waited over two hours). Parity, release and the nightly run on the Macs. A second `af-linux` runner, or leave to cancel queued runs on stacked drafts, is with the Owner.

## Critical paths

- **Core publish:** PRODUCT.5e → 5f → 5g → DX.2a → DX.11a → DX.5 → DX.11d. `NPM_TOKEN` gates DX.11a's publish (the release jobs run on the Mac since #192); M2.4p, the first GitHub Packages publish, also follows 5g.
- **Targets:** DIST.0 and DIST.1 (merged) → DIST.2 → DIST.3 and DIST.4 → DIST.5 → DIST.6. STANDALONE.2 (the repo-wide rename and the provenance file, about 500 files) gets its own lane after the 3D stack lands.
- **3D:** M3.1 → M3.2 → M3.4 → M3.5 → M3.6 → M3.7 → M3.10 → GAME-3D.0 → GAME-3D.1 → M9.0 → the launch (M8.9, after Pixi 3D is public: M9.10 and M8.9a). In rows: M3.1a → M3.2 and M3.1b → M3.4a to M3.4d; M3.0A → M3.5a to M3.5d → M3.6a to M3.6d; M4.12; then M3.7a, M3.7b, M3.7c → M3.10 → GAME-3D.0 → GAME-3D.1a to 1l → M9.0 to M9.10 → M8.9.
- **Editors:** ED2D.4c2b → 4c3a, 4c3b → 4c4a, 4c4b → ED2D.5 to ED2D.10, and ED3D.5b to ED3D.12 → EDS.1, EDS.2 and EDS.9 → GAME-3D.1 (GAME-3D.1i needs ED3D.12; 1j needs EDS.9c).

## Legacy framework sources (Owner, 2026-10-30)

The Owner's words: "Take a look at these repos, this is my magnum opus of frameworks, so let's see what we should steal", then "Steal everything you need to, but keep in mind for the camera we're using klipp". Read at: `mcthaydt/AutomataEngine-LegacyV2-` `18525fc` (TypeScript and three.js; the 2D-sprite, 3D-world Western ARPG), `mcthaydt/AutomataEngineV1` `45a9a03` (archived), `mcthaydt/automata-template` `6e08688` (Godot 4.7; reference only) and `mcthaydt/717BevyGameFramework` `4347d6c` (nothing taken). Each piece is recorded on the row that uses it (M3.3a, M3.4b, M3.8b, M6.7a, M6.8a, M9.1, GAME-3D.1c, DX.5) plus a new row, CI.BND2. TypeScript sim and tooling code is extracted with its tests and source commit; three.js and GDScript code is a reference and is rewritten. The sprite-in-3D parts (sprite baking, billboard shadows, facing counts) stay out: 2.5D was dropped on 2026-10-18 and characters are procedural. klipp is the camera (M9.1).

## Paid model changed (Owner, 2026-10-30)

"I kinda want to change our plans for paid - we'll make the editor suite paid for iOS and Android instead as apps; priced like nomad sculp". The Owner then chose: Plus becomes free; the editors stay free on the web and desktop and are paid as iOS and Android apps; a one-time purchase. Draft spec: [APP](superpowers/specs/2026-10-30-paid-editor-apps-design.md); rows APP.0 to APP.5 and PLUS.FREE in 02. Plus stays paused as a lane; its code is now free work, not paid work.

Later: "We need to be able to push to git; our biggest priorities for the editors are tablet ready, cloud collaboration, and designed for non-game devs to be able to work with it (a student filmmaker can hop in and make cutscenes even though they're no developer)". Chosen: git-backed async collaboration first (GitHub as the cloud), and GitHub sign-in. Every editor row is now held to tablet-ready, git-backed collaboration and plain words for people who aren't developers (APP spec §5b); rows COLLAB.1, COLLAB.2, NDX.1 and NDX.2. The cutscene journey needs `cutscenes` (M6.9) and its prerequisites, which stay in Plus (APP-D9, Owner, 2026-10-30: "Cutscenes should be in plus"). The Plus lane starts when the website lane is wrapped up (Owner, 2026-10-30: "You can start plus when website is wrapped up"); its queue then puts the cutscene path first (M6.4a, M6.5, M6.8a, M6.8c, M6.9a, M6.9b), after plus #16 (M7.5b, fixes on `backup/m7-5b-9a43885`) and PLUS.FREE.

## Exact next action

1. Merge the open PRs above as each goes green on its head (parity included); #294 first, then walk the 3D stack down (retarget the child to `main`, merge `main` in, run `pnpm --filter @af-games/base-3d test`, `pnpm exec biome check --write` on what changed, push, mark ready, merge on green). #308 and #310 conflict in the 2D editor's `views.ts`, `ViewServices` and `DocumentScreen`: keep both views. #308's branch still carries the stage profile #316 removes; keep it removed.
2. When a `main` `ci` push run succeeds with its `evidence` artifact (CI.MAIN1 merged), send its run id to the website and Plus lane for DX.9w.
3. The next 02/03 batch: tick M3.7b (parts 3a #289, 3b #292, 4 #294) when #294 merges, and the rows of whatever else merges (STANDALONE.1, QB.4b and QB.4c on website#30 to #32).
4. The runtime focus follow-up (`packages/runtime/src/flow/flow.manager.ts`, the auto-focus on entry) is **not** a plain `!document.hasFocus()` skip: that breaks M4 spec §4.7 under a host, where the game focusing its first control is what gives its frame the keyboard (`examples/e2e/default-screens.e2e.ts` asserts Play focused under the fake host). It needs a narrow opt-out for an inert preview frame, written into the M4 spec first.
5. The "Version packages" PR (#226): its publish waits for the Owner's release-environment approval; not watched.
6. Next coordinator rows with no prerequisite: STANDALONE.2 (dedicated lane, after the 3D stack), PRODUCT.1b2, DX.6a, DX.7b/c, CI.N1a, CI.N3, PRODUCT.4r1, M4.4F.1/2, M4.6F.1, M8.5a, M8.6a, PUB.3s, EX.4cu, CI.BND2.

## Blocked on the Owner

- **The Plus licence text** (asked 2026-10-31 06:49Z), for PLUS.FREE: for example "Plus LICENSE = core's MIT text verbatim, copyright '<name>, <year>'".
- **The CI runner bottleneck** (asked 07:06Z): a second `af-linux` runner, or leave to cancel queued Actions runs on stacked draft PRs (the permission classifier refused both when the agent tried).
- **The Figma page "2D · Profile FloorFifty"** in the Owner's file, to retire now that the profile is dropped.
- **DIST's Owner gates:** signed macOS and Windows bundles on real devices (DIST.5) and a real itch.io Downloadable push.
- **Archiving the four pre-launcher sessions** (the old coordinator `session_01QYLU1gDS1J6YZCB1sspwoV` and the old lanes `session_01QYLU1fsuzzCNWoc84uTypf`, `session_01QYLU1gUDkJKWKgwehpcLRG`, `session_01QYLU1hE7DAF6hEy3zKsyRe`): the launcher archives only sessions it created, so these are the Owner's, from the UI. All four are idle with nothing subscribed or scheduled.
- **The PC runner** (`owner-pc-wsl-af`): a Linux-only `.path` (Windows PATH entries leaked in) and `playwright install-deps` with a quoted PATH.
- **Filing the Pixi 3D beta bug report** from `docs/spikes/s7-q2-pixi3d-webgpu-report.md` (#277).
- **Hosted Actions billing** is answered by publishing from the Mac ("Publish from my Mac", #192, CI.BILL). Still open: whether to fix hosted billing for npm provenance (DX.11a), the Owner's approval of each publish in the release environment (M2.4p, QB.1b), and whether the merge authority covers other changes to `.github/workflows` (Plus CI, PRODUCT.L4's GPU lane, the itch path); earlier such changes, #192's included, carried the Owner's own words.
- **`NPM_TOKEN`** for `@mcthaydt` on npmjs.org (DX.11a, M8.9), and the release-environment approval of each publish.
- **Site hosting and DNS** for `automata.ruken.com` with a deploy credential (DX.12, QB.4a to QB.4c), and function hosting for the store webhook (QB.5a).
- **Discord:** the server and the plugin's bot with admin rights, and a working plugin connection (DX.13, DX.10d).
- **itch.io:** the account and the `BUTLER_API_KEY` secret (PUB.5; M8.5b's smoke).
- **The Ruken licence for the bundled code** (PRODUCT.4r, R-16): resolved. MIT, merged in RukenApp `e376a2d`; the repack follows.
- **D-7 pricing and model, and the merchant of record** (QB-D2: Lemon Squeezy or Paddle) for M10.0, QB.5a and M10.7. Until then they are placeholders and money stays mocked.
- **A GitHub organization for Plus buyers** (QB-D4): collaborators on a personal account get write access. Needed before PRODUCT.5h and QB.5a.
- **The frame-budget probe's exclusivity** (CI.N1a): may the probe pause the sibling runners on the Mac for about two minutes, or should it run on a dedicated machine? And free disk space on the Mac runner if a cleanup step is not enough (CI.N1).
- **The S8 size budget**, only if PUB.3s's trimming fails.
- **Core/Stable labels** (DX §2.3, DX.10e): the compatibility policy, if they should return at 1.0; without one they stay cut.
- **Reviews:** the new public API (EX.4f `postFilter`, EX.4h the `DrawContext` visible band, PRODUCT.2v1 to 2v3, PRODUCT.2s), the EDS.0, M9.0 and M10.0 specs, the GAME-3D.0 design doc and the M8.7 API freeze.
- **WebGPU for 3D** (raised 19:21Z): the M3.1b GPU run measured WebGL2 against WebGPU at 61.8% of pixels different (max 87; the right wall missing and darker lighting under WebGPU, identical in Chromium and WebKit), an `@pixi/3d` beta divergence (#273). Default meanwhile: 3D is WebGL2-only, WebGPU is not offered for 3D, and a bug goes to the Pixi 3D beta.
- **M4.12b on a phone** at compact landscape (#266, merged): the real-device check.
- **Device and visual acceptances**, never ticked by an agent: M4M5.OG (M4.10 on a real phone and two controllers; the M4.7 covers; M5.2 S-c on two devices; M5.7's panel and a real submit); EDK.1 (the built shell), EDK.3 (EK-b on the iPad with the Pencil), EDK.4 (the widgets), EDK.5 (EK-d and EK-f in iPad Safari, EK-e with the Mac's folder picker); the iPad passes of ED2D.10, EDFF.5, ED3D.12 and EDS.11; the baselines of PRODUCT.L3a to L3c, M3.3b and PRODUCT.6; M3.1b's S7-Q10 captures; M3.10 (base-3d on an Android phone and an iPhone, the 24 mm look, the poses and clips, G5 and G6, one paid props run on the Owner's keys); GAME-3D.1l; M6.13; M7.10 (two phones against staging, or the local-VM evidence); M5.8c (a real iPad audio unlock); PRODUCT.8e; PUB.5's real itch.io push; DX.9w's `/proof`; the restored website copy (DX.10a, DX.10b); M10.7 (real money and the site's look).
- **Optional:** access to `pixijs-userland/pixi-3d-beta` (M3.1a); fine-grained read tokens for FloorFifty and The Last Light as AF secrets (M8.10); a deploy key for the skills mirror (DX.11c); Meshy and OpenAI keys for one paid props run (M3.9b); `RUKEN_TOKEN` for a real publish smoke (M8.5b).

## Maintenance checklist

Update this snapshot after a task completes or blocks, after plan changes, after verification and before each handoff:

1. Record the date and the verified source HEAD. Never invent a commit for the update itself.
2. Record completed task IDs, artifacts, PRs or commits and actual evidence, separating drafted, reviewed, implemented, locally verified, CI verified, deployed and Owner accepted.
3. Keep one exact next task, its prerequisites and first concrete action; list Owner decisions separately.
4. Keep incomplete gates unchecked in the master plan and specs.
5. Record unfinished edits and check failures; remove resolved blockers.
6. Verify relative links, task IDs and status consistency.
