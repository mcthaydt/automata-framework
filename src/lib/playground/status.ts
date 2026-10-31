// The status line's texts (spec §8.3) that the page shows before the orchestrator, and its Zod schemas, have loaded.
import type { Diagnostic } from './compile'

/** An error is announced to screen readers only after it has stood this long (spec §5.7). */
export const ANNOUNCE_AFTER_MS = 1_000

export const STATUS = {
  starting: 'Starting the preview…',
  running: 'Running. Edit the code and the preview updates as you type.',
  updated: 'Preview updated.',
  bootTimeout: 'The preview did not start within 10 seconds.',
  firstBootTimeout: 'The preview couldn’t load. Check the connection and press Play to try again.',
  kept: 'The preview is still running your last working version.',
  loadingEditor: 'Loading the editor…',
  editorFailed: 'The editor couldn’t load. The code is shown read-only, and Play still runs the original.',
} as const

/** The status line's text for a diagnostic (§8.3); `kept` when a preview is still running the last good code. */
export function diagnosticText(diagnostic: Diagnostic, kept: boolean): string {
  const text = `Line ${diagnostic.line}: ${/[.!?]$/.test(diagnostic.message) ? diagnostic.message : diagnostic.message + '.'}`
  return kept ? `${text} ${STATUS.kept}` : text
}
