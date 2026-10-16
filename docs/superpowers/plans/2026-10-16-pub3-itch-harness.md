# PUB.3: itch-like harness and E2E TDD plan

- **Spec:** [PUB spec](../specs/2026-10-16-publish-targets-design.md) §3, §5, §7 (browser and parity rows), §8, §11 PUB.3, §12 PUB-c; [ADR 0005](../../adr/0005-publish-targets.md). Builds on [PUB.1](2026-10-16-pub1-web-adapter.md) (web adapter, `./target`, `findRukenSdkMarkers`) and [PUB.2](2026-10-16-pub2-ship-target-itch.md) (`ship --target itch`).
- **Status:** PUB.0 Owner-approved 2026-10-16 with every recommended default. Lanes ship + testing; branch `claude/clever-pasteur-ujmu6e-pub3` (PUB.2's branch with PUB.1 merged in).
- **Progress:** 0 of 9 steps.
- **Games:** the spec names `games/placeholder` and `games/emberwick`. Neither folder exists yet (EX moves them); today they are `examples/placeholder` and `examples/base-2d` (Emberwick), so PUB.3 runs on those.
- **Out of scope:** the "Back to …" label and the release job (PUB.4); `create-game`'s `build:itch` and the docs guide (PUB.5); an `automata build --target` CLI (games set the two build options in their own `vite.config.ts` until PUB.5 generates them); a real itch.io page (Owner, PUB.5).

## Global constraints

- **Strict TDD** in `tooling/` and `examples/`: a failing test first, run, confirm the failure reason, minimal change, green.
- **The sim does not know the target.** No sim, content or render change; base-2d only exposes its sim's state hash on the end screen (`data-hash`), as it already exposes `data-tick`.
- **No silent fallback.** Blocked storage shows "Progress won't be saved in this browser"; nothing keeps saves in memory.
- **Gates:** `pnpm format`, `pnpm check`, `pnpm test:parity`, `CI=1 pnpm test:e2e` (ports 4780/4880; the harness adds server+600 and preview+1500), `pnpm --filter @af-examples/placeholder budget:size` (the placeholder's bundle changes). No changeset: no published package changes (examples and `tooling/itch-harness` are private).

## Files

- **Create:**
  - `tooling/itch-harness/` (private `@mcthaydt/itch-harness`): `package.json`, `tsconfig.json`, `src/harness.ts` (`startItchHarness`), `src/embed-page.ts` (`embedPage`), `src/ports.ts` (`itchHarnessPorts`), `src/cli.ts`, and tests `src/harness.test.ts`, `src/embed-page.test.ts`, `src/ports.test.ts`.
  - `examples/placeholder/src/targets.build.test.ts`: an itch build has no Ruken SDK marker; a Ruken build still does.
  - `examples/placeholder/e2e/itch.itch.e2e.ts`, `examples/base-2d/e2e/itch.itch.e2e.ts`, `examples/base-2d/e2e/golden-route.ts` (the golden route played with real keys, shared by the standalone and cross-target journeys).
- **Modify:**
  - `examples/placeholder/src/boot.ts`, `boot.test.ts`, `main.ts`, `index.html`, `style.css`, `vite.config.ts`, `package.json` (`build:itch`, `@mcthaydt/automata-host`).
  - `examples/base-2d/src/boot.ts`, `boot.test.ts`, `game.ts`, `vite.config.ts`, `package.json`, `e2e/base-2d.e2e.ts` (uses `golden-route.ts`).
  - `playwright.config.ts` (four `itch-*` projects, the harness web server; the existing projects ignore `*.itch.e2e.ts`), `.gitignore` (`dist-itch/`).
  - Docs: 02, 03, this plan.

## Interfaces

- **Consumed:** `makeHosting`/`HostingSeams` from `@mcthaydt/automata-host/target` and `.`; `Hosting`, `HostError`; `findRukenSdkMarkers`, `RUKEN_SDK_MARKERS`; `portsFor` (ship); Vite's `defaultClientConditions`; `GOLDEN_ROUTE`, `GOLDEN_GOAL_TICK`, `createBaseSim` (base-2d).
- **Produced:**
  - `startItchHarness({ games, pagePort, gamePort }): Promise<{ pageOrigin, gameOrigin, close() }>`: game builds served from `http://localhost:<gamePort>/html/<name>/` (case-sensitive, 404 at the root and outside a build, `Access-Control-Allow-Origin: *`), and an embed page on `http://127.0.0.1:<pagePort>/?game=<name>[&storage=blocked]` that frames the build as itch.io does (`allowfullscreen`, `allow="autoplay; fullscreen *; gamepad; …"`). `storage=blocked` adds `sandbox` without `allow-same-origin`, so the browser denies the frame storage (a stand-in for third-party storage blocking).
  - `embedPage({ gameUrl, blockStorage }): string`; `itchHarnessPorts(env)`: page = server + 600, game = preview + 1500 (clear of every other example's port and of Chromium's blocked ports).
  - `pnpm build:itch` in both games: `vite build --mode itch` to `dist-itch/` with `resolve.conditions: ['automata-web', ...defaultClientConditions]` and `define: { __AUTOMATA_TARGET__: '"itch"' }`.
  - Placeholder `boot({ root, saves, seams? }): Effect<Hosting, PlaceholderBootFailed, Scope>`; `#saves` shows "Visit N." or the blocked notice; `#fullscreen` toggles `hosting.setFullscreen`.
  - base-2d `connect(options): Effect<Hosting, BaseBootFailed, Scope>` through `./target`; `#game[data-hash]` on the end screen.

## Steps

- [ ] **1. Harness ports.** `ports.test.ts`: server+600 / preview+1500 from `portsFor`; CI's fixed pair gives 5200/6200; no result is a Chromium-blocked port for any slot. Fails: module missing. Add `ports.ts`.
- [ ] **2. Embed page.** `embed-page.test.ts`: the frame's `src` is the game URL, it has `allowfullscreen` and `fullscreen *` in `allow`, no `sandbox` by default; `blockStorage` gives a `sandbox` with `allow-scripts` and without `allow-same-origin`; the URL is HTML-escaped. Fails: module missing. Add `embed-page.ts`.
- [ ] **3. Harness servers.** `harness.test.ts` on port 0: `GET /html/<name>/` serves the build's `index.html`; a JS file has its MIME type and `Access-Control-Allow-Origin: *`; the origin's root, an unknown game, `../` and a wrong-case name (`Index.html`) are 404; the page's `/?game=<name>` frames `<gameOrigin>/html/<name>/index.html`; an unknown game is 404. Fails: module missing. Add `harness.ts` and `cli.ts` (`--game name=dir`, ports from `itchHarnessPorts`).
- [ ] **4. Placeholder boots through `Hosting`.** `boot.test.ts` (Ruken's fake host): the existing cases on `hosting.kind`; a first boot shows "Visit 1." and a second on the same host "Visit 2."; with `saves` not granted, `#saves` shows "Progress won't be saved in this browser." and boot still succeeds. Fails: `boot` has no `saves` part and returns a `RukenSession`. Move `boot.ts` onto `makeHosting` from `./target`; `main.ts` keeps a page-long scope and wires `#fullscreen`.
- [ ] **5. Placeholder itch build.** `targets.build.test.ts` builds the placeholder with Vite twice: `--mode itch` has no SDK marker and contains `itch.io`; the default build has both markers. Fails on the itch build (no `itch` mode yet: the default conditions resolve the Ruken adapter). Add the `itch` mode to `vite.config.ts` and `build:itch`.
- [ ] **6. base-2d through `Hosting`.** `boot.test.ts`: the existing cases (`hosting.kind`, menu refused before ready) on `connect`'s new `Hosting`. Fails: `connect` returns a `RukenSession`. Move `connect`, `game.ts` (rounds, lifecycle stream in a page-long scope), add `data-hash` on the end screen, the `itch` mode and `build:itch`.
- [ ] **7. Placeholder in the harness (E2E).** `itch.itch.e2e.ts` on the four `itch-*` projects (Chromium and WebKit; Pixel 7 and desktop): ready within 2 s of navigation with no console error; "Visit 1." then "Visit 2." after a reload; blocked storage shows the notice and still says hello; the fullscreen button enters and leaves fullscreen; no "Back to …" control. Fails first: the harness server and projects are missing (red run recorded), then green.
- [ ] **8. base-2d in the harness, the golden across targets (E2E).** `itch.itch.e2e.ts`: ready within 2 s, no console error; the golden route played with real keys in the fake Ruken host (the Ruken build) and in the harness (the itch build) reaches the end screen at tick 342 with `data-hash` equal to a Node sim's hash after the same 342 inputs, and the two builds' hashes equal each other. Fails first: no `data-hash` on the page. `base-2d.e2e.ts`'s golden journey keeps passing on the shared `golden-route.ts`.
- [ ] **9. Gates.** `pnpm format`, `pnpm check`, `pnpm test:parity`, `CI=1 pnpm test:e2e`, `budget:size`. Record counts below, in 02 and in 03.

## Parity

The spec's parity row ("the golden replay hash is identical for the `ruken` and `itch` builds, existing parity suite with a second build") runs the sim source, which the build target cannot reach. Step 8 checks the hash in the two real builds instead, inside their two hosts; the existing parity suite stays as it is.

## Execution log

| Step | Date | Evidence |
|---|---|---|
