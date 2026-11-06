import type { Problem, SaveOutcome } from '../storage/document-session'

// The toasts of the document session's flows (kit spec §5 flows 3 and 4; moved from editor-2d's `open-flow-model.ts`
// in ED3D.5c): a failed save, a copy, an autosave that stopped or could not be read, a reload. Both editors say these.

const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

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
