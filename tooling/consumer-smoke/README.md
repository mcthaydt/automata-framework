# consumer-smoke

Checks AF the way a game author meets it: it installs the published packages into a project outside this
repository and builds a small game with them. If a package is missing a file, a type or an entry, this fails
where the workspace would not notice.

What it runs, in order:

1. Every command in the root `README.md` still names a real script or file (`src/readme.ts`; `pnpm check` runs
   the same check).
2. Every package entry imports, in Node or through Vite for the ones that load Svelte or PixiJS, and a sim plugin
   runs.
3. The content compiler, `automata-ship` and `automata-check-boundaries` run; TypeScript 7.0.2 and 6.0.3 read every
   type declaration (7.0.2 also under nodenext); no published file uses `eval`.
4. A small game on `@mcthaydt/automata` is built for Ruken (one copy of Ruken's SDK in the bundle) and for the web.
   The web build is served with the headers Ruken would send and opened in Chromium: it must reach
   `data-state="ready"`, start from Play and run 30 frames with no error and no CSP violation. This step needs
   Playwright's Chromium (`pnpm exec playwright install chromium`, or `PLAYWRIGHT_BROWSERS_PATH`).

```sh
pnpm build && node tooling/consumer-smoke/src/run.ts --from packs          # the workspace's packed packages
node tooling/consumer-smoke/src/run.ts --from registry --version 0.0.1    # a release (NODE_AUTH_TOKEN reads it)
```

The temp project pins the workspace's `packageManager` and keeps its overrides in its own `pnpm-workspace.yaml`,
so corepack runs the same pnpm here as in the repository. `--keep` leaves the temp project for inspection. Run it beside `pnpm ci:local` on any pull request that
changes how packages are built or published (a `tsdown.config.ts`, `svelte.config.js`, `package.json`,
`.changeset/`, `tooling/release/` or `tooling/consumer-smoke/`); CI runs it on those pull requests
(`consumer-smoke.yml`, not on drafts) and nightly, and the release job runs the registry form after a publish.
