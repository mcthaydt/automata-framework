<!--
  SaveSlots for the layout contract (M5 spec §8), in a screen with Back in its corner row as a game would draw it.
  `slots` is six slots of every kind; `slots-long` gives each the longest labels and times a player could have, so
  the clamp to two lines is what is measured; `newer` is a single slot from a newer build, which offers only
  Delete…; `loading` is the moment before the slots arrive. Words are English stand-ins of a typical length, said in
  the `locale` the contract runs in (the player's labels and the times too: the longer, the stricter).
-->
<script lang="ts" module>
export const SAVE_SLOTS_SHOWS = ['slots', 'slots-long', 'newer', 'loading'] as const
export type SaveSlotsShow = (typeof SAVE_SLOTS_SHOWS)[number]
</script>

<script lang="ts">
import ScreenFrame from '../layout/ScreenFrame.svelte'
import SaveSlots from '../saves/SaveSlots.svelte'
import type { SaveSlotsCopy, SaveSlotsView, SaveSlotView } from '../saves/save-slots'
import { type FixtureLocale, say } from './locale-fixture'

const { show, locale = 'en' }: { show: SaveSlotsShow; locale?: FixtureLocale } = $props()
/** A word in the contract's locale, as a game's `t()` would give it. A fixture's props are fixed for its mount. */
const t = (text: string): string => say(locale, text)
const none = (): void => undefined

const COPY: SaveSlotsCopy = {
  title: t('Saves'),
  loading: t('Loading your saves…'),
  slot: (slot) => t(`Slot ${slot}`),
  empty: t('Empty'),
  unreadable: t("This save can't be opened"),
  newer: t('Saved by a newer version of the game'),
  otherContent: t('Saved by another version of the game; your progress will load, the rest will not'),
  writing: t('Saving…'),
  failed: t("Couldn't save this slot"),
  load: t('Continue'),
  newGame: t('New game'),
  delete: t('Delete…'),
  deleteTitle: t('Delete this save?'),
  deleteBody: (name) => t(`${name} will be gone for good.`),
  deleteNewerBody: t('A newer version of the game made this save. Deleting it here cannot be undone.'),
  deleteConfirm: t('Delete'),
  cancel: t('Keep it'),
  more: (count) => t(`+${count} more`),
}

const LONG_LABEL =
  'A very long name for a save that a player typed in a hurry, and then went on and on with, to the end of the line '
const slots = (long: boolean): SaveSlotView[] => [
  { kind: 'empty', slot: 1 },
  { kind: 'ready', slot: 2, savedAt: 100, label: t(long ? LONG_LABEL.repeat(2) : 'Ash, level 3') },
  { kind: 'ready', slot: 3, savedAt: 300 },
  { kind: 'other-content', slot: 4, savedAt: 200, ...(long ? { label: t(LONG_LABEL) } : {}) },
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
    ? t(`Wednesday, 23 September 2026 at 14:${String(savedAt).padStart(2, '0')}:07 Central European Summer Time`)
    : t(`23 Sep, 14:${String(savedAt % 60).padStart(2, '0')}`)
</script>

<ScreenFrame arrangement="stack" back={none} backLabel={t('Back')}>
  {#snippet body()}
    <SaveSlots {view} copy={COPY} {formatTime} onload={none} onnew={none} ondelete={none} />
  {/snippet}
</ScreenFrame>
