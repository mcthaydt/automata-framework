<!--
  SaveSlots for the layout contract (M5 spec §8), in a screen with Back in its corner row as a game would draw it.
  `slots` is six slots of every kind; `slots-long` gives each the longest labels and times a player could have, so
  the clamp to two lines is what is measured; `newer` is a single slot from a newer build, which offers only
  Delete…; `loading` is the moment before the slots arrive. Words are English stand-ins of a typical length.
-->
<script lang="ts" module>
export const SAVE_SLOTS_SHOWS = ['slots', 'slots-long', 'newer', 'loading'] as const
export type SaveSlotsShow = (typeof SAVE_SLOTS_SHOWS)[number]
</script>

<script lang="ts">
import ScreenFrame from '../layout/ScreenFrame.svelte'
import SaveSlots from '../saves/SaveSlots.svelte'
import type { SaveSlotsCopy, SaveSlotsView, SaveSlotView } from '../saves/save-slots'

const { show }: { show: SaveSlotsShow } = $props()
const none = (): void => undefined

const COPY: SaveSlotsCopy = {
  title: 'Saves',
  loading: 'Loading your saves…',
  slot: (slot) => `Slot ${slot}`,
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

const LONG_LABEL =
  'A very long name for a save that a player typed in a hurry, and then went on and on with, to the end of the line '
const slots = (long: boolean): SaveSlotView[] => [
  { kind: 'empty', slot: 1 },
  { kind: 'ready', slot: 2, savedAt: 100, ...(long ? { label: LONG_LABEL.repeat(2) } : { label: 'Ash, level 3' }) },
  { kind: 'ready', slot: 3, savedAt: 300 },
  { kind: 'other-content', slot: 4, savedAt: 200, ...(long ? { label: LONG_LABEL } : {}) },
  { kind: 'unreadable', slot: 5 },
  { kind: 'newer', slot: 6 },
]

const view: SaveSlotsView = $derived(
  show === 'loading'
    ? { state: 'loading' }
    : show === 'newer'
      ? { state: 'slots', slots: [{ kind: 'newer', slot: 1 }] }
      : { state: 'slots', slots: slots(show === 'slots-long') },
)
// The longest time a locale might give: a weekday, a date and a time with a zone.
const formatTime = (savedAt: number): string =>
  show === 'slots-long'
    ? `Wednesday, 23 September 2026 at 14:${String(savedAt).padStart(2, '0')}:07 Central European Summer Time`
    : `23 Sep, 14:${String(savedAt % 60).padStart(2, '0')}`
</script>

<ScreenFrame arrangement="stack" back={none} backLabel="Back">
  {#snippet body()}
    <SaveSlots {view} copy={COPY} {formatTime} onload={none} onnew={none} ondelete={none} />
  {/snippet}
</ScreenFrame>
