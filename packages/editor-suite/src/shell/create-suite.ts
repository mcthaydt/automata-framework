// The suite's composition of editors (editor suite spec §4.1): the free build passes its editors, the Plus build
// (EDS.P) passes the free ones and its own. Two editors with one id would make the list's rows ambiguous, so they fail
// here, when the build starts, rather than whichever registered last winning.
import type { SuiteEditor } from '@mcthaydt/automata-editor-kit/ports'

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
