// The editor, loaded on the reader's first tap or focus on the code and never preloaded: its
// chunk is held to MAX_EDITOR_CHUNK_GZIP_BYTES by `check:site`. Its layout matches the static code's box exactly
// (CodePanel.svelte): Geist Mono at 16 px, line height 1.5, 1rem padding, a three-digit gutter and wrapped lines.
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { typescriptLanguage } from '@codemirror/lang-javascript'
import { bracketMatching, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { lintGutter, setDiagnostics } from '@codemirror/lint'
import { searchKeymap } from '@codemirror/search'
import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView, highlightSpecialChars, keymap, lineNumbers } from '@codemirror/view'
import { classHighlighter } from '@lezer/highlight'
import type { Diagnostic } from './compile'

export interface EditorOptions {
  readonly parent: HTMLElement
  readonly doc: string
  /** The accessible name, "Code for <title>. Changes update the preview." */
  readonly label: string
  /** The status line's id. */
  readonly describedBy: string
  /** Where the caret starts: the source offset the reader tapped. */
  readonly anchor: number
  /** Called with the whole text after each change, but not during IME composition: once it ends. */
  readonly onchange: (doc: string) => void
}

const theme = EditorView.theme({
  '&': { fontSize: '1rem' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.5', overflow: 'visible' },
  '.cm-content': { padding: '1rem 0', caretColor: 'var(--ink)' },
  '.cm-line': { padding: '0 1rem 0 0' },
  '.cm-gutters': { border: 'none', background: 'transparent', color: 'var(--muted)' },
  '.cm-gutter-lint': { width: '1rem' },
  '.cm-gutter-lint .cm-gutterElement': {
    padding: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    boxSizing: 'content-box',
    minWidth: '3ch',
    padding: '0 1rem 0 0',
    textAlign: 'right',
  },
})

export function mountEditor({
  parent,
  doc,
  label,
  describedBy,
  anchor,
  onchange,
}: EditorOptions): EditorView {
  let changedWhileComposing = false
  const state = EditorState.create({
    doc,
    selection: EditorSelection.cursor(Math.min(Math.max(anchor, 0), doc.length)),
    extensions: [
      // The lint gutter takes the gutters' left padding, so the line numbers stay where the static code has them.
      lintGutter(),
      lineNumbers(),
      highlightSpecialChars(),
      history(),
      indentOnInput(),
      bracketMatching(),
      typescriptLanguage,
      syntaxHighlighting(classHighlighter),
      EditorState.tabSize.of(2),
      EditorView.lineWrapping,
      // No indentWithTab: Tab and Shift+Tab leave the editor, so the keyboard gate finds no trap.
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      EditorView.contentAttributes.of({
        'aria-label': label,
        'aria-describedby': describedBy,
        autocorrect: 'off',
        autocapitalize: 'off',
        spellcheck: 'false',
      }),
      theme,
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) return
        if (update.view.composing) changedWhileComposing = true
        else onchange(update.state.doc.toString())
      }),
      // Changes made while composing are reported when it ends. A change CodeMirror applies after `compositionend`
      // reaches the listener above, since `composing` is false by then; a composition that changed nothing reports none.
      EditorView.domEventHandlers({
        compositionend: (_event, view) => {
          if (changedWhileComposing) onchange(view.state.doc.toString())
          changedWhileComposing = false
        },
      }),
    ],
  })
  const view = new EditorView({ state, parent })
  // CodeMirror draws only the lines near the screen and estimates the others' heights, so a wrapped file's box would
  // come out a few lines off the static code's. Its print mode draws and measures every line, and the heights it
  // measures stay; the examples are short, so one full measure at mount is cheap and the box keeps its size.
  // `viewState.printing` and `measure` are internal to @codemirror/view (pinned in package.json); the e2e box test
  // guards them.
  const internal = view as unknown as { viewState?: { printing?: boolean }; measure?: () => void }
  if (internal.viewState && 'printing' in internal.viewState && internal.measure) {
    internal.viewState.printing = true
    internal.measure()
    internal.viewState.printing = false
  }
  return view
}

/** The offset of a 1-based line and column, held inside the document. */
function offsetOf(view: EditorView, line: number, column: number): number {
  const at = view.state.doc.line(Math.min(Math.max(line, 1), view.state.doc.lines))
  return Math.min(at.from + Math.max(column, 1) - 1, at.to)
}

/** Marks each diagnostic in the gutter and underlines it to the end of its line; none clears them. */
export function showDiagnostics(view: EditorView, diagnostics: readonly Diagnostic[]) {
  view.dispatch(
    setDiagnostics(
      view.state,
      diagnostics.map(({ line, column, message }) => {
        const from = offsetOf(view, line, column)
        const to = view.state.doc.lineAt(from).to
        // A problem at the very end of a line still gets an underline: its last character, or nothing on an empty line.
        return {
          from: from < to ? from : Math.max(view.state.doc.lineAt(from).from, to - 1),
          to,
          severity: 'error' as const,
          message,
        }
      }),
    ),
  )
}

/** Puts the caret at a 1-based line and column and focuses the editor (the status line's diagnostic). */
export function moveCaret(view: EditorView, line: number, column: number) {
  view.dispatch({ selection: EditorSelection.cursor(offsetOf(view, line, column)), scrollIntoView: true })
  view.focus()
}

/** Replaces the whole text in one undoable transaction (Reset: Mod-Z brings the edit back). */
export function replaceAll(view: EditorView, text: string) {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
    selection: EditorSelection.cursor(0),
  })
}
