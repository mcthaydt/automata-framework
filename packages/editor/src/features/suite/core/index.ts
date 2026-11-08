// The suite's headless core (editor suite spec EDS-D1): no Svelte, no DOM, no Node and no clock, so the suite app,
// the Node adapters and the tests share it.

export {
  type EditorListLoad,
  type EditorListProblem,
  loadEditorList,
} from '../../../shared/editor-list/editor-list'
export {
  type CheckRow,
  CONTENT_CHECK,
  EDITOR_LIST_FORMAT,
  EDITOR_LIST_PATH,
  type EditMode,
  type EditorList,
  editorListSchema,
  type FileRow,
  type GateRow,
} from '../../../shared/editor-list/editors.schema'
export { globMatch } from '../../../shared/editor-list/glob'
export {
  ALWAYS_NEVER,
  type FileAccess,
  fileAccess,
  workspaceFile,
} from '../../../shared/editor-list/workspace-policy'
