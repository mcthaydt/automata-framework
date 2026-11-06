// The undo and redo stacks behind the write path. Each owner (an editor's id, or `''` for the suite's own steps) has its
// own stack of steps and a count of how many are done, so a switch from one editor to another and back still undoes the
// first editor's own last step. Plain TypeScript: no DOM, no clock, no files; the write path decides when a step counts.

/** One file of a step: what it read before the step (`undefined` when it did not exist) and what it reads after. */
export interface StepFile {
  readonly path: string
  readonly before: string | undefined
  readonly after: string
}

/** What one undo or redo reverses: a label for the button and the files it touched. */
export interface Step {
  readonly label: string
  readonly files: readonly StepFile[]
}

export interface WriteHistories {
  /** Adds a step after the owner's last done one; any steps that were undone are forgotten. */
  push(owner: string, step: Step): void
  /** The step an undo would reverse, or `undefined`. */
  nextUndo(owner: string): Step | undefined
  /** The step a redo would apply again, or `undefined`. */
  nextRedo(owner: string): Step | undefined
  /** Moves the owner's mark back one step after an undo was written. */
  undone(owner: string): void
  /** Moves the owner's mark forward one step after a redo was written. */
  redone(owner: string): void
  /** Empties every owner's history. */
  clear(): void
}

export function createWriteHistories(): WriteHistories {
  const histories = new Map<string, { steps: Step[]; done: number }>()
  const historyOf = (owner: string) => {
    let history = histories.get(owner)
    if (history === undefined) {
      history = { steps: [], done: 0 }
      histories.set(owner, history)
    }
    return history
  }

  return {
    push(owner, step) {
      const history = historyOf(owner)
      history.steps.length = history.done
      history.steps.push(step)
      history.done = history.steps.length
    },
    nextUndo: (owner) => {
      const { steps, done } = historyOf(owner)
      return steps[done - 1]
    },
    nextRedo: (owner) => {
      const { steps, done } = historyOf(owner)
      return steps[done]
    },
    undone: (owner) => {
      historyOf(owner).done--
    },
    redone: (owner) => {
      historyOf(owner).done++
    },
    clear: () => histories.clear(),
  }
}
