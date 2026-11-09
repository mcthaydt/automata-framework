// What an editor's component tests borrow from the kit (`@automataframework/automata-editor-kit/testing`): the one stand-in for
// the geometry owner, the window sizes of the layout tests, and the iPad journey harness, so no editor keeps its
// own copy of them.

export { IPAD_PROFILES, type IpadProfile, turned } from './ipad-profiles'
export {
  IPAD_USER_AGENT,
  type JourneyProjectOptions,
  journeyProject,
  type ProviderFactory,
} from './journey-project'
export { arrived, type EditorSize, type Mode, REST, SIZES } from './layout-sizes'
export {
  type Contact,
  type ContactExtras,
  createPointers,
  type Pointers,
  type PointersOptions,
  type PointerTarget,
} from './pointers'
export { type ResizableGeometry, stubGeometry } from './stub-geometry.svelte'
