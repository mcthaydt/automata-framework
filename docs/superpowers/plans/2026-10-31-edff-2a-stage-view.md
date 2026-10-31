# EDFF.2a-1 Register the stage profile and the Stage view: TDD plan

- **Task:** EDFF.2a in [02](../../02-master-delivery-plan.md), first half. [2D editor spec](../specs/2026-10-23-editor-2d-design.md) §4 (the registration list), §10.6 (commands; the Stage row: identity, presentation, the `courseTuning` table; flow "New stage"), §10.7 (checks), §12 (44 px targets). Mockup `ff-settings` in `docs/design/editor-2d/screens-floorfifty.mjs`.
- **Lane:** editors. **Depends on:** EDFF.1 (merged: the profile, its commands, templates and checks), ED2D.4c4a (merged: the view router). **Unblocks:** EDFF.2a-2 (Assets), EDFF.2b (the composition canvas).
- **Status:** Drafted 2026-10-31. Accepted under the Owner's "Auto accept all spec and plans" (2026-10-30) and "everything is auto approved and accepted" (2026-10-31) once reviewed.
- **Progress:** 1 of 6 steps.

## The split, and why

EDFF.2a is size M with four parts: the registration, the Stage view, the Assets view (manifest and image import, the alias picker with suggestions, FF-e) and opening a game folder on Chromium. It lands in two PRs:

- **EDFF.2a-1 (this plan):** register `floorfifty-stage`, so Home lists Empty, Sky only and Simple city and opens a stage on its views; the Stage view.
- **EDFF.2a-2:** the Assets view, the manifest and image import into `assets/`, the alias picker with nearest-name suggestions (FF-e), "Copy of…" on Home, and opening a game folder on Chromium (with ED2D.8's folder source if that lands first).

## Scope

**In** (`packages/editor-2d/src/`):

- `app/profiles.ts`: `registry.register(floorFiftyStage)` after the level project.
- `app/stage/stage-form.ts` (pure): what the Stage view shows: identity (id, name, unlock, platform alias), the presentation block (present or not; refraction, horizon lift, light height, shimmer, silhouette), and the course tuning overrides (each with its declared type, bounds and default) plus the tunables that can still be added.
- `app/stage/StageView.svelte`: the `StageView` rail destination, a scrolling form in three sections. Each change is one undo step through the profile's commands (`renameStage`, `setStageId`, `setUnlock`, `setPlatformAlias`, `setPresentation`, `removePresentation`, `setCourseTuning`). A value out of the schema's range is kept and reported by Checks (§10.6: commands never judge a range), so the form shows the declared range beside each tuning value.
- `views.ts`: `StageView` registered.

**Out, with owner:** the Assets view, aliases picked from a manifest, "Copy of…", the folder (EDFF.2a-2); the Compose canvas (EDFF.2b); the Course and Set pieces views (EDFF.3, EDFF.4). Inline findings beside the Stage view's fields (the Checks view lists them; a follow-up).

## Interfaces

**Consumed:** `floorFiftyStage`, the identity and presentation commands, `TUNABLES`, `COURSE_TUNABLE_NAMES`, `StageDocument` (`profiles/floorfifty-stage/`); `History.apply`; `EditorShell`, `Stepper`, `Button`, `Picker` or `Segmented` from the kit; `ViewProps`.

**Produced (private package):** `stageForm(document): StageForm`; `StageView.svelte`; the registration.

## Decisions (defaults, for the Owner's veto)

1. **The Stage view is a page, not an inspector tab.** The mockup shows it as the inspector's Stage tab beside Compose's Layer tab; until Compose exists (EDFF.2b), the rail's Stage entry shows the same sections as a form in the canvas region. When Compose lands it can reuse the form in its inspector.
2. **Aliases are typed for now.** The platform alias is a text field here; picking it from the art manifest with suggestions is EDFF.2a-2's alias picker.
3. **Presentation is switched on and off as a block.** "Use presentation" adds the block with neutral values (`setPresentation` makes it) and "Remove presentation" removes it; the optional light height has its own on/off.

## Steps

Each step: write the test, run it and see it fail for the stated reason, make the minimal change, see it pass.

- [x] **1. This plan.** Committed first.
- [ ] **2. Registration.** `profiles.test.ts`: the registry lists Level project then FloorFifty stage; a `.toml` stage file is claimed by the stage profile; the stage profile's templates are Empty, Sky only and Simple city. Fails: one profile. Then the app tests that counted one profile's templates are read again (record any that change and why).
- [ ] **3. The form model.** `stage-form.test.ts`: the Simple city template's identity, its presentation values, no overrides and every course tunable available; with an override, it is listed with its type, bounds and default and is no longer available; a stage without presentation says so. Fails: no module.
- [ ] **4. The Stage view.** `StageView.dom.test.ts`, a stage created from Home's template and reached from the rail: rename, id, unlock (cleared when empty), platform alias, each one undo step; presentation on, a value changed, off; an override added from the list, changed, removed; a value outside its declared range is kept and Checks reports it. Fails: the pending view.
- [ ] **5. Layout.** `stage-view.layout.test.ts` at the eight sizes in Chromium, WebKit and Firefox: every control at least 44 px and never clipped, the page never scrolls; screenshots.
- [ ] **6. Gates and review images.** Review images in `docs/evidence/owner-visual/2026-10-31-edff-2a/` with a README.

## Gates

- `pnpm format`; `TURBO_FORCE=true pnpm check`.
- `pnpm --filter @mcthaydt/automata-editor-2d test:parity` (Chromium, WebKit, Firefox).
- No published package changes: no changeset; `pnpm api-report` to confirm.

## Execution log

- 2026-10-31: plan drafted from `main` at `d945756`.
