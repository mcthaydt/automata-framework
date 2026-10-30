// What an editor's component tests borrow from the kit (`@mcthaydt/automata-editor-kit/testing`): the one stand-in for
// the geometry owner and the window sizes of the layout tests, so no editor keeps its own copy of them.

export { arrived, type EditorSize, type Mode, REST, SIZES } from './layout-sizes'
export { type ResizableGeometry, stubGeometry } from './stub-geometry.svelte'
