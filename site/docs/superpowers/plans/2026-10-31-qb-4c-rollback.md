# QB.4c: deploy hardening, a rehearsed rollback (plan)

> **Row:** framework `docs/02-master-delivery-plan.md`, QB.4c (prerequisite DX.12, merged). **Lane:** website.
> **Branch:** `claude/website-QB.4c-rollback`.

## Goal

Roll back to the previous build once and record it (QB-d). The site has never been deployed and deploys stay dry runs
until the project is complete (the Owner has not supplied the host, a credential or DNS, decision 11). So the rollback
runs against a local release store laid out the way an immutable host keeps releases: every release in its own folder,
named by its content (DX.12's `releaseManifest`), a history of what was made current and when, and one pointer to the
current release. Rolling back moves the pointer to the release that was current before; no file is rebuilt or changed.
The rehearsal publishes two releases, rolls back, and checks with `check:deployed --local` that the served site is the
earlier release. When the host exists, the same commands name its release store instead of the local folder.

## Interfaces produced

| Name | File | Notes |
| --- | --- | --- |
| `publishRelease(buildDir, store, at)` → `ReleaseRecord` | `scripts/release.ts` | copies the build to `<store>/releases/<id>/` unless that id is already there (a release never changes), appends `{ action: 'publish', id, at }` to `<store>/history.json` and makes it current |
| `rollBack(store, at, to?)` → `ReleaseRecord` | `scripts/release.ts` | makes current the release that was current before this one (or `to`, which must be a published release); appends `{ action: 'rollback', id, from, at }`; refuses with no earlier release, or when `to` is already current |
| `currentRelease(store)` → id or undefined | `scripts/release.ts` | reads `<store>/current` |
| `pnpm release [build] --dry-run --store <dir>` | `scripts/release.ts` | as before, plus the publish into the local store |
| `pnpm release --dry-run --rollback --store <dir> [--to <id>]` | `scripts/release.ts` | the rollback; without `--dry-run` it refuses as publishing does |
| `pnpm rehearse:rollback [build]` | `scripts/rehearse-rollback.ts` | publish the build (A), publish A plus one marker file (B), check B is served, roll back, check A is served and B's marker is gone; prints the record |
| `docs/operations/rollback.md` | | the runbook and the recorded rehearsal |

## Steps (TDD)

1. [x] `tests/release.test.ts` (fails first: no `publishRelease`): publishing copies the build under its id, records it
   and makes it current; publishing the same build again adds a history entry but leaves the folder untouched; a
   rollback makes the previous release current and records `from`; `--to` picks a named release; no earlier release,
   an unknown `--to` and `--to` the current one are each refused, changing nothing.
2. [x] CLI tests: `--store` with `--dry-run` publishes; `--rollback` without `--dry-run` refuses; `--rollback` without
   `--store` is a usage error.
3. [x] `tests/rehearse-rollback.test.ts` (fails first: no script): on a small build with the llms files, the rehearsal
   exits 0 and its record shows publish A, publish B, rollback to A.
4. [x] Implement; run the rehearsal once against the real build; record its output in `docs/operations/rollback.md`.

## Commands

- `pnpm exec vitest run tests/release.test.ts tests/rehearse-rollback.test.ts`: expected green.
- `pnpm build && pnpm rehearse:rollback`: expected exit 0, "rolled back to A".

## Gates

`pnpm check`, `pnpm test`, `pnpm build` (restore `first-change-proof.json`), `pnpm check:site`. The browser and
Lighthouse suites are omitted: no page, style or client code changes.

## Execution log

- 2026-10-31: plan written.
- Steps 1 to 3 failed first for the expected reasons (`publishRelease is not a function`; no `scripts/rehearse-rollback.ts`),
  then passed: 14 release tests, 2 rehearsal tests.
- Deviation: `check-deployed.ts` now exports `checkDeployed(origin, buildDir)` (its three checks, which the CLI already ran
  in that order) and `serveLocally`, so the rehearsal runs exactly the deploy check. No behaviour change; its tests pass.
- Review fix: a publish clears a leftover `<id>.partial` from an interrupted copy before copying again.
- Rehearsal on the real build (`main` `4682c40`, framework `f8023a9`): A `4cbf86e8019e`, B `0436685fc943`, served B,
  rolled back, served A, marker gone; recorded in `docs/operations/rollback.md`.
- Gates: `pnpm check` 0 errors 0 warnings; `pnpm test` 445 passed and 1 expected fail (`stack-page` needed framework
  commit `91e9fee` fetched into the shallow checkout first; environmental); `pnpm build` ok (proof JSON restored);
  `pnpm check:site` 45 pages verified. Browser and Lighthouse suites omitted: no page, style or client code changed.
