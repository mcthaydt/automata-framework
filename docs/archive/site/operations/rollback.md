# Rolling back the website (QB.4c)

A release of the site is the exact build a `ci` run tested, named by the sha256 of its file list (DX.12,
`scripts/release.ts`). Releases are never changed once made, so rolling back means making an earlier release current
again. Nothing is rebuilt.

## The release store

| Path | What it holds |
| --- | --- |
| `releases/<id>/` | one release's files, copied in once and never written again |
| `history.json` | every change of the current release, in order: `{ action: 'publish', id, at }` or `{ action: 'rollback', id, from, at }` |
| `current` | the id of the release being served; replaced by one rename |

The site has not been deployed yet. Deploys stay dry runs until the project is complete, and the Owner has not supplied
the host, a deploy credential or DNS for `automata.ruken.com` (decision 11). Until then the store is a local folder.
When the host exists, the target change in `scripts/release.ts` points these steps at the host's store instead.

## Roll back

1. Roll back to the release that was current before this one:
   `pnpm release --dry-run --rollback --store <store>`
   To pick a release by name instead, add `--to <id>` (any id from `history.json`). Rolling forward again works the
   same way: `--to` names the newer release.
2. Check what is served now: `pnpm check:deployed <origin>`. Before the host exists, use
   `pnpm check:deployed --local --build <store>/releases/<id>`.
3. The command refuses, and changes nothing, when there is no earlier release, when `--to` names a release that was
   never published, or when it names the current one.

## Rehearse

`pnpm build && pnpm rehearse:rollback [build] [--store <dir>]` publishes the build as release A, then publishes A plus
one marker file as release B. It checks that B is served, rolls back, and checks that A is served again and the marker
is gone. Each check is the full `check:deployed` (served llms files, header set, page policies) against `serve-static.ts`
on the current release's folder. `tests/rehearse-rollback.test.ts` runs it on a small build on every `pnpm test`.

## Recorded rehearsal, 2026-10-31

The build was `main` at `4682c40`, built with the framework at `framework.ref` `f8023a9`, on the website lane's Linux
container (Node 24.21.0).

```
$ pnpm rehearse:rollback build --store <scratch>/rollback-store
Store <scratch>/rollback-store: published A (4cbf86e8019e), then B (0436685fc943).
Serving B (0436685fc943): check:deployed passed, the marker is served.
Rolled back to A (4cbf86e8019e): check:deployed passed, the marker is gone.
```

`history.json` after the run:

```json
[
  { "action": "publish", "id": "4cbf86e8019e847e6654edc53c2629053f99843bb628fcb32229ce5f0b50c7b8", "at": "2026-10-31T06:27:29.140Z" },
  { "action": "publish", "id": "0436685fc9436dc610851859990ebd1ed495e1007555e0e94fa0ab9ebc210a23", "at": "2026-10-31T06:27:29.280Z" },
  { "action": "rollback", "id": "4cbf86e8019e847e6654edc53c2629053f99843bb628fcb32229ce5f0b50c7b8", "from": "0436685fc9436dc610851859990ebd1ed495e1007555e0e94fa0ab9ebc210a23", "at": "2026-10-31T06:27:29.807Z" }
]
```

Still open: a rollback on the live origin, once DX.12 deploys there. That run gets recorded here the same way, checked
with `pnpm check:deployed https://automata.ruken.com`.
