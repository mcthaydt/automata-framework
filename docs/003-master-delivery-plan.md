# AutomataFramework: master delivery plan

> **Direction:** A/B specifications → review → A/B implementation → real 3D game → evidence-led C modules. Updated by Owner direction, 2026-10-05. Read [004 Living continuation](004-continuation-prompt.md) before choosing work.

## How to use this plan

Read [001 Overview](001-overview.md) and [002 Decomposition](002-decomposition.md) first. This document owns task order and coverage; dated specs own contracts. A master task is not an executable TDD plan. Existing A0/A1a artifacts and historical acceptance remain preserved in the decomposition.

The current work is the complete A/B specification pass. All tasks below begin unchecked because their deliverables have not been accepted under this new gate. That does not imply existing sim code or earlier specs are missing. Writing a spec means a complete draft, not a placeholder file. Written-spec approval remains a separate task.

New specs live in `docs/superpowers/specs/YYYY-MM-DD-<slug>-design.md`, using their actual authoring date. The slug column below is the inventory key; replace it with a link when the complete file exists. Plans live in `docs/superpowers/plans/` and are written after the specification review gate, just before execution.

## Specification pass — exact order

| Done | Task | Phase / spec slug | Deliverable and prerequisite |
|---|---|---|---|
| [ ] | SPEC-01 — Reconcile existing architecture and foundation | Existing master and `a0-a1-spikes-foundation` | Read master, A0+A1 §§11–12, ADR 0001, S1–S6 and current public sim/checker APIs. Preserve completed work; identify remaining A1b/A1c contracts, actual ownership and unresolved design inputs. Reconcile the responsive UI/testing direction and Ruken contract answers. Produce a coverage map in the existing spec/decomposition, with historical versus current evidence explicit. |
| [ ] | SPEC-02 — Runtime, hosts, renderers and UI skeleton | A2 / `a2-skeleton` | Depends on SPEC-01. Specify boot/readiness, Hosting capabilities and lifecycle/error behavior, Scene/Time/mirror/event ownership, render delta/interpolation/resync and adapter disposal. Define initial responsive primitives and renderer-free component/screen fixture contracts. Reconcile the actual Ruken P1 catalog and S6 answers; do not treat the stub as the real SDK. |
| [ ] | SPEC-03 — Shipping and test infrastructure | A3 / `a3-ship-pipeline` | Depends on SPEC-02. Define reusable workflow inputs/outputs, immutable artifact identity, packaging/manifest/CSP gates, minimal scaffold, deployment/rollback boundaries and Linux GPU environment. Allocate focused DOM/GPU/full-release lanes, queue/setup/execution measurement, isolation, evidence reports, coverage selection and runner preflight. External account/hardware readiness stays explicit. |
| [ ] | SPEC-04 — Input, display and responsive UI | A4 / `a4-input-display` | Depends on SPEC-02/SPEC-03. Define input profiles/rebinding/controller focus/touch state, one viewport geometry owner and safe-area/host/visual occlusion policy. Inventory frames, action bars, panels, dialogs and scrolling/paging states. Specify composition, compact height, rotation, keyboard/browser bars, target sizes, text/UI scaling and renderer-specific post-processing. Include concrete component, composed-screen and real-input acceptance matrices. |
| [ ] | SPEC-05 — Saves, audio and localization | A5 / `a5-save-audio-localization` | Depends on SPEC-02/SPEC-04. Separate durable saves from rollback snapshots/replays; define version/identity/checksum/migration/failure policy, autosave, sync states and exit flush. Define audio bus/gain/unlock/focus lifecycle and localization/fallback/font contracts. Add dense settings, long translations, visual occlusion and cross-device hosted save/exit/resume acceptance. |
| [ ] | SPEC-06 — Debug and telemetry | A6 / `a6-debug-telemetry` | Depends on SPEC-02/SPEC-03 and consumes SPEC-04/SPEC-05 states. Define debug registration/read-only inspection, command-owned edits, release stripping, telemetry schemas/routing/consent and error/performance evidence. No sim I/O; no invented metrics or undisclosed analytics. |
| [ ] | SPEC-07 — Networking and authoritative server | A7 / `a7-networking` | Depends on SPEC-01/SPEC-02/SPEC-03. Define ordered command/ack/snapshot/delta/version contracts, authority timeline, prediction/reconciliation/replay effect suppression, reconnect and room content lifetime. Define server tick/input ownership and durable server state. Cover cadence drift, jitter, late/duplicate packets, stalls and hidden-tab gaps in cheap harnesses, plus real two-client replay/transport gates and single-player bundle exclusion. |
| [ ] | SPEC-08 — Store and season pass | A9 / `a9-store-season-pass` | Depends on SPEC-02/SPEC-05/SPEC-07 contracts. Define SKU/season/tier/XP/reward schemas, entitlement-command timing, grant-once persistence, lapse behavior and purchase/manage/capability failures. Replay entitlement changes; late completion must grant through entitlements. Respect Ruken's deferred store availability; keep cosmetic versus server-validated reward scope explicit. |
| [ ] | SPEC-09 — Full CLI and 1.0 acceptance | A8 / `a8-cli-release` | Depends on SPEC-01 through SPEC-08. Define create/update/lock/deploy/validate/doctor interfaces, codemod/version/lock identity and failure/rollback behavior. Scaffold focused tests and screen registration; define package/game compatibility and complete 1.0 coverage. A8 design follows A9 so its release inventory can be reconciled; implementation dependencies remain the architectural phase map. |
| [ ] | SPEC-10 — Character assets | B1 / `b1-character-pipeline` | Depends on SPEC-02/SPEC-04. Read actual source assets and relevant retired pipeline contracts. Define recipe/provenance, rig/animation set, GLB/content outputs, validator budgets, failure/rebuild policy and renderer acceptance. Separate generated-file validation from Owner visual acceptance; retain the approved target look. |
| [ ] | SPEC-11 — Environment assets | B2 / `b2-environment-pipeline` | Depends on SPEC-01/SPEC-02/SPEC-04. Define authored map format and compiler outputs: geometry, deterministic colliders, spawn anchors and lighting zones. Specify coordinate/unit/ID ownership, schema/reference validation, incremental/reproducible build behavior and render/physics acceptance. Verify the referenced editor contracts before designing around them. |
| [ ] | SPEC-12 — Audit the complete specification set | All A/B specs | Depends on SPEC-01 through SPEC-11. Map every retained master requirement to a phase, contract owner/consumer and acceptance case. Reconcile identifiers, schemas, units, event/command order, lifecycle/disposal, capability failures, replay/save/restore, content/asset identity, renderer parity and testing gates. Resolve conflicting contracts and record true external dependencies; do not silently drop scope or invent readiness. Update the decomposition/spec links from actual artifacts. |
| [ ] | SPEC-13 — Written-spec review gate | Owner review | Depends on SPEC-12. Present the complete linked spec set and audit result. Record Owner acceptance and any unresolved decisions explicitly. Only then schedule the next just-in-time implementation plan. Drafted specs and automated document checks do not satisfy this review. |

## Specification quality gate

Every spec satisfies [002 Decomposition §3.1](002-decomposition.md#31-required-phase-spec-and-implementation-plan-detail). At minimum it contains goal/in-out scope, package/state ownership, concrete interfaces and schema values, ordered flows, lifecycle/disposal, failure/recovery, dependencies and named testable exit cases. UI phases contain component/state and responsive/input inventories. Testing infrastructure defines fast focused feedback and full-gate coverage separately.

Use actual source and approved reference contracts. If a decision depends on a missing external artifact, name its impact and the gate it blocks; do not fabricate a contract or bury it as an unexplained placeholder. The cross-phase audit may refine a draft, but changing an approved requirement must be explicit.

Mark a draft task complete only when its full artifact exists, is self-reviewed and linked with the evidence location in the execution record below. Review status remains draft until SPEC-13. Do not mark implementation complete because its spec exists.

## Engineering after the specification gate

| Done | Task | Prerequisite and deliverable |
|---|---|---|
| [ ] | ENG-01 — Write and review A1b TDD plan | SPEC-13 accepted; reconciled foundation contracts. Exact physics/content files/interfaces, test-first steps, cross-engine checks and acceptance. No product implementation until the plan is reviewed and execution is selected. |
| [ ] | ENG-02 — Implement and accept A1b | Reviewed ENG-01 plan; strict TDD, scoped implementation and required local/CI acceptance evidence. |
| [ ] | ENG-03 — Write and review A1c TDD plan | Accepted A1b outputs; sim/replay harnesses, examples, build/publishing and foundation exits. |
| [ ] | ENG-04 — Implement and accept A1c / close A1 | Reviewed ENG-03 plan; all remaining A1 exits satisfied, including actual package/example/golden/publishing evidence. |
| [ ] | ENG-05 — Execute remaining phases through reviewed plans | Follow the existing dependency map for A2–A9 and B1–B2. Write each plan just before execution, expand its master tasks before marking work, and preserve separate local/CI/runtime/device/Owner gates. |

## Real 3D game, then Part C

These future gates follow A/B delivery. They do not expand the current spec pass or restore the removed template-port scope. A game concept and module inventory have not yet been selected.

| Done | Task | Prerequisite and deliverable |
|---|---|---|
| [ ] | GAME-01 — Design and review the real 3D game | Delivered A/B. Select the game concept, playable scope, relevant optional capabilities, source assets, target devices and concrete gameplay/runtime/visual acceptance cases. Specify game-owned systems and framework consumers; obtain written game-design review. |
| [ ] | GAME-02 — Build and accept the game | Reviewed GAME-01 design and just-in-time TDD plans. Deliver actual playable game behavior using A/B, shared responsive UI and focused tests, with real journey, runtime/device, deployment and Owner play/visual evidence. A foundation example does not close this task. |
| [ ] | MOD-01 — Audit FloorFifty and the 3D game | Accepted GAME-02 behavior plus actual FloorFifty source/tests/runtime evidence. Identify extraction candidates, demonstrated reuse, dimensional assumptions and game-specific responsibilities. Select scope explicitly; no predetermined module catalog. |
| [ ] | MOD-02 — Specify and review selected C modules | MOD-01 selection. Define module ownership, public/versioned contracts, lifecycle/failure behavior, consumer integration and applicable 2D/3D regression cases. Review the selected module specs before extraction plans. |
| [ ] | MOD-03 — Extract and verify modules incrementally | Reviewed MOD-02 contracts and just-in-time TDD plans. Extract supported behavior into versioned framework modules, adopt them in real consumers and verify preserved gameplay, UI and lifecycle behavior. Record each module's evidence and acceptance separately. |

These rows are delivery gates, not a substitute for the forthcoming phase TDD plans. No unmeasured dates, test-speed claims or account approvals are promised here.

## Execution record and handoff

No SPEC, ENG, GAME or MOD task has acceptance evidence yet under this master plan. The numbered-doc setup establishes the workflow; it does not satisfy SPEC-01 or create the missing phase specs.

For each completed task record its ID, scoped artifact/commit, self-review and relevant check results, review status and remaining gates. Update the checklist, affected phase documents and [004 Living continuation](004-continuation-prompt.md) in the same session. Preserve prior A0/A1a evidence in the decomposition; refresh it when engineering resumes.
