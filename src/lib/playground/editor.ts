// The editor (spec F2, §9.2, §9.3), loaded on the reader's first tap or focus on the code and never preloaded: its
// chunk is held to MAX_EDITOR_CHUNK_GZIP_BYTES by `check:site`. Its layout matches the static code's box exactly
// (CodePanel.svelte): Geist Mono at 16 px, line height 1.5, 1rem padding, a three-digit gutter and wrapped lines.
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands'
import { typescriptLanguage } from '@codemirror/lang-javascript'
import { bracketMatching, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { searchKeymap } from '@codemirror/search'
import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView, highlightSpecialChars, keymap, lineNumbers } from '@codemirror/view'
import { classHighlighter } from '@lezer/highlight'

export interface EditorOptions {
  readonly parent: HTMLElement
  readonly doc: string
  /** The accessible name, "Code for <title>. Changes update the preview." */
  readonly label: string
  /** The status line's id. */
  readonly describedBy: string
  /** Where the caret starts: the source offset the reader tapped. */
  readonly anchor: number
}

const theme = EditorView.theme({
  '&': { fontSize: '1rem' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.5', overflow: 'visible' },
  '.cm-content': { padding: '1rem 0', caretColor: 'var(--ink)' },
  '.cm-line': { padding: '0 1rem 0 0' },
  '.cm-gutters': { paddingLeft: '1rem', border: 'none', background: 'transparent', color: 'var(--muted)' },
  '.cm-lineNumbers .cm-gutterElement': { boxSizing: 'content-box', minWidth: '3ch', padding: '0 1rem 0 0', textAlign: 'right' },
})

export function mountEditor({ parent, doc, label, describedBy, anchor }: EditorOptions): EditorView {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.cursor(Math.min(Math.max(anchor, 0), doc.length)),
    extensions: [
      lineNumbers(),
      highlightSpecialChars(),
      history(),
      indentOnInput(),
      bracketMatching(),
      typescriptLanguage,
      syntaxHighlighting(classHighlighter),
      EditorState.tabSize.of(2),
      EditorView.lineWrapping,
      // No indentWithTab: Tab and Shift+Tab leave the editor, so the keyboard gate finds no trap (§9.2).
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      EditorView.contentAttributes.of({ 'aria-label': label, 'aria-describedby': describedBy, autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false' }),
      theme,
    ],
  })
  const view = new EditorView({ state, parent })
  // CodeMirror draws only the lines near the screen and estimates the others' heights, so a wrapped file's box would
  // come out a few lines off the static code's. Its print mode draws and measures every line, and the heights it
  // measures stay; the examples are short, so one full measure at mount is cheap and the box keeps its size (§9.3).
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
