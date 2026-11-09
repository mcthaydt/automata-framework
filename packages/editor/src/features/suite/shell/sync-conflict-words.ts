import type { Choice, MergeAsk } from '../../../shared/kit/sync/git-engine'
import { editLabel } from '../../../shared/kit/sync/sync-status'

// What the dialog for a file changed here and on GitHub says, in one place: what happened, and what each choice does.

export interface ConflictOption {
  readonly choice: Choice
  readonly label: string
  readonly detail: string
}

export interface ConflictWords {
  readonly title: string
  readonly why: string
  /** In the order the buttons stand, the careful one last. */
  readonly options: readonly ConflictOption[]
  /** The choice that loses nothing: it is the one with the focus. */
  readonly primary: Choice
}

const MINE = 'Keep mine'
const THEIRS = 'Keep GitHub’s'
const BOTH = 'Keep both'

export function conflictWords(ask: MergeAsk): ConflictWords {
  const name = editLabel(ask.path)
  if (ask.reason === 'deleted-here')
    return {
      title: `${name} was deleted here, but changed on GitHub`,
      why: `You deleted ${name}, and someone changed it on GitHub.`,
      options: [
        { choice: 'mine', label: MINE, detail: 'Delete it on GitHub too.' },
        { choice: 'theirs', label: THEIRS, detail: 'Bring it back here, with the change from GitHub.' },
      ],
      primary: 'theirs',
    }
  if (ask.reason === 'deleted-there')
    return {
      title: `${name} was deleted on GitHub, but changed here`,
      why: `Someone deleted ${name} on GitHub, and you changed it here.`,
      options: [
        { choice: 'theirs', label: THEIRS, detail: 'Delete it here too. Your change here is dropped.' },
        { choice: 'mine', label: MINE, detail: 'Keep it, and put it back on GitHub.' },
      ],
      primary: 'mine',
    }
  const copy = ask.keepBothPath?.split('/').pop()
  return {
    title: `${name} changed here and on GitHub`,
    why: `You and GitHub both changed ${name}.${ask.where === undefined ? '' : ` They disagree about ${ask.where}.`}`,
    options: [
      { choice: 'theirs', label: THEIRS, detail: 'This device gets GitHub’s. Your change here is dropped.' },
      { choice: 'mine', label: MINE, detail: 'GitHub gets what is on this device.' },
      ...(copy === undefined
        ? []
        : [
            {
              choice: 'both' as const,
              label: BOTH,
              detail: `Keep mine, and save GitHub’s next to it as ${copy}.`,
            },
          ]),
    ],
    primary: copy === undefined ? 'mine' : 'both',
  }
}
