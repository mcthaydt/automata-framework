# The Automata website

The site at automataframework.com: Home, Start, Docs, Examples, the Editor page, the API reference, Privacy and Terms.
It is a SvelteKit app prerendered to static files, so any static host can serve `build/`.

The site keeps no copy of the framework. Its docs are the guides in `docs/guides/` (in the order of their
`index.md`), its API pages are the API index `pnpm api-index` writes, its demos and the try-it editor are the framework's
own builds, and its examples are the files in `examples/`. All of it is read when the site is built.

## Run it

From the repository root, after `pnpm install`:

```sh
pnpm build && pnpm api-index           # the framework, and the API index the site reads
cd site
node scripts/build-demos.ts             # the demos and the try-it editor, into static/ (pnpm build runs it too)
pnpm dev                                # the site on a local server, reloading as you edit
pnpm build                              # the static site in build/, with the SEO files and the redirects
```

## Check it

```sh
pnpm test                               # unit tests (tests/unit/<feature>/)
pnpm check                              # svelte-check
pnpm check:site                         # the built site's rules: links, metadata, CSP, copy (run after pnpm build)
pnpm test:e2e --project chromium        # every page at four sizes in a browser (about ten minutes)
```

## Where things are

| Folder | What is there |
|---|---|
| `src/features/<page>/` | One folder per page or feature: its components, its data and its logic |
| `src/shared/` | What several pages use: the header, footer and code blocks, the readers of the framework's files, the CSP |
| `src/routes/` | SvelteKit's routes, kept thin: each one loads its feature's component |
| `scripts/` | The build steps (demos, SEO files, redirects) and the built site's checks |
| `playground/` | The examples' runtime, built separately and run in a frame |
| `tests/unit/`, `tests/e2e/`, `tests/playground/e2e/` | Unit tests by feature, the built site's browser checks, the playground's journeys |

An old address of a page the site cut redirects to the page that took its place (`src/features/redirects/`).
