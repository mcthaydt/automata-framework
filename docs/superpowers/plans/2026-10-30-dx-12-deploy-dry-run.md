# DX.12: the website deploy job, as a dry run against a placeholder target (plan)

> **Row:** framework `docs/02-master-delivery-plan.md`, DX.12 (DX spec task table, D-DX-5; prerequisite WEB.S1, merged
> as #15). **Lane:** website. **Branch:** `claude/website-DX.12-deploy-dry-run`.

## Goal

The site has a deploy job that would publish the exact build CI tested, as an immutable release, and a check that
`/llms.txt` and `/llms-full.txt` are served from the origin. Nothing deploys yet: the Owner has not supplied hosting,
a deploy credential or DNS for `automata.ruken.com` (decision 11), and the lane rule is never to deploy publicly. So
the target is a placeholder, the job runs `--dry-run`, and the served-file check runs against the build on a local
server. When the Owner supplies the host, one change names the target and its credential, and drops `--dry-run`.

## Interfaces produced

| Name | File | Notes |
| --- | --- | --- |
| `releaseManifest(dir)` → `{ id, files: [{ path, bytes, sha256 }] }` | `scripts/release.ts` | every file under the build, sorted by path; `id` is the sha256 of the file list, so the same build is the same release and any byte changes it |
| `pnpm release --dry-run` | `scripts/release.ts` | writes `release-manifest.json` and prints what it would upload to the placeholder target; without `--dry-run` it refuses, naming what the Owner must supply |
| `checkServedFiles(origin, buildDir, fetch)` → problems | `scripts/check-deployed.ts` | `/llms.txt` and `/llms-full.txt`: status 200, `text/plain`, bytes equal to the build's |
| `pnpm check:deployed <origin>` / `--local` | `scripts/check-deployed.ts` | `--local` serves the build with `serve-static.ts` on a free port and checks that |
| `.github/workflows/deploy.yml` | | after `ci` succeeds on a push to `main`: the `site-build` artifact of that run, `pnpm release --dry-run`, `pnpm check:deployed --local`, the manifest kept as an artifact; `af-mac`, read-only permissions plus `actions: read` for the artifact, no secret |

## Steps (TDD)

1. [x] `tests/release.test.ts` (fails first: no module): the manifest lists every file sorted with its bytes and sha256;
   the id is stable for the same tree and changes with one byte; the CLI without `--dry-run` exits non-zero naming the
   Owner's inputs and writes nothing; with it, writes the manifest and says nothing was uploaded.
2. [x] `tests/check-deployed.test.ts` (fails first): with a fake fetch, a match passes; a 404, a non-text type and stale
   bytes are each a problem naming the path; against `serve-static.ts` on a temporary build, the check passes.
3. [x] `tests/workflows.test.ts` gains a `deploy.yml` block (fails first: no file): the trigger, the success-on-push guard,
   `af-mac`, the permissions, no secret, the steps in order with `--dry-run`, actions pinned to commits.
4. [x] Gates: `pnpm check`, `pnpm test`, `pnpm build`, `pnpm check:site`, then `pnpm release --dry-run` and
   `pnpm check:deployed --local` on the real build.

## Not in this task

The real host, credential and DNS (Owner); HTTPS, HSTS and the header set (QB.4a); uptime, certificate and spend alerts
(QB.4b); the rollback rehearsal (QB.4c); restoring the URL-based `llms.txt` instructions (DX.10d).

## Execution log

2026-10-30, this container: Node 24.21.0, framework sibling at `framework.ref` `30e9606`.

- **Step 1.** `tests/release.test.ts` failed first ("Cannot find module '../scripts/release'"), then 4 passed.
- **Step 2.** `tests/check-deployed.test.ts` failed first (module missing), then 5 passed, including `--local` against
  `serve-static.ts` on a temporary build and an unreachable origin.
- **Step 3.** `tests/workflows.test.ts` failed first (ENOENT on `deploy.yml`), then 36 passed (6 new). `ci.yml`'s header,
  which said the deploy is a separate decision, now names `deploy.yml` as that job.
- **Step 4.** `pnpm check` 0 errors; `pnpm test` 51 files, 323 passed, 1 expected fail; `pnpm build`; `pnpm check:site`
  28 pages. On that build: `pnpm release --dry-run` "release 7b8819f496f3, 478 files, 15795133 bytes, for the
  placeholder target; nothing was uploaded"; `pnpm check:deployed --local` "/llms.txt and /llms-full.txt are served from
  http://127.0.0.1:42205 as built". The build's rewrite of `src/data/first-change-proof.json` (its timestamp only) is
  not committed.
- **Not verified here:** the workflow itself runs only after a `ci` run on `main`, so its first run is after this merges
  (on the Mac). The deploy to `automata.ruken.com` and the check against that origin wait on the Owner's host.
