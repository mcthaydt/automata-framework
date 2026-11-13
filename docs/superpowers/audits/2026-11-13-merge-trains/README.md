# Merge trains, 2026-11-13

Nine finished, audited branches are merged in trains: one integration branch merges several of them, one pull
request runs CI once. Each member goes in with `git merge --no-ff` (real merges; no rebase, no squash, no
cherry-pick), so every member commit lands on `main` as it is. The merge session opens each train's pull request
and merges it with a merge commit.

## Train 1: `claude/merge-train-1`

Built from `origin/main` at `a234a3a20`. Members, in merge order, each at the remote head taken at build time:

| # | Branch | Merged head | Notes |
| --- | --- | --- | --- |
| 1 | `claude/evidence-tags` | `e1c2fffd7` | Skipped: already on `main` (pull request #670). |
| 2 | `claude/editor-journeys-green` | `d9437e94d746784988b60a7019ca3b4096fa58b7` | |
| 3 | `claude/default-screens-focus` | `0dc6fed1270dc17b433c97f0888405be329dd34e` | Clean: no PNG under `tooling/evidence/examples-index/`; the examples runner's screenshot-path fix (`0dc6fed12`) is present. |
| 4 | `claude/emberwick-journey-speed` | `800bede8e3ab75c1020c83033d7f742fb30ec2f7` | |
| 5 | `claude/typed-words-saved` | `cd01f69ddd6cccfdd1322212d69a939f9b0b6b69` | |
| 6 | `claude/desktop-games` | `ad54d8312258f8791e6103660de2ef8a97af7bc0` | |
| 7 | `claude/ship-docs` | `0470b938bd806c817da18996de98e5acafade661` | Docs only. |

No member changes a file under `.github/workflows`. No merge conflicted, so there are no resolutions to record.
