# consumer-smoke

Installs AF's published packages into a project outside the workspace and uses them as a game would (M2.4
spec §3.6): every entry imports in Node (ui's root, which exports Svelte components, through Vite instead) and a
physics sim runs, `automata-content` compiles a small content folder, `automata-ship` and
`automata-check-boundaries` run, TypeScript 7.0.2 and 6.0.3 read every declaration (7.0.2 also under nodenext
resolution), no published file uses `eval`, and a Vite bundle of the sim, the host and a ui component holds one
copy of Ruken's SDK. Its first step checks that every command in the root `README.md` still names a root
script, a workspace package's script or a file that exists (`src/readme.ts`, QB.1); `src/readme.test.ts` runs
the same check in `pnpm check`.

```sh
pnpm build && node tooling/consumer-smoke/src/run.ts --from packs          # the workspace's packed packages
node tooling/consumer-smoke/src/run.ts --from registry --version 0.0.1    # a release (NODE_AUTH_TOKEN reads it)
```

The temp project pins the workspace's `packageManager` and keeps its overrides in its own `pnpm-workspace.yaml`,
so corepack runs the same pnpm here as in the repository. `--keep` leaves the temp project for inspection. Run it beside `pnpm ci:local` on any pull request that
changes how packages are built or published (a `tsdown.config.ts`, `svelte.config.js`, `package.json`,
`.changeset/`, `tooling/release/` or `tooling/consumer-smoke/`); CI runs it on those pull requests
(`consumer-smoke.yml`, not on drafts) and nightly, and the release job runs the registry form after a publish.
