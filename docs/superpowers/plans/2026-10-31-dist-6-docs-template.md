# DIST.6 plan: `create-game` targets and the "Publish to …" guides

> Row: DIST.6 in [02](../../02-master-delivery-plan.md). Spec:
> [DIST spec](../specs/2026-10-31-dist-target-neutral-design.md) §5.3, §6.1 (the Tauri peers), §6.3, §8 flow 1,
> §12 DIST-D9, acceptance DIST-h. Lane: ship (template, docs). Website copy is the website lane's (other repo).
> Strict TDD in `packages/cli`.

**Status: implemented and locally checked; CI pending on #336.** The Owner folded the DIST stack into one milestone PR (2026-10-31: "PRs should be
milestone level"; "Yes, consolidate now"), so DIST.6 lands on `claude/dist-5a-tauri-adapter` (#336) on top of DIST.2
to DIST.5c, which carry everything this plan consumes. Every "verify on the merged stack" item below is read there, and
a difference is logged under Deviations.

## Interfaces

- **Consumes:** `@mcthaydt/automata-host/target` (`automata-<target>` conditions, `default` = web; the public
  `makeHosting`/`HostingLive` of DIST.5a); `defineShipConfig` with the optional `tauri` (§6.3) and `itch`
  (`itchConfigSchema`: `project` lower-case `user/game`, `channel` default `html5`) sections; `automata-ship prepare
--target ruken|itch|tauri` (ship `cli-args.ts` `USAGE`); Vite 8's `defaultClientConditions`; the Tauri pins of the
  DIST.5 plan (`@tauri-apps/api` 2.12.4, `plugin-store` 2.5.0, `plugin-process` 2.4.0, `@tauri-apps/cli` 2.12.3).
- **Produces (private `cli` package, no changeset):**
  - `export const DIST_TARGETS = ['web', 'itch', 'ruken', 'tauri'] as const` and `type DistTarget` in
    `packages/cli/src/create-game-targets.ts` (the template's own list; the host contract owns target names, so if
    the merged host exports a target list, import it instead and log it).
  - `CreateGameOptions.targets?: readonly DistTarget[]`, default all four (DIST-D9).
  - `CreateGameError['reason']` gains `'invalid-targets'` (empty, unknown or repeated target).
  - `automata create-game <dir> [--targets web,itch,ruken,tauri]`.
- **Generated game (per chosen target):**

| Target | `package.json` scripts                                                                        | Dependencies                                                                                                                               | `ship.config.ts`                                                                                   | `.gitignore`                |
| ------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | --------------------------- |
| all    | `dev: vite`, `typecheck`; no plain `build`                                                    | `@mcthaydt/automata-host`, `@mcthaydt/automata-sim`, effect, pixi.js, zod; dev: `@mcthaydt/automata-ship`, typescript, vite, `@types/node` | `game`, `runtime`, `network`, `content`                                                            | `node_modules/`, `dist/`    |
| web    | `build:web: vite build --mode web`                                                            | —                                                                                                                                          | —                                                                                                  | —                           |
| itch   | `build:itch: vite build --mode itch`, `prepare:itch: automata-ship prepare --target itch`     | —                                                                                                                                          | `itch: { project: 'your-itch-user/<id>', channel: 'html5' }`                                       | `*-itch.zip`                |
| ruken  | `build:ruken: vite build --mode ruken`, `prepare:ruken: automata-ship prepare --target ruken` | `@ruken/sdk` (verify on the merged stack: host's optional peer or not needed)                                                              | `game.sdk` (required by the schema until the "Ruken fields only for ruken builds" follow-up lands) | —                           |
| tauri  | `build:tauri: vite build --mode tauri`, `prepare:tauri: automata-ship prepare --target tauri` | `@tauri-apps/api`, `@tauri-apps/plugin-store`, `@tauri-apps/plugin-process`; dev: `@tauri-apps/cli`                                        | `tauri: { identifier: 'dev.example.<id>' }`                                                        | `.automata/`, `dist-tauri/` |

`build:<target>` is Vite only, so 5c's default `build-tauri-command` (`pnpm build:tauri`) stays correct and
`prepare:<target>` is the separate ship step (flow 1). The generated `vite.config.ts`:

```ts
import { defaultClientConditions, defineConfig } from "vite";

// Each build holds one target's host adapter (DIST spec §5.3): `vite build --mode <target>` picks it through
// the package condition; any other mode (plain `vite` for development) gets the web adapter, the `default`.
const ADAPTER_CONDITIONS: Record<string, string> = {
  web: "automata-web",
  itch: "automata-web",
  ruken: "automata-ruken",
  tauri: "automata-tauri",
};

export default defineConfig(({ mode }) => ({
  base: "./",
  resolve: {
    conditions: [
      ADAPTER_CONDITIONS[mode] ?? "automata-web",
      ...defaultClientConditions,
    ],
  },
  build: { outDir: "dist", emptyOutDir: true, assetsInlineLimit: 0 },
}));
```

The map lists only the chosen targets plus `web` (the fallback). `src/boot.ts` boots through
`@mcthaydt/automata-host/target` (awaits `ready`, shows `hostName`), so each build really holds its adapter.
A generated `README.md` lists the chosen targets' commands and links the guides.

- **Guides:** `docs/guides/publish-to-web.md`, `publish-to-itch.md`, `publish-to-ruken.md`,
  `publish-to-desktop.md`: prerequisites, the config section, `build:<t>` then `prepare:<t>`, publish
  (`automata-ship publish …` with the secret it needs), what to check, and the Owner-only steps (signing). Each
  names only what the commands in this repo do. The website lane gets the guide links and copy in the ready line.

## Steps (strict TDD; tick each when its check passes, in the same commit)

1. [x] Re-read the merged host `target` entry, `ShipConfig`'s `tauri`/`itch`/`game.sdk`, ship's `USAGE` and
       `docs/versions.md` rows for the Tauri packages; log any difference from Interfaces.
2. [x] `create-game-targets.test.ts`: `parseTargets('web,tauri')` → `['web','tauri']`; empty, unknown (`steam`) and
       repeated fail `invalid-targets` naming the value and the four allowed. Red (no module), then green.
3. [x] `create-game.test.ts`: with no `targets`, `package.json` has `build:web|itch|ruken|tauri` and
       `prepare:itch|ruken|tauri`, no `build`, no `prepare-ruken`; the Tauri deps and dev dep at their pins;
       `@mcthaydt/automata-host` present. Red, then green.
4. [x] Same file: `targets: ['web']` writes only `build:web`, no Tauri or Ruken deps, no `tauri`/`itch` config
       sections, `.gitignore` without `.automata/`. `targets: ['tauri']` adds `.automata/` and `dist-tauri/` and
       `tauri.identifier` passing ship's reverse-DNS check (call the check, not a copy of its regex). Red, then green.
5. [x] Same file: the generated `vite.config.ts` maps each chosen target's mode to its condition and falls back to
       `automata-web`; `src/boot.ts` imports `@mcthaydt/automata-host/target`. Red, then green.
6. [x] `bin.ts` test: `--targets web,itch` reaches `createGame`; a bad list prints the `invalid-targets` message and
       exits 1; `USAGE` documents the flag and the default. Red, then green.
7. [x] `create-game.integration.test.ts` (DIST-h): generate with all four, run each `build:<target>` (Vite with the
       workspace packages), assert each bundle holds only its adapter with the existing marker checks
       (`RUKEN_SDK_MARKERS` and DIST.5a's `TAURI_MARKERS`), then `prepare --target ruken` and `--target itch` succeed.
       `prepare --target tauri` runs only where cargo and WebKitGTK exist (the DIST.5b proof environment), else the test
       asserts the named missing-toolchain failure. Red, then green.
8. [x] Guides, and the generated `README.md` (a template test asserts it names each chosen target's commands).
9. [x] Gates: `pnpm exec biome check --write`, `pnpm format`, `TURBO_FORCE=true pnpm check`; `pnpm build` and
       `node tooling/consumer-smoke/src/run.ts --from packs` (the template's generated game is what the smoke builds);
       `pnpm api-index`/`agent-skills` only if they report the cli (private, so expected unchanged); no changeset
       (`cli` is private), `node tooling/release/src/check-changesets.ts` clean. Parity omitted: no sim, renderer, ui or
       golden touched.

## Decisions for the Owner's veto (defaults taken)

| ID       | Question                 | Default                                                              | Why                                                                                                             |
| -------- | ------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| DIST6-D1 | How `create-game` "asks" | **A `--targets` flag** defaulting to all four; no interactive prompt | The CLI is flag-only today and scripted (consumer smoke, CI); a TTY prompt is a follow-up if wanted             |
| DIST6-D2 | Script names             | **`build:<t>` (Vite only) and `prepare:<t>` (ship)**                 | Matches spec §5.3 and 5c's `pnpm build:tauri` default; `prepare-ruken` is renamed                               |
| DIST6-D3 | Placeholder ids          | **`dev.example.<id>`** (Tauri) and **`your-itch-user/<id>`** (itch)  | Pass the checks so every build is green with no edits (DIST-h); the guides say to change them before publishing |
| DIST6-D4 | Where the guides live    | **`docs/guides/`** in this repo                                      | No guides folder exists; the website lane links or copies them                                                  |

## Execution log

- 2026-10-31, DIST.6 code on `claude/dist-5a-tauri-adapter` after `a57fc9a2`:
  - Step 1: the merged stack matches Interfaces. `./target`'s `web` entry exports `makeHosting` and `HostingLive`;
    `game.sdk` is optional in `GameConfigSchema`, so the template writes it only for ruken; ship exports
    `tauriConfigSchema` (identifier regex `^[A-Za-z][A-Za-z0-9-]*(\.[A-Za-z0-9-]+)+$`) and `itchConfigSchema`.
  - Steps 2–6 and 8: each red first for the expected reason (missing module; no target scripts, sections, ignore
    lines, conditions, README; no `--targets` flag), then green. `packages/cli`: 17 files, 144 tests; `tsc` clean.
  - Step 7 proof by hand: `automata create-game` with the default targets, then `vite build --mode <t>` per target,
    then `findRukenSdkMarkers` and `findTauriMarkers` on each bundle. Results:
    - web: 272 kB, no markers.
    - itch: 272 kB, no markers.
    - ruken: 296 kB, Ruken markers only (`ruken:__probe__`, "needs the Ruken host").
    - tauri: 288 kB, Tauri markers only (`__TAURI_INTERNALS__`, `plugin:process|exit`).

    Then, from the game folder, `automata-ship prepare --target itch` wrote `dist-proof-0.1.0-itch.zip`, and
    `--target ruken` wrote `dist/ruken.toml`.

  - Step 9 gates:
    - `TURBO_FORCE=true pnpm check`: 36/36.
    - `pnpm build`.
    - `pnpm api-report --update` changed only `cli.api.md` (`CreateGameOptions.targets`; private, so no changeset).
      Plain `pnpm api-report`: 0 undeclared.
    - `api-index` and `agent-skills`: current.
    - `check-changesets`: 8 changesets, 0 problems.
    - Omitted: parity (no sim, renderer, ui or golden touched) and the consumer smoke (no build config changed).

- 2026-10-31: plan drafted from `main` at `547ce175` and the DIST stack tip `claude/dist-5c-desktop-release`
  `c88a91a4`. Held until DIST.5b merges (see Status).
- 2026-10-31: the stack was consolidated into #336; this plan rides its first push, and the code follows in the
  next.

## Deviations

1. **The template's packages are pinned in `create-game-targets.ts`, and `docs/versions.md` gains `@tauri-apps/cli`
   2.12.3.** No workspace package installs the Tauri CLI (ship does not carry it, DIST.5b), so the versions test's
   "no row for a version nothing uses" refused the row. `tooling/versions` now also counts the exact pins create-game
   writes as used (`pinsFromScaffoldSource`, red then green in `pins.test.ts`), the reverse of create-game's own test
   that holds each scaffold pin to a row.
2. **Step 7 is split.** A Vite build of a generated game needs its dependencies installed, which a unit test inside
   `packages/cli` cannot do without a workspace install. The integration test generates the four targets and runs
   `prepareItch` and `prepareBuild` (Ruken) on the build as written. The real per-target builds were proven once by
   hand (execution log): the generated game in a scratch folder in the worktree, its dependencies linked from the
   workspace, removed afterwards.
3. `prepare --target tauri` was not re-run for the generated game: it is a full `tauri build`, which DIST.5b proved on
   Linux with the same generated project code (its log has the bundle sizes and SHA-256).
