# consumer-smoke

Installs AF's published packages into a project outside the workspace and uses them as a game would (M2.4
spec §3.6): every entry imports in Node and a physics sim runs, `automata-content` compiles a small content
folder, `automata-ship` and `automata-check-boundaries` run, TypeScript 7.0.2 and 6.0.3 read every
declaration, no published file uses `eval`, and a Vite bundle of the sim, the host and a ui component holds one
copy of Ruken's SDK.

```sh
pnpm build && node tooling/consumer-smoke/src/run.ts --from packs          # the workspace's packed packages
node tooling/consumer-smoke/src/run.ts --from registry --version 0.0.1    # a release (NODE_AUTH_TOKEN reads it)
```

`--keep` leaves the temp project for inspection. Run it beside `pnpm ci:local` on any pull request that
changes how packages are built or published (a `tsdown.config.ts`, `svelte.config.js`, `package.json`,
`.changeset/`, `tooling/release/` or `tooling/consumer-smoke/`); CI runs it on those pull requests
(`consumer-smoke.yml`, not on drafts) and nightly, and the release job runs the registry form after a publish.
