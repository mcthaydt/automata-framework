import { baseName } from '../../kit/storage/store-path.ts'
import type { OpenOutcome } from './editor-app-types'

// The one line a toast says when an open or create ends without a document. Home and the document screen say the same
// words, so they share it.

const MEGABYTE = 1024 * 1024

/** One line for every way an open or create can end without a document: what a toast says. */
export function openProblem(outcome: Exclude<OpenOutcome, { readonly status: 'opened' }>): string {
  const name = baseName(outcome.path)
  switch (outcome.status) {
    case 'unrecognised':
      return `${name} is not a project this editor opens.`
    case 'notText':
      return `${name} is not a text file.`
    case 'missing':
      return `${name} is no longer in this workspace.`
    case 'tooLarge':
      return `${name} is ${Math.round(outcome.bytes / MEGABYTE)} MB; the limit is 16 MB.`
    case 'invalid': {
      const first = outcome.errors[0]
      if (first === undefined) return `${name} does not open.`
      const where =
        first.line === undefined
          ? ''
          : ` (line ${first.line}${first.column === undefined ? '' : `, column ${first.column}`})`
      return `${name} does not open: ${first.message.replace(/\.$/, '')}${where}.`
    }
    case 'choose': {
      // A choice is only ever offered between two or more profiles.
      const labels = outcome.candidates.map((candidate) => `a ${candidate.label}`)
      return `${name} could be ${labels.slice(0, -1).join(', ')} or ${labels.at(-1)}.`
    }
    case 'storageFailed':
      return `${name}: ${outcome.message}`
  }
}
