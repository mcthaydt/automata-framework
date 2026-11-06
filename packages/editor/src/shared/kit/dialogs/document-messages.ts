import type { Problem, SaveOutcome } from '../storage/document-session'
import { baseName } from '../storage/store-path.ts'

// The toasts of the document session's flows: a failed save, a copy, an autosave that stopped or could not be read, a reload. Both editors say these.

export function saveFailure(
  path: string,
  outcome: Extract<SaveOutcome, { readonly status: 'failed' }>,
): string {
  return `Could not save ${baseName(path)}: ${outcome.message}`
}

export function savedCopyMessage(copy: string): string {
  return `Saved a copy as ${baseName(copy)}.`
}

export function recoveryUnreadable(message: string): string {
  return `The autosave could not be read (${message}). The file is open as it was last saved.`
}

export function reloadedMessage(path: string): string {
  return `Reloaded ${baseName(path)} from the file.`
}

/** An autosave out of quota stops until a save works; any other failure is retried on the next edit. */
export function autosaveProblem(problem: Problem): string {
  return problem.paused
    ? `Autosave has stopped: ${problem.message} Save to keep your edits.`
    : `Autosave failed: ${problem.message} It tries again with the next edit.`
}
