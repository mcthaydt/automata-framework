# EDFF.2a-1 Register the stage profile and the Stage view: TDD plan

- **Task:** EDFF.2a in [02](../../02-master-delivery-plan.md), first half. [2D editor spec](../specs/2026-10-23-editor-2d-design.md) §4 (the registration list), §10.6 (commands; the Stage row: identity, presentation, the `courseTuning` table; flow "New stage"), §10.7 (checks), §12 (44 px targets). Mockup `ff-settings` in `docs/design/editor-2d/screens-floorfifty.mjs`.
- **Lane:** editors. **Depends on:** EDFF.1 (merged: the profile, its commands, templates and checks), ED2D.4c4a (merged: the view router). **Unblocks:** EDFF.2a-2 (Assets), EDFF.2b (the composition canvas).
- **Status:** Drafted 2026-10-31. Accepted under the Owner's "Auto accept all spec and plans" (2026-10-30) and "everything is auto approved and accepted" (2026-10-31) once reviewed.
- **Progress:** 6 of 6 steps.

## The split, and why

EDFF.2a is size M with four parts: the registration, the Stage view, the Assets view (manifest and image import, the alias picker with suggestions, FF-e) and opening a game folder on Chromium. It lands in two PRs:

- **EDFF.2a-1 (this plan):** register `floorfifty-stage`, so Home lists Empty, Sky only and Simple city and opens a stage on its views; the Stage view.
- **EDFF.2a-2:** the Assets view, the manifest and image import into `assets/`, the alias picker with nearest-name suggestions (FF-e), "Copy of…" on Home, and opening a game folder on Chromium (with ED2D.8's folder source if that lands first).

## Scope

**In** (`packages/editor-2d/src/`):

- `app/profiles.ts`: `registry.register(floorFiftyStage)` after the level project.
- `profiles/floorfifty-stage/views/stage-form.ts` (pure): what the Stage view shows: identity (id, name, unlock, platform alias), the presentation block (present or not; refraction, horizon lift, light height, shimmer, silhouette), and the course tuning overrides (each with its declared type, bounds and default) plus the tunables that can still be added.
- `profiles/floorfifty-stage/views/StageView.svelte`: the `StageView` rail destination, a scrolling form in three sections. Each change is one undo step through the profile's commands (`renameStage`, `setStageId`, `setUnlock`, `setPlatformAlias`, `setPresentation`, `removePresentation`, `setCourseTuning`). A value out of the schema's range is kept and reported by Checks (§10.6: commands never judge a range), so the form shows the declared range beside each tuning value.
- `app/profile-views.ts`: `profileViews()`, the views a registered profile supplies, by component name; `views.ts` maps those names too (decision 4). `testing/architecture.ts` lets this second registration file import a profile.

**Out, with owner:** the Assets view, aliases picked from a manifest, "Copy of…", the folder (EDFF.2a-2); the Compose canvas (EDFF.2b); the Course and Set pieces views (EDFF.3, EDFF.4). Inline findings beside the Stage view's fields (the Checks view lists them; a follow-up).

## Interfaces

**Consumed:** `floorFiftyStage`, the identity and presentation commands, `TUNABLES`, `COURSE_TUNABLE_NAMES`, `StageDocument` (`profiles/floorfifty-stage/`); `History.apply`; `EditorShell`, `Stepper`, `Button`, `Picker` or `Segmented` from the kit; `ViewProps`.

**Produced (private package):** `stageForm(document): StageForm`; `StageView.svelte`; the registration.

## Decisions (defaults, for the Owner's veto)

1. **The Stage view is a page, not an inspector tab.** The mockup shows it as the inspector's Stage tab beside Compose's Layer tab; until Compose exists (EDFF.2b), the rail's Stage entry shows the same sections as a form in the canvas region. When Compose lands it can reuse the form in its inspector.
2. **Aliases are typed for now.** The platform alias is a text field here; picking it from the art manifest with suggestions is EDFF.2a-2's alias picker.
4. **A profile supplies its own views; the registration list registers them.** `app/` may not import a profile (spec §4, the architecture test's `profiles-from-app-only`) and a `ViewDef` only names a component, so the stage's Svelte views live in `profiles/floorfifty-stage/views/` and a second registration file, `app/profile-views.ts`, returns them by component name (kept apart from `app/profiles.ts` so the headless registry imports no component; the architecture rule now names both files); `views.ts` looks a name up among its own views, then the profiles'. The `Profile` interface does not change.
5. **The Compose view's rail label is "Scene".** "Compose" runs past the 56 px rail's edge ("Comp…"; the layout check caught it at every wide size). The view's id and component (`compose`, `ComposeView`) and the spec's name for the view are unchanged.
3. **Presentation is switched on and off as a block.** "Use presentation" adds the block with neutral values (`setPresentation` makes it) and "Remove presentation" removes it; the optional light height has its own on/off.

## Steps

Each step: write the test, run it and see it fail for the stated reason, make the minimal change, see it pass.

- [x] **1. This plan.** Committed first.
- [x] **2. Registration.** `profiles.test.ts`: the registry lists Level project then FloorFifty stage; a `.toml` stage file is claimed by the stage profile; the stage profile's templates are Empty, Sky only and Simple city. Fails: one profile. Then the app tests that counted one profile's templates are read again (record any that change and why).
- [x] **3. The form model.** `stage-form.test.ts`: the Simple city template's identity, its presentation values, no overrides and every course tunable available; with an override, it is listed with its type, bounds and default and is no longer available; a stage without presentation says so. Fails: no module.
- [x] **4. The Stage view.** `StageView.dom.test.ts`, a stage created from Home's template and reached from the rail: rename, id, unlock (cleared when empty), platform alias, each one undo step; presentation on, a value changed, off; an override added from the list, changed, removed; a value outside its declared range is kept and Checks reports it. Fails: the pending view.
- [x] **5. Layout.** `stage-view.layout.test.ts` at the eight sizes in Chromium, WebKit and Firefox: every control at least 44 px and never clipped, the page never scrolls; screenshots.
- [x] **6. Gates and review images.** Review images in `docs/evidence/owner-visual/2026-10-31-edff-2a/` with a README.

## Gates

- `pnpm format`; `TURBO_FORCE=true pnpm check`.
- `pnpm --filter @mcthaydt/automata-editor-2d test:parity` (Chromium, WebKit, Firefox).
- No published package changes: no changeset; `pnpm api-report` to confirm.

## Execution log

- 2026-10-31: plan drafted from `main` at `d945756`.
- Step 2: `profiles.test.ts` failed (one profile; no stage templates; the stage file unclaimed); with `floorFiftyStage` registered after the level project it passes. Five `home-model.test.ts` cases then failed because they used the app's registry as their one-profile starting point (accent count, template list, tagging, the "could be a …" wording). They test rules that hold for any registry, so they now start from an explicit level-project-only registry; the "every template of every profile" case lists the three stage templates after the level project's. Visible change: with two profiles registered, Home's template cards carry their profile's tag (the existing tagging rule), and the three stage templates follow the level project's. editor-2d `unit` and `dom` pass 2482 of 2482.
- Step 3: `stage-form.test.ts` failed with "Cannot find module './stage-form'"; `stage-form.ts` passes 4 of 4. Deviation: the model and the view moved from `app/stage/` to `profiles/floorfifty-stage/views/` once the architecture test's `profiles-from-app-only` rule was read (only `app/profiles.ts` may import a profile, and the Stage view must call the stage's commands); see decision 4.
- Step 4: `StageView.dom.test.ts` (4 journeys) failed on the pending view ("Unable to find [data-testid=stage-view]"); with `StageView.svelte` registered they pass 4 of 4. The first wiring put `profileViews()` in `app/profiles.ts`: the full `unit` run then reported 2332 tests passed, but 7 test files had failed to load (the `unit` project has no Svelte plugin, and those headless tests import `profiles.ts`), which the summary line alone hid. The views moved to `app/profile-views.ts`; `architecture.test.ts` gained a failing case (a view imported by `app/profile-views.ts` is allowed) before `testing/architecture.ts` named the second file. editor-2d `unit` and `dom`: 148 of 148 files, 2490 of 2490 tests; `svelte-check` clean.
- Step 5: `stage-view.layout.test.ts` failed at the 4 wide sizes in all 3 browsers: "button's words run past its edge", the stage profile's "Compose" rail entry (seen in the failure screenshot as "Comp…"). Its label became "Scene" (decision 5) after `floorfifty-stage.test.ts`'s rail expectation was changed first and failed. 24 of 24 pass in Chromium, WebKit and Firefox; editor-2d `test:parity` 21 files, 558 tests.
- Step 6: 4 Stage view images (Chromium) and Home at iPad Pro 11 landscape (the parity run), with a README, in `docs/evidence/owner-visual/2026-10-31-edff-2a/`.
- Merge of `main` (ED2D.7a, #301, merged meanwhile): `views.ts` merged cleanly (ChecksView beside the profile views). 7a's `ChecksView.dom.test.ts` registered the stage profile on top of the app's registry ("a profile with the id floorfifty-stage is already registered", 6 failures), since the app did not register it then; it now uses the app's registry as is. editor-2d `unit` and `dom`: 152 of 152 files, 2518 tests; the Checks and Stage layouts 72 of 72.
