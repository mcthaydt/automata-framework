# Automata Plus as framework extensions: progress

**Overall: 50% (3 of 6 stages done).**

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
| 3. Plan audit | Done, 2026-11-07, with the superpowers plugin (`writing-plans`' self-review), native: 16 findings (F1 to F16), all fixed in the spec and the plan; P-D11 B confirmed sound with F5's fix; one change to the 3D plan's 7.1 (`zone`, `masses`, `cut`, `hideFrom` in `af-sector/2`, spec section 9). Spec accepted | [plan audit](2026-11-07-plus-port-plan-audit.md) |
| 4. Build | Not started | |
| 5. Build audit | Not started | |
| 6. Fixes | Not started | |

## Where to resume (2026-11-07, stage 3 done)

The build (Sonnet, high, `superpowers:executing-plans`, native, no subagents) starts at plan task 1.1 and works part A
in order; part B's tasks each wait for the 3D task they name. Read the plan's Global Constraints and Review Focus first.
The 3D build must apply spec section 9 (now including the 7.1 additions for `af-sector/2`) when it reaches 7.1, 7.4,
12.1 and 12.2.
