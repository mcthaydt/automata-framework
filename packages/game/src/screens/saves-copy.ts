// The words of the default screens' save UI (M5 spec §7). English, like the other default screens' words (02 follow-up
// "default screens in the game's language"); a game that wants its own languages passes custom screens.
import type { SaveSlotsCopy } from '@mcthaydt/automata-ui'

/** The slot list. Slots are numbered from 0 inside the runtime and from 1 for the player. */
export const SAVE_SLOTS_COPY: SaveSlotsCopy = {
  title: 'Saves',
  loading: 'Loading your saves…',
  slot: (slot) => `Slot ${slot + 1}`,
  empty: 'Empty',
  unreadable: "This save can't be opened",
  newer: 'Saved by a newer version of the game',
  otherContent: 'Saved by another version of the game; your progress will load, the rest will not',
  writing: 'Saving…',
  failed: "Couldn't save this slot",
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
