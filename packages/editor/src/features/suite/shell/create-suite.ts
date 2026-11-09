// The suite's composition of editors: a suite page passes the editors it has, and another package's page passes these
// and its own (`editor-3d`'s adds Levels 3D and the Studio; the extensions' editors add Feel, Audio and the rest). Two editors with one id would make the list's rows ambiguous, so they fail
// here, when the build starts, rather than whichever registered last winning.
import type { SuiteEditor } from '../../../shared/kit/ports/suite-editor.ts'

export interface Suite {
  readonly editors: readonly SuiteEditor<unknown>[]
  /** The installed editor with the id the list names, or `undefined`: Home marks it "not installed". */
  editor(id: string): SuiteEditor<unknown> | undefined
}

export function createSuite(options: { readonly editors: readonly SuiteEditor<unknown>[] }): Suite {
  const byId = new Map<string, SuiteEditor<unknown>>()
  for (const editor of options.editors) {
    if (byId.has(editor.id)) throw new Error(`two suite editors have the id "${editor.id}"`)
    byId.set(editor.id, editor)
  }
  return { editors: options.editors, editor: (id) => byId.get(id) }
}
