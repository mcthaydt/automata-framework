# Branch inventory, 2026-11-13

**Deleting a branch with an open pull request closes that pull request.** On 2026-11-12 that closed thirteen pull requests. Nothing here was run: no branch was deleted, no tag made, nothing merged or closed.

The Owner's words, 2026-11-13: "we should only have main branch by the end of this". This page is the list to delete from. It was made from `origin` at `origin/main` = `a234a3a20d72` (2026-11-12 22:03 -0600), by an audit session that changes no code.

## Summary

70 remote branches besides `main` (69 on origin today, plus this audit's own, `claude/branch-inventory`, which is pushed with this page; the brief expected about 170: most were already gone). Counts:

| Verdict | Branches |
|---|---|
| MERGED | 1 |
| IN THE QUEUE | 33 |
| DOCS TO GATHER | 5 |
| SCRAPPED, TAG FIRST | 8 |
| HELD FOR THE OWNER | 11 |
| UNMERGED, DECIDE | 11 |
| NOT OURS | 1 |
| Total | 70 |

What the evidence says, in short:

- **Only one branch is deletable today** (`claude/shared-polish-emberwick-site`, an ancestor of main). `main` takes pull requests as merge commits, so a merged branch is an ancestor of `main` and shows 0 commits ahead; every other branch here has commits main lacks. The "many MERGED by tree" case the brief expected did not occur: `git merge-tree --write-tree` gave a tree equal to main's only for the one branch above (and for this audit's own branch, which has no change yet).
- **The thirteen pull requests (#508, #522, #531, #532, #534, #544, #545, #548, #559, #560, #562, #564, #567) are all still closed (unmerged)**, closed at 2026-11-12 21:01:46-58Z, though their branches were restored. Five of them (#522, #534, #559, #562, #567) are fully inside `claude/editors-v2-landing`; #508 is nearly so. Six (#532, #544, #545, #548, #560, #564) and #531 are **on neither main nor the queue**: see UNMERGED, DECIDE. Restoring a branch does not reopen its pull request; that is a separate act.
- **The queue holds more than it names.** By ancestry, `ship-3d-plan`, `ship-3d-plan-audit`, `editors-v2-landing-plan`, `editors-v2-landing-plan-audit`, `paid-app-plan-reaudit` and `ship-readiness-audit` are inside train 1, and `pixi-3d-beta-3` is inside `pixi-3d-public`. They are IN THE QUEUE, not DOCS TO GATHER.
- `claude/merge-train-2` does not exist yet. Its three branches (`pixi-3d-public`, `3d-night-regression`, `painter-figure-look`) are listed IN THE QUEUE.
- Ten open pull requests are not in the queue (#574, #575, #578, #596-#600, #605, #606), plus #431, which is the release tool's. Most are superseded by main; **#599 is not**. See HELD.

## How this was made

- Fetched with `git fetch --unshallow` and `git fetch origin '+refs/heads/*:refs/remotes/origin/*'`. Head, date, ahead and behind come from `git rev-list --left-right --count origin/main...origin/<branch>` ("ahead/behind" below is branch-ahead / branch-behind).
- Pull requests: GitHub `list_pull_requests` (open, all pages) gave the open list; `refs/pull/N/head` from `git ls-remote` matched branch heads to numbers; for the thirteen, the closed ones and the older branches I asked GitHub for the PR by head branch (state all). A branch whose pull request I matched only by `ls-remote` ("none found" below for queue branches made in the last day) could have a closed pull request whose head moved later; that is how #573 was found on `2ts3yn`.
- Content test: `git merge-tree --write-tree origin/main <branch>` (exit status and tree compared with `origin/main^{tree}`), `git cherry origin/main <branch>` (commits whose patch is not on main), and for every file the branch changed since its merge base, its blob compared with main's ("identical on main"), and whether main changed that path since ("changed on main since", i.e. superseded or rewritten) or not ("not on main"). Where a branch's work might sit in the queue, the same blob test ran against each queue tip, and `git merge-base --is-ancestor` against each queue branch.
- "Not on main by patch" counts commits whose diff is not on main; a rebased or re-done commit still counts. A file "changed on main since" can mean the same work done another way: where that matters I read the diffs and say so in the row.
- Scrapped game: `git ls-tree -d <branch> games/the-last-light` over every branch. Exactly eight carry it.
- Many `claude/project-thread-*` branches share one ancestor line. Merge base with main: `22d41ddc` for `fxu792`, `szjdbh`, `6jkni8`, `8a7mg5`, `dbrboz`, `nkdoj4`, `dg0n6n`, `77gue8`; `30667aa3` for `2ts3yn`, `9gzvdb`, `ijn4te`, `q3zxgn`; `hvpv4a` alone on `c68a666a`. Inside those, `fxu792` is the root; `szjdbh` then splits into `8a7mg5` then `dbrboz` (the "every editor free on the web" tip) and `nkdoj4` then `dg0n6n` then `77gue8` (the saving and sync tip); `6jkni8`, `q3zxgn`, `ijn4te`, `9gzvdb` then `2ts3yn` is a second chain. Each still has its own row.

## MERGED (1)

| Branch | Head | Last commit | Ahead/behind | Pull request | Evidence and reason |
|---|---|---|---|---|---|
| `claude/shared-polish-emberwick-site` | `280f00ec` | 2026-11-11 | 0/451 | none found | tree identical to main; 0 commits not on main by patch; of 0 files it changed: 0 identical on main, 0 changed on main since, 0 not on main. 0 commits ahead of main: its head is an ancestor of main. (No pull request found for it by head ref.) |

## IN THE QUEUE (33)

| Branch | Head | Last commit | Ahead/behind | Pull request | Evidence and reason |
|---|---|---|---|---|---|
| `claude/merge-train-1` | `f332d94d` | 2026-11-13 | 90/0 | none found | merges cleanly, tree differs; 77 commits not on main by patch; of 157 files it changed: 0 identical on main, 0 changed on main since, 157 not on main. Train 1 itself: 90 ahead, 0 behind main. Carries every branch marked "in train 1" below. |
| `claude/editor-journeys-green` | `d9437e94` | 2026-11-12 | 5/29 | #671 open | merges cleanly, tree differs; 4 commits not on main by patch; of 21 files it changed: 0 identical on main, 0 changed on main since, 21 not on main. In train 1: an ancestor of `claude/merge-train-1`. |
| `claude/default-screens-focus` | `0dc6fed1` | 2026-11-13 | 6/3 | none found | merges cleanly, tree differs; 6 commits not on main by patch; of 7 files it changed: 0 identical on main, 0 changed on main since, 7 not on main. In train 1: an ancestor of `claude/merge-train-1`. |
| `claude/emberwick-journey-speed` | `800bede8` | 2026-11-13 | 4/29 | none found | merges cleanly, tree differs; 4 commits not on main by patch; of 5 files it changed: 0 identical on main, 0 changed on main since, 5 not on main. In train 1: an ancestor of `claude/merge-train-1`. |
| `claude/typed-words-saved` | `cd01f69d` | 2026-11-13 | 20/29 | none found | merges cleanly, tree differs; 20 commits not on main by patch; of 74 files it changed: 0 identical on main, 0 changed on main since, 74 not on main. In train 1: an ancestor of `claude/merge-train-1`. |
| `claude/desktop-games` | `ad54d831` | 2026-11-13 | 16/29 | none found | merges cleanly, tree differs; 16 commits not on main by patch; of 36 files it changed: 0 identical on main, 0 changed on main since, 36 not on main. In train 1: an ancestor of `claude/merge-train-1`. |
| `claude/ship-docs` | `0470b938` | 2026-11-13 | 32/3 | none found | merges cleanly, tree differs; 26 commits not on main by patch; of 13 files it changed: 0 identical on main, 0 changed on main since, 13 not on main. In train 1: an ancestor of `claude/merge-train-1`. Holds 13 docs files: ship-3d plan, survey, audit; editors-v2-landing plan, audit, survey; apps plan and spec; ship-readiness; paid-app re-audit. |
| `claude/ship-3d-plan` | `c9c2b990` | 2026-11-12 | 7/36 | none found | merge conflicts with main; 7 commits not on main by patch; of 4 files it changed: 0 identical on main, 1 changed on main since, 3 not on main. In train 1: an ancestor of `claude/merge-train-1`. Docs only. In train 1 through ancestry, so not a separate docs job. |
| `claude/ship-3d-plan-audit` | `e0489de7` | 2026-11-12 | 11/36 | none found | merge conflicts with main; 11 commits not on main by patch; of 5 files it changed: 0 identical on main, 1 changed on main since, 4 not on main. In train 1: an ancestor of `claude/merge-train-1`. Docs only. In train 1 through ancestry. |
| `claude/editors-v2-landing-plan` | `fdae6f18` | 2026-11-12 | 3/36 | none found | merge conflicts with main; 3 commits not on main by patch; of 3 files it changed: 0 identical on main, 1 changed on main since, 2 not on main. In train 1: an ancestor of `claude/merge-train-1`. Docs only. In train 1 through ancestry. |
| `claude/editors-v2-landing-plan-audit` | `b9892a25` | 2026-11-12 | 4/36 | none found | merge conflicts with main; 4 commits not on main by patch; of 4 files it changed: 0 identical on main, 1 changed on main since, 3 not on main. In train 1: an ancestor of `claude/merge-train-1`. Docs only. In train 1 through ancestry. |
| `claude/paid-app-plan-reaudit` | `b2926835` | 2026-11-12 | 1/36 | none found | merges cleanly, tree differs; 1 commits not on main by patch; of 4 files it changed: 0 identical on main, 1 changed on main since, 3 not on main. In train 1: an ancestor of `claude/merge-train-1`. Docs only. In train 1 through ancestry. |
| `claude/ship-readiness-audit` | `dd8612ca` | 2026-11-12 | 6/40 | none found | merge conflicts with main; 6 commits not on main by patch; of 2 files it changed: 0 identical on main, 1 changed on main since, 1 not on main. In train 1: an ancestor of `claude/merge-train-1`. Docs only. In train 1 through ancestry. |
| `claude/duel-snap-speed` | `2efb8452` | 2026-11-13 | 10/3 | none found | merges cleanly, tree differs; 10 commits not on main by patch; of 18 files it changed: 0 identical on main, 0 changed on main since, 18 not on main. Named in the queue. Not an ancestor of any other queue branch. |
| `claude/share-after-reload` | `3ba3377b` | 2026-11-13 | 22/29 | none found | merges cleanly, tree differs; 22 commits not on main by patch; of 79 files it changed: 0 identical on main, 0 changed on main since, 79 not on main. Named in the queue. Contains `typed-words-saved` (so also train 1's typed-words commits). |
| `claude/example-set-start` | `d3a4d855` | 2026-11-13 | 19/0 | none found | merges cleanly, tree differs; 17 commits not on main by patch; of 113 files it changed: 0 identical on main, 0 changed on main since, 113 not on main. Named in the queue. 19 ahead, 0 behind main. |
| `claude/example-set-f1` | `ea167e28` | 2026-11-13 | 3/22 | none found | merges cleanly, tree differs; 3 commits not on main by patch; of 43 files it changed: 0 identical on main, 0 changed on main since, 43 not on main. In `claude/example-set-start`: an ancestor of it. |
| `claude/example-set-f3` | `bf60592f` | 2026-11-13 | 9/22 | none found | merge conflicts with main; 9 commits not on main by patch; of 89 files it changed: 0 identical on main, 1 changed on main since, 88 not on main. In `claude/example-set-start`: an ancestor of it. |
| `claude/example-set-world` | `5212b7bd` | 2026-11-13 | 4/22 | none found | merges cleanly, tree differs; 4 commits not on main by patch; of 16 files it changed: 0 identical on main, 1 changed on main since, 15 not on main. In `claude/example-set-start`: an ancestor of it. |
| `claude/last-light-salvage` | `dca3439f` | 2026-11-13 | 13/0 | none found | merges cleanly, tree differs; 13 commits not on main by patch; of 137 files it changed: 0 identical on main, 0 changed on main since, 137 not on main. Named in the queue. 13 ahead, 0 behind main; its map doc lists the game's generic work. |
| `claude/scope-rename` | `673db5e9` | 2026-11-12 | 5/36 | none found | merge conflicts with main; 5 commits not on main by patch; of 2200 files it changed: 0 identical on main, 9 changed on main since, 2191 not on main. Named in the queue. 2,200 files changed (the scope rename). |
| `claude/editors-v2-landing` | `bc8f5729` | 2026-11-13 | 76/29 | none found | merge conflicts with main; 67 commits not on main by patch; of 524 files it changed: 0 identical on main, 2 changed on main since, 522 not on main. Named in the queue. Contains five of the thirteen restored branches (fxu792, 6jkni8, q3zxgn, ijn4te, 9gzvdb), see below. |
| `claude/coordinator-notes` | `4578e2bf` | 2026-11-13 | 6/36 | none found | merges cleanly, tree differs; 6 commits not on main by patch; of 4 files it changed: 0 identical on main, 1 changed on main since, 3 not on main. Named in the queue. Docs only. |
| `claude/branch-inventory` | `a234a3a2` | 2026-11-12 | 0/0 | none | tree identical to main; 0 commits not on main by patch; of 0 files it changed: 0 identical on main, 0 changed on main since, 0 not on main. This audit. Same commit as main until its README lands. |
| `claude/pixi-3d-public` | `4663e737` | 2026-11-13 | 48/22 | none found | merges cleanly, tree differs; 41 commits not on main by patch; of 184 files it changed: 0 identical on main, 0 changed on main since, 184 not on main. Named for train 2. |
| `claude/pixi-3d-beta-3` | `b25ec539` | 2026-11-12 | 34/69 | none found | merge conflicts with main; 29 commits not on main by patch; of 129 files it changed: 0 identical on main, 7 changed on main since, 122 not on main. In `pixi-3d-public`: an ancestor of it (29 commits). Not named in the brief; contained by ancestry. |
| `claude/3d-night-regression` | `35f9a7da` | 2026-11-13 | 12/29 | none found | merges cleanly, tree differs; 12 commits not on main by patch; of 38 files it changed: 0 identical on main, 0 changed on main since, 38 not on main. Named for train 2. |
| `claude/painter-figure-look` | `c7311579` | 2026-11-12 | 24/66 | #664 open | merges cleanly, tree differs; 23 commits not on main by patch; of 64 files it changed: 0 identical on main, 12 changed on main since, 52 not on main. Named for train 2. Open pull request (draft: no). |
| `claude/project-thread-fxu792` | `5cf0825b` | 2026-11-08 | 42/1056 | #522 closed 2026-11-12 21:01 (unmerged) | merge conflicts with main; 36 commits not on main by patch; of 891 files it changed: 475 identical on main, 240 changed on main since, 176 not on main. Every commit is in `claude/editors-v2-landing` (an ancestor of it). Delete after that lands. The pull request is still closed, though the branch was restored. |
| `claude/project-thread-6jkni8` | `3736b0ac` | 2026-11-08 | 44/1056 | #534 closed 2026-11-12 21:01 (unmerged) | merge conflicts with main; 38 commits not on main by patch; of 911 files it changed: 473 identical on main, 243 changed on main since, 195 not on main. Every commit is in `claude/editors-v2-landing` (an ancestor of it). Delete after that lands. The pull request is still closed, though the branch was restored. |
| `claude/project-thread-q3zxgn` | `68cdd642` | 2026-11-09 | 61/1028 | #559 closed 2026-11-12 21:01 (unmerged) | merge conflicts with main; 52 commits not on main by patch; of 517 files it changed: 6 identical on main, 114 changed on main since, 397 not on main. Every commit is in `claude/editors-v2-landing` (an ancestor of it). Delete after that lands. The pull request is still closed, though the branch was restored. |
| `claude/project-thread-ijn4te` | `43907511` | 2026-11-09 | 62/1028 | #562 closed 2026-11-12 21:01 (unmerged) | merge conflicts with main; 53 commits not on main by patch; of 521 files it changed: 6 identical on main, 114 changed on main since, 401 not on main. Every commit is in `claude/editors-v2-landing` (an ancestor of it). Delete after that lands. The pull request is still closed, though the branch was restored. |
| `claude/project-thread-9gzvdb` | `47391563` | 2026-11-09 | 63/1028 | #567 closed 2026-11-12 21:01 (unmerged) | merge conflicts with main; 54 commits not on main by patch; of 537 files it changed: 6 identical on main, 116 changed on main since, 415 not on main. Every commit is in `claude/editors-v2-landing` (an ancestor of it). Delete after that lands. The pull request is still closed, though the branch was restored. |

## DOCS TO GATHER (5)

| Branch | Head | Last commit | Ahead/behind | Pull request | Evidence and reason |
|---|---|---|---|---|---|
| `claude/example-set-plan` | `73833f3e` | 2026-11-13 | 6/36 | none found | merges cleanly, tree differs; 6 commits not on main by patch; of 5 files it changed: 0 identical on main, 1 changed on main since, 4 not on main. Docs only. All five docs paths exist in `example-set-start`, but with different content: this branch carries the coordinator's later rulings (73833f3e). 4 of 6 commits are not in train 1. |
| `claude/example-set-plan-audit` | `5ce4efbf` | 2026-11-13 | 8/36 | none found | merges cleanly, tree differs; 8 commits not on main by patch; of 6 files it changed: 0 identical on main, 1 changed on main since, 5 not on main. Docs only (adds the plan audit README). Paths exist in `example-set-start` with different content; 6 of 8 commits are not in train 1. The audit README is on no queued branch except as a path in `example-set-start`. |
| `claude/builders-look-plan` | `e7fac70e` | 2026-11-11 | 1/551 | #636 merged | merge conflicts with main; 1 commits not on main by patch; of 2 files it changed: 0 identical on main, 2 changed on main since, 0 not on main. Docs only. Its pull request merged; this is one commit made after the merge (the plan takes the coordinator's answers, 2 files). Main's copy of the plan was rewritten since (de0ea499f), so the commit is probably superseded. Confirm, then delete. |
| `claude/eb-source-ref` | `56901a87` | 2026-11-11 | 2/716 | none found | merges cleanly, tree differs; 2 commits not on main by patch; of 19 files it changed: 0 identical on main, 0 changed on main since, 19 not on main. Docs only: 19 files under `docs/refactor/eb-look/source/` (the look port's source reference, record only). Not on main or any queued branch. |
| `claude/examples-look-audit` | `5de12c7f` | 2026-11-13 | 1/29 | none found | merges cleanly, tree differs; 1 commits not on main by patch; of 191 files it changed: 0 identical on main, 0 changed on main since, 191 not on main. Docs only: 191 files under `docs/superpowers/audits/2026-11-13-examples-look/` (mostly screenshots; "stopped unfinished on the Owner's word"). Not on main or any queued branch. |

## SCRAPPED, TAG FIRST (8)

| Branch | Head | Last commit | Ahead/behind | Pull request | Evidence and reason |
|---|---|---|---|---|---|
| `claude/last-light-prologue` | `61070fa9` | 2026-11-13 | 231/22 | none found | merges cleanly, tree differs; 213 commits not on main by patch; of 879 files it changed: 0 identical on main, 3 changed on main since, 876 not on main. Carries `games/the-last-light`. |
| `claude/last-light-camera` | `4eddc7b8` | 2026-11-13 | 192/51 | none found | merges cleanly, tree differs; 177 commits not on main by patch; of 779 files it changed: 0 identical on main, 4 changed on main since, 775 not on main. Carries `games/the-last-light`. |
| `claude/last-light-camera-back` | `7c207cd6` | 2026-11-13 | 236/22 | none found | merges cleanly, tree differs; 218 commits not on main by patch; of 895 files it changed: 0 identical on main, 3 changed on main since, 892 not on main. Carries `games/the-last-light`. |
| `claude/last-light-ada` | `321d1948` | 2026-11-13 | 208/51 | none found | merges cleanly, tree differs; 193 commits not on main by patch; of 778 files it changed: 0 identical on main, 4 changed on main since, 774 not on main. Carries `games/the-last-light`. |
| `claude/last-light-ada-build` | `7c0a4ca3` | 2026-11-13 | 241/22 | none found | merges cleanly, tree differs; 223 commits not on main by patch; of 887 files it changed: 0 identical on main, 3 changed on main since, 884 not on main. Carries `games/the-last-light`. |
| `claude/last-light-atmosphere` | `64203497` | 2026-11-13 | 237/22 | none found | merges cleanly, tree differs; 219 commits not on main by patch; of 897 files it changed: 0 identical on main, 3 changed on main since, 894 not on main. Carries `games/the-last-light`. |
| `claude/last-light-figures-look` | `6abfc17e` | 2026-11-12 | 123/275 | none found | merge conflicts with main; 111 commits not on main by patch; of 547 files it changed: 0 identical on main, 14 changed on main since, 533 not on main. Carries `games/the-last-light`. |
| `claude/last-light-editors-stress` | `cbbfa437` | 2026-11-12 | 179/51 | none found | merges cleanly, tree differs; 164 commits not on main by patch; of 730 files it changed: 0 identical on main, 4 changed on main since, 726 not on main. Carries `games/the-last-light`. Also holds a docs audit (`docs/superpowers/audits/2026-11-12-last-light-editors-stress.md` and 269 screenshots) of the editors, and a few generic framework commits (letterbox, follow camera, play context). The generic work is what `last-light-salvage` maps; the audit rides in the tag. |

## HELD FOR THE OWNER (11)

| Branch | Head | Last commit | Ahead/behind | Pull request | Evidence and reason |
|---|---|---|---|---|---|
| `claude/painter-hands` | `f1317c90` | 2026-11-12 | 12/51 | none found | merge conflicts with main; 12 commits not on main by patch; of 59 files it changed: 0 identical on main, 2 changed on main since, 57 not on main. Waits for the Owner's yes on a sheet (per the brief). 12 commits, 59 files, 47 of them docs. Not on main or a queued branch. |
| `claude/clinic-1` | `4889076e` | 2026-11-11 | 10/682 | #596 open (draft) | merge conflicts with main; 10 commits not on main by patch; of 69 files it changed: 0 identical on main, 14 changed on main since, 55 not on main. The Last Light's clinic in the 3D level, batch 1 (lamp kinds, trim bands, model props, the converted level, 11 frames). Game-driven engine work; none of its files is identical on main or on a queued branch. **Recommend:** tag, then close the pull request and delete, after checking `last-light-salvage`'s map for what it already took. |
| `claude/clinic-2` | `1eec63df` | 2026-11-11 | 28/574 | #606 open (draft) | merge conflicts with main; 27 commits not on main by patch; of 137 files it changed: 0 identical on main, 20 changed on main since, 117 not on main. The clinic in level3d, batch 2 (framing, kit furniture, the editor ledger). 28 ahead; same reasoning as clinic-1. **Recommend:** tag, close, delete. |
| `claude/clinic-level3d` | `5e7489cb` | 2026-11-10 | 5/724 | #575 open (draft) | merges cleanly, tree differs; 5 commits not on main by patch; of 2 files it changed: 0 identical on main, 0 changed on main since, 2 not on main. Docs only: the clinic's gap analysis and design (2 files). The game is scrapped. **Recommend:** tag, close, delete. |
| `claude/character-kit-diagnosis` | `5718bcbc` | 2026-11-10 | 2/724 | #574 open (draft) | merge conflicts with main; 2 commits not on main by patch; of 11 files it changed: 0 identical on main, 2 changed on main since, 9 not on main. Docs plus a diagnosis example and fixture (11 files): why the kit does not look like FigureBuilder. Main has since folded the figures (#661, #669). **Recommend:** the Owner decides; tag and close is the safe default. |
| `claude/elegant-bell-1icwyb` | `9b40160b` | 2026-11-10 | 1/723 | #578 open (draft) | merge conflicts with main; 1 commits not on main by patch; of 6 files it changed: 0 identical on main, 5 changed on main since, 1 not on main. Doc comments for STICK_DIRECTIONS, Picture and PROMPT_COPY. Main's `docs/cheatsheet.md` and the agent API reference already mention them, so main has done this another way. **Recommend:** close and delete. |
| `claude/fix-3d-story-journeys` | `149864a1` | 2026-11-11 | 1/662 | #597 open (draft) | merge conflicts with main; 1 commits not on main by patch; of 2 files it changed: 1 identical on main, 1 changed on main since, 0 not on main. Drops the removed `--app` flag from the 3D story's editor server. Main has it: `af1e7bc05`. **Recommend:** close and delete. |
| `claude/fix-schematic-journey-flakes` | `d01c1404` | 2026-11-11 | 3/662 | #598 open | merge conflicts with main; 3 commits not on main by patch; of 4 files it changed: 1 identical on main, 3 changed on main since, 0 not on main. Three Schematic journey fixes. Main fixed the same flakes another way: `3ae60bdc2`, `92b708f24` (2D), `af1e7bc05` (3D). The branch's mode-observer is not on main, which waits on the log instead. **Recommend:** close and delete. |
| `claude/fix-examples-3d-figures` | `4402e8f6` | 2026-11-11 | 1/662 | #599 open | merge conflicts with main; 1 commits not on main by patch; of 6 files it changed: 0 identical on main, 1 changed on main since, 5 not on main. The figures journeys wait on the sim's clock (`sampleForSimTicks`, `data-tick`), not the wall clock. **Not on main**: main's `figures-aim.test.ts` has no such wait and `tooling/examples-runner/host/testing.ts` lacks the helper. **Recommend:** merge it (rebase onto main first: the branch is 662 behind). |
| `claude/fix-content-hmr-flake` | `44c8fa3b` | 2026-11-11 | 2/662 | #600 open (draft) | merge conflicts with main; 2 commits not on main by patch; of 3 files it changed: 0 identical on main, 2 changed on main since, 1 not on main. HMR test fixes. Main re-fixed it: `259d40a1d`, `4f6301070`. The branch's test rewrite and changeset are not on main. **Recommend:** close and delete. |
| `claude/fix-site-examples-flake` | `a82b3413` | 2026-11-11 | 2/634 | #605 open | merge conflicts with main; 2 commits not on main by patch; of 2 files it changed: 0 identical on main, 2 changed on main since, 0 not on main. The example page test waits for the lazy runtime. Main has the same fix: `75bcbbfa3`. **Recommend:** close and delete. |

## UNMERGED, DECIDE (11)

| Branch | Head | Last commit | Ahead/behind | Pull request | Evidence and reason |
|---|---|---|---|---|---|
| `claude/complete-game-journeys` | `cf6a8e6a` | 2026-11-09 | 24/1056 | #508 closed 2026-11-12 21:01 (unmerged) | merge conflicts with main; 18 commits not on main by patch; of 776 files it changed: 500 identical on main, 197 changed on main since, 79 not on main. 17 of its 18 commits are in `claude/editors-v2-landing` by patch. The one not in it, `cf6a8e6a7` ("the layout tests pass on the joined editor branches", 2 test files), touches files that `editors-v2-landing` has changed since. **Recommend:** delete after `editors-v2-landing` lands (re-read that one commit first). |
| `claude/project-thread-szjdbh` | `829039d5` | 2026-11-08 | 43/1056 | #532 closed 2026-11-12 21:01 (unmerged) | merge conflicts with main; 37 commits not on main by patch; of 894 files it changed: 468 identical on main, 246 changed on main since, 180 not on main. One commit of its own (`829039d50`: every editor free on the web, with a browser-kept sample; 35 files, e.g. `site/src/features/editor/EditorPage.svelte`). No identical file on main or a queued branch; main and the queue have no `site/src/features/editor/`. It is an ancestor of `8a7mg5`, `dbrboz`, `nkdoj4`, `dg0n6n`, `77gue8`, so tagging those keeps it. **Recommend:** keep until the Owner rules on the "every editor free on the web" line; see the stack note. |
| `claude/project-thread-8a7mg5` | `5c3ff908` | 2026-11-08 | 44/1056 | #545 closed 2026-11-12 21:01 (unmerged) | merge conflicts with main; 38 commits not on main by patch; of 895 files it changed: 468 identical on main, 246 changed on main since, 181 not on main. `szjdbh` plus one docs commit: the build audit of #532. Not on main or the queue. **Recommend:** same as `szjdbh`; the audit doc `docs/refactor/2026-11-08-every-editor-free-build-audit.md` rides with `dbrboz`. |
| `claude/project-thread-dbrboz` | `3c2c37f5` | 2026-11-09 | 47/1056 | #548 closed 2026-11-12 21:01 (unmerged) | merge conflicts with main; 41 commits not on main by patch; of 997 files it changed: 458 identical on main, 266 changed on main since, 273 not on main. Tip of the "every editor free on the web" stack: #532, #545 and #548's fixes (open the editors in any order; the audit's M4-M6 and L1-L3; a deploy refusal while Pixi 3D is the vendored beta, `tooling/release/src/check-pixi3d-public.ts`). Five commits are on no queued branch; no file identical on main or the queue. **Recommend:** keep, or tag and delete if the Owner drops the line. Do not delete without the tag. |
| `claude/project-thread-nkdoj4` | `f380d358` | 2026-11-09 | 64/1056 | #544 closed 2026-11-12 21:01 (unmerged) | merge conflicts with main; 58 commits not on main by patch; of 1005 files it changed: 461 identical on main, 264 changed on main since, 280 not on main. The saving and GitHub sign-in build (phases 0-5): games kept in the browser, sign-in with GitHub, sync. Ancestor of `dg0n6n` and `77gue8`. `typed-words-saved` (in train 1) re-does only the typed-words slice and drops the saved line's sign-in inputs; the games-in-browser and GitHub parts are on no queued branch. **Recommend:** keep until the Owner rules; tag the tip `77gue8`. |
| `claude/project-thread-dg0n6n` | `ecfccbf2` | 2026-11-09 | 69/1056 | #560 closed 2026-11-12 21:01 (unmerged) | merge conflicts with main; 60 commits not on main by patch; of 1007 files it changed: 461 identical on main, 265 changed on main since, 281 not on main. `nkdoj4` plus its build audit (#560); ancestor of `77gue8`. **Recommend:** same as `nkdoj4`. |
| `claude/project-thread-77gue8` | `cc10fdfd` | 2026-11-09 | 74/1056 | #564 closed 2026-11-12 21:01 (unmerged) | merge conflicts with main; 61 commits not on main by patch; of 1020 files it changed: 460 identical on main, 266 changed on main since, 294 not on main. Tip of the saving and sync stack: #532, #544, #560 and #564 ("keep typed words and say when GitHub has them"). 21 commits are on no queued branch by subject; 61 not on main by patch. **Recommend:** tag now; the Owner decides whether to reopen #564 as a draft or retire the line. |
| `claude/project-thread-hvpv4a` | `714796a2` | 2026-11-09 | 24/1521 | #531 closed 2026-11-12 21:01 (unmerged) | merge conflicts with main; 22 commits not on main by patch; of 127 files it changed: 0 identical on main, 40 changed on main since, 87 not on main. The apps build's first session: `apps/editor`, content compile in the page, new-game files, the editor kit's git engine and GitHub sign-in, an iPad-first plan update. 22 commits, not on main or the queue (no `apps/` on main or any queued branch); its plan and spec docs are in train 1. Not an ancestor of anything. **Recommend:** keep until the paid-app work resumes; tag it now. |
| `claude/project-thread-2ts3yn` | `c7e70b98` | 2026-11-13 | 87/1028 | #573 closed (unmerged; "build the painted look, tasks 1-2") | merge conflicts with main; 78 commits not on main by patch; of 984 files it changed: 6 identical on main, 163 changed on main since, 815 not on main. Contains the v2 chain (an ancestor-superset of `9gzvdb`) plus the painted-look port in `packages/3d`: 157 source files under `features/{photo,world,figures,look}`, absent from main. Main has since folded the same work into `extensions/figures` and `extensions/world-kit` (#661, #669), and `packages/3d` on main has no `features/photo`. Last commit 2026-11-13. **Recommend:** tag, then delete (the work was done again another way). |
| `claude/figurebuilder-pixi3d` | `9b123b18` | 2026-11-10 | 5/724 | #576 closed 2026-11-10 17:48 (unmerged) | merge conflicts with main; 5 commits not on main by patch; of 98 files it changed: 1 identical on main, 5 changed on main since, 92 not on main. FigureBuilder's painted figures in the Pixi 3D renderer; 5 commits, 98 files, 1 identical on main. Superseded by the figures extension and the builders' fold on main. Closed on 2026-11-10, before the 2026-11-12 deletion. **Recommend:** tag, then delete. |
| `claude/fix-2d-story-journeys` | `e6e27291` | 2026-11-11 | 2/682 | #591 closed 2026-11-11 (unmerged) | merge conflicts with main; 2 commits not on main by patch; of 3 files it changed: 1 identical on main, 2 changed on main since, 0 not on main. Fix for the 2D journeys job. Main has the same fixes: `3ae60bdc2` (the `--app` flag), `92b708f24` (the Follow journey waits for the saved switch). **Recommend:** delete. |

## NOT OURS (1)

| Branch | Head | Last commit | Ahead/behind | Pull request | Evidence and reason |
|---|---|---|---|---|---|
| `changeset-release/main` | `e9b5a8a7` | 2026-11-13 | 1/0 | #431 open | merges cleanly, tree differs; 1 commits not on main by patch; of 108 files it changed: 0 identical on main, 0 changed on main since, 108 not on main. The release tool's branch ("Version packages"). Leave it. |

## The stacks and the thirteen, where each stands

| PR | Branch | State of the work |
|---|---|---|
| #508 | `claude/complete-game-journeys` | 17 of 18 commits in `editors-v2-landing`; one test-fix commit left (see UNMERGED). |
| #522 | `claude/project-thread-fxu792` | Inside `editors-v2-landing`. |
| #534 | `claude/project-thread-6jkni8` | Inside `editors-v2-landing`. |
| #559 | `claude/project-thread-q3zxgn` | Inside `editors-v2-landing`. |
| #562 | `claude/project-thread-ijn4te` | Inside `editors-v2-landing`. |
| #567 | `claude/project-thread-9gzvdb` | Inside `editors-v2-landing`. |
| #531 | `claude/project-thread-hvpv4a` | On no queued branch, not on main. Keep, tag. |
| #532 | `claude/project-thread-szjdbh` | Its commit is carried by the `dbrboz` and `77gue8` tips; on no queued branch. |
| #545 | `claude/project-thread-8a7mg5` | Carried by the `dbrboz` tip. |
| #548 | `claude/project-thread-dbrboz` | Tip of the web-editor stack; on no queued branch. |
| #544 | `claude/project-thread-nkdoj4` | Carried by the `77gue8` tip; on no queued branch. |
| #560 | `claude/project-thread-dg0n6n` | Carried by the `77gue8` tip. |
| #564 | `claude/project-thread-77gue8` | Tip of the saving and sync stack; on no queued branch. |

Reopening: GitHub lets a closed pull request be reopened while its head branch exists. All thirteen heads exist today. Reopen, or retire the line on purpose, before the branches go.

## For the Owner: commands (not run by the audit)

Run these from a clone that has fetched `origin`. The tags use the full head SHA as of this audit, so they keep the work even if a branch moves.

### (a) Tags to create and push

The scrapped game. AGENTS.md says a tag does the job of a backup branch:

```sh
git tag archive/claude/last-light-prologue 61070fa988e08c4df2246e296bdcb783860d7fee
git tag archive/claude/last-light-camera 4eddc7b8e649bf3e311cc708c2ff238ff660a9ee
git tag archive/claude/last-light-camera-back 7c207cd6e593fe861b504884660c4abda14b6a6c
git tag archive/claude/last-light-ada 321d19486ac63e33843f0c607cc065aaa04b96f4
git tag archive/claude/last-light-ada-build 7c0a4ca3aefc885fbd6e4372ee38a331daee25de
git tag archive/claude/last-light-atmosphere 642034977a90f7bbbcecc8b8f934bc1a5d534f5f
git tag archive/claude/last-light-figures-look 6abfc17eeefbad131df2afeec31e3c0d9e2899ba
git tag archive/claude/last-light-editors-stress cbbfa437a74723d8892847180d19d4558d25f75d
git push origin refs/tags/archive/claude/last-light-prologue refs/tags/archive/claude/last-light-camera refs/tags/archive/claude/last-light-camera-back refs/tags/archive/claude/last-light-ada refs/tags/archive/claude/last-light-ada-build refs/tags/archive/claude/last-light-atmosphere refs/tags/archive/claude/last-light-figures-look refs/tags/archive/claude/last-light-editors-stress
```

Tag and delete, recommended by this audit (the Owner's call; each has no queued home). `2ts3yn` and `figurebuilder-pixi3d` are redone on main; the clinic and character-kit branches carry the scrapped game's engine work:

```sh
git tag archive/claude/project-thread-2ts3yn c7e70b9813ba732c55827a0770318bb5d8343b49
git tag archive/claude/figurebuilder-pixi3d 9b123b181ccc332b200e2ccab135cc98aa81d564
git tag archive/claude/clinic-1 4889076e77d0164cf4667bd0c19edb7cce0e3066
git tag archive/claude/clinic-2 1eec63dff2e8e6d2dc41b04bdc2f457f4ef054e4
git tag archive/claude/clinic-level3d 5e7489cbfe89aeb647da2d3d7eeee31de25d5fcd
git tag archive/claude/character-kit-diagnosis 5718bcbcd1be1c72b7dfb2d4a190701a2d87722f
git push origin refs/tags/archive/claude/project-thread-2ts3yn refs/tags/archive/claude/figurebuilder-pixi3d refs/tags/archive/claude/clinic-1 refs/tags/archive/claude/clinic-2 refs/tags/archive/claude/clinic-level3d refs/tags/archive/claude/character-kit-diagnosis
```

Insurance tags for work that is on no queued branch and not on main, so it survives whatever is decided about the web-editor, sync and apps lines (the two tips cover all of #532, #544, #545, #548, #560, #564):

```sh
git tag archive/claude/project-thread-77gue8 cc10fdfdf40523d1fdb10200e9dd651774983b7c
git tag archive/claude/project-thread-dbrboz 3c2c37f5bae53b6886373309c63fc2110845ccaa
git tag archive/claude/project-thread-hvpv4a 714796a2f9452a155b53c771554ca49651c8533e
git tag archive/claude/fix-examples-3d-figures 4402e8f65382fec64c8de288309d6a0c05dc1259
git push origin refs/tags/archive/claude/project-thread-77gue8 refs/tags/archive/claude/project-thread-dbrboz refs/tags/archive/claude/project-thread-hvpv4a refs/tags/archive/claude/fix-examples-3d-figures
```

### (b) Deletions: only the branches whose verdict is MERGED today

One branch qualifies. More become safe once the queue lands (see IN THE QUEUE) and once the Owner rules on the rest; this audit does not list those here.

```sh
# Safe: each head is an ancestor of origin/main, so everything on it is already on main; none has an open pull request.
git push origin --delete claude/shared-polish-emberwick-site
```
