// The suite rail's entries: one per editor the page registers, in the order it registers them, then Review when the
// suite has change sets to review. Cmd 1 to 9 choose them in this order, so the rail never offers an editor the build
// does not have. Each entry opens its one editor; Review edits nothing.
import type { SuiteEditor } from '../../../shared/kit/ports/suite-editor.ts'

export interface SuiteEntry {
  readonly id: string
  readonly label: string
  /** The editor-list ids this entry opens; Review edits nothing and has none. */
  readonly editors: readonly string[]
}

const REVIEW: SuiteEntry = { id: 'review', label: 'Review', editors: [] }

/** The rail, from the registered editors; `review` adds Review at the end. */
export function suiteEntries(
  editors: readonly Pick<SuiteEditor<unknown>, 'id' | 'label'>[],
  review: boolean,
): SuiteEntry[] {
  const entries = editors.map((editor) => ({ id: editor.id, label: editor.label, editors: [editor.id] }))
  return review ? [...entries, REVIEW] : entries
}
