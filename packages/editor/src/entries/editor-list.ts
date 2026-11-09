// The editor list (`@automata/editor/editor-list`): the `editors.toml` format, glob matching and write paths. The
// command line and `automata check` read it in Node, so it imports no Svelte and no DOM.

export {
  type EditorListLoad,
  type EditorListProblem,
  loadEditorList,
} from '../shared/editor-list/editor-list.ts'
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
} from '../shared/editor-list/editors.schema.ts'
export { globMatch } from '../shared/editor-list/glob.ts'
export {
  ALWAYS_NEVER,
  type FileAccess,
  fileAccess,
  workspaceFile,
} from '../shared/editor-list/workspace-policy.ts'
