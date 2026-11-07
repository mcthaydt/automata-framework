# Bringing automata-skills up to date: progress

The Owner, 2026-11-07: "Have we been updating automata-skills, I know we worked on automata-plus", then "Oh, let's
handle that". Each stage runs in its own thread and hands off through the documents listed here. From stage 2 on they
live in the framework's `docs/refactor/` (audit decision D1 A); `mcthaydt/automata-skills` stays output only.

**Progress: 3 of 6 stages done (50%).**

| Stage | Status | Document | Pull request |
|---|---|---|---|
| 1. Audit | Done, 2026-11-07 | [2026-11-07-skills-audit.md](2026-11-07-skills-audit.md) (moved here; first written in automata-skills PR #1) | automata-skills #1, `claude/project-thread-l4q4y1` |
| 2. Plan and spec | Done, 2026-11-07 (accepted under "Auto accept all spec and plans") | [spec](2026-11-07-skills-spec.md), [plan](2026-11-07-skills-plan.md) | `claude/project-thread-wd20yh`, stacked on #444 |
| 3. Plan audit | Done, 2026-11-07: 15 findings, fixed in place | [2026-11-07-skills-plan-audit.md](2026-11-07-skills-plan-audit.md) | #446, same branch |
| 4. Build | Not started (5 parts, 17 tasks) | | |
| 5. Build audit | Not started | | |
| 6. Fixes | Not started | | |

## Build tracking

| Task | Part | Status |
|---|---|---|
| 1.1 Mirror generator | 1 | Not started |
| 1.2 Release job and checks use it | 1 | Not started |
| 1.3 Part 1 close | 1 | Not started |
| 2.1 Declarations only (C1) | 2 | Not started |
| 2.2 What the reference leaves out (C2) | 2 | Not started |
| 2.3 Only published packages (D2 A) | 2 | Not started |
| 2.4 Both builder names (T3) | 2 | Not started |
| 2.5 Part 2 close | 2 | Not started |
| 3.1 Editor skill (C3) | 3 | Not started |
| 3.2 One sim import list (C4) | 3 | Not started |
| 3.3 Repository-only rules (C5) | 3 | Not started |
| 3.4 CSP, shipping, description (C6 to C8) | 3 | Not started |
| 3.5 `automata check` runs a workspace game's tests (M5) | 3 | Not started |
| 3.6 Part 3 close | 3 | Not started |
| 4.1 Install suite | 4 | Not started |
| 4.2 In release checks | 4 | Not started |
| 5.1 Site offers the plugin (after the first mirror push) | 5 | Not started |

## Hand-offs

- **Merge thread:** land part 1 before any `@automata/*` release, or the first mirror push has no marketplace file.
  Close automata-skills PR #1 once this PR merges (its audit now lives here). Closing #431 (V2) stays its call.
- **3D build ("Build the 3D slice"):** fold in spec section 7 (tasks 5.1, 5.2, 10.1, 11.1, 13.1, 13.2, 20.1). The audited
  3D plan (#445) did not.
- **Coordinator:** `automata check`'s test step on Emberwick ("failed to load config", audit M5) is now task 3.5 of
  this plan (stage 3). The 3D build thread has spec section 7's notes; tasks 2.3 and 2.4 say what to do if its 13.2 or
  10.1 lands first.
- **The Owner:** the npm organisation, `NPM_TOKEN`, the release approval and `SKILLS_TOKEN` (M4); one run of the install
  suite on the runner (task 4.2).

## Where stage 4 starts

Build with `superpowers:executing-plans`, natively (no subagents), Sonnet at high effort. Read the plan's Global
Constraints and Review Focus, then part 1. Part 1 lands before any `@automata/*` release. The plan's paths and lines
were checked at `8ee84442` (stage 3); recheck any line number against the stack head before editing it.
