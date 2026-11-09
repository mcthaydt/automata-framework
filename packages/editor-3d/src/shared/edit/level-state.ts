// What the editor's `History` holds (ED3D spec §4.2): the level, as its profile parsed it. The view is a store beside it
// (view-store.ts) because the kit's History records every change of its state as an undo step, and the view is not one.
// The facility file is not a member of it: it is a file of its own with its own history, in facility-editor.ts (ED3D.9a).
export interface LevelState<D> {
  readonly level: D
}
