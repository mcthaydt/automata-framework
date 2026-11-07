# Automata Plus as framework extensions: progress

**Overall: 33% (2 of 6 stages done).**

The Owner, 2026-11-07: "do automata-plus too" (11:19); then, on where: "Actually no make them extensions because
they're free anyway, and move the stuff 3D is doing here, and cut the starter" (15:05). Plus's packages are ported into
this repository as `extensions/<name>`, `@automata/sectors` and `@automata/cutscenes` replace what the 3D plan's tasks 7.1
and 7.4 would have written, and the starter is not ported. Six stages, each in its own session:

1. **Audit** (Opus, extra-high effort): what is there, measured.
2. **Plan and spec** (Opus, medium, with the superpowers plugin).
3. **Plan audit** (Opus, medium).
4. **Build** (Sonnet, high), updating this page as each step lands.
5. **Build audit** (Opus, medium): complete, consistent, matches the spec and the codebase.
6. **Fixes** (Sonnet, high): every finding from stage 5 closed.

Copy and UX pass the drunk grandma test: could a drunk grandma tell what is happening and how to use it?

| Stage | Status | Record |
|---|---|---|
| 1. Audit | Done, 2026-11-07, in `mcthaydt/automata-plus` PR #40 (head `4cb70b9`), moved here: C1 to C9, E1 to E4, L1 to L6, D1, G1 to G4, X1 to X4, P1 to P4; P-D1 to P-D11. P-D1: the Owner chose B (15:05) after A (15:02). `pnpm check` and the Chromium browser suites pass on Plus's pinned core | [audit](2026-11-07-plus-audit.md) |
| 2. Plan and spec | Done, 2026-11-07, with the superpowers plugin (`brainstorming`, `writing-plans`), native: P-D2 to P-D11 decided (P-D11 departs from the audit: B, because core never imports an extension); 3 parts, 4 phases, 19 tasks; the 3D plan's tasks 7.1, 7.4 and 12.1 change (spec section 9) | [spec](2026-11-07-plus-port-spec.md), [plan](2026-11-07-plus-port-plan.md) |
| 3. Plan audit | Not started | |
| 4. Build | Not started | |
| 5. Build audit | Not started | |
| 6. Fixes | Not started | |

## Where to resume (2026-11-07, stage 2 done)

The plan audit (Opus, medium, with the superpowers plugin, native, no subagents) reads the
[spec](2026-11-07-plus-port-spec.md) and the [plan](2026-11-07-plus-port-plan.md) against the audit, Plus at `1766c622`
and this branch's base. Check first: spec section 9 (the 3D plan's changes) against the 3D build's latest log, and the
plan's task 1.1 subtree and rename order. Part A needs nothing from the 3D build; part B's tasks each name the 3D task
they wait for.
