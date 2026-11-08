// The default screens' save UI in English: the `saves` part of `DEFAULT_SCREENS_COPY` (screens-copy.ts),
// which a game overrides in its own language with `copy.screens`.

import type { SaveStatusCopy } from '../../../shared/ui/status/save-status.ts'
import type { SaveSlotsCopy } from './save-slots.ts'

/** The slot list. Slots are numbered from 0 inside the runtime and from 1 for the player. */
export const SAVE_SLOTS_COPY: SaveSlotsCopy = {
  title: 'Saves',
  loading: 'Loading your saves…',
  slot: (slot) => `Slot ${slot + 1}`,
  empty: 'Empty',
  unreadable: "This save can't be opened",
  newer: 'Saved by a newer version of the game',
  otherContent: 'From another version: it loads, but some things may reset',
  writing: 'Saving…',
  failed: "Couldn't save your game. Try again.",
  load: 'Continue',
  newGame: 'New game',
  delete: 'Delete…',
  deleteTitle: 'Delete this save?',
  deleteBody: (name) => `${name} will be gone for good.`,
  deleteNewerBody: 'A newer version of the game made this save. Deleting it here cannot be undone.',
  deleteConfirm: 'Delete',
  cancel: 'Keep it',
  more: (count) => `+${count} more`,
}

/** What the host has done with the player's progress, in a line on the paused screen. */
export const SAVE_STATUS_COPY: SaveStatusCopy = {
  checking: 'Checking your progress…',
  syncing: 'Saving…',
  saved: 'Progress saved',
  'offline-queued': 'Offline: your progress will be saved when you are back online',
  retry: 'Could not save yet; trying again',
  conflict: 'Choose which progress to keep',
  recovered: 'Progress restored',
  'no-grant': "Progress won't be kept",
}

/** The words of the choice paused offers once another device has changed the slot being played. */
export interface ChangedElsewhereCopy {
  readonly message: string
  readonly loadNewer: string
  readonly keepPlaying: string
  /** Load newer was chosen and the other device's progress could not be used; this game goes on as it was. */
  readonly failed: string
}

export const CHANGED_ELSEWHERE_COPY: ChangedElsewhereCopy = {
  message:
    'Your progress changed on another device. Load it, or keep playing and your next save replaces it.',
  loadNewer: 'Load newer progress',
  keepPlaying: 'Keep playing',
  failed: "Couldn't load the newer progress, so this game goes on as it was",
}

/** The Toast play shows when the slot being played changes on another device. */
export const CHANGED_ELSEWHERE_TOAST = 'Your progress changed on another device'
