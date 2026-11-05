<!--
  The M4.6 primitives for the layout contracts (U-a, M4 spec §4.12), one per `show`, each in a screen
  with Back in its corner row as a game would draw it. The overlays (Modal, Sheet, Toast) sit over such
  a screen. Words are English stand-ins of a typical length, said in the `locale` the contract runs in (the
  player names too: the longer, the stricter).
-->
<script lang="ts" module>
export const PRIMITIVE_SHOWS = [
  'split',
  'option-group',
  'pager-dots',
  'paged-grid',
  'paged-grid-worded',
  'controls',
  'slider',
  'chip',
  'modal',
  'sheet',
  'toast',
  'leaderboard',
  'leaderboard-offline',
  'save-status',
  'save-status-long',
] as const
export type PrimitiveShow = (typeof PRIMITIVE_SHOWS)[number]
/**
 * The least size of `paged-grid-worded`'s tiles (`minTile`): a long language breaks "Level 12" over three lines, which
 * a 44 px tile (`paged-grid`, PagedGrid's default) with the keyboard up could not hold.
 */
export const WORDED_TILE = 64
</script>

<script lang="ts">
import Button from '../../shared/ui/controls/Button.svelte'
import IconButton from '../../shared/ui/controls/IconButton.svelte'
import Slider from '../../shared/ui/controls/Slider.svelte'
import Toggle from '../../shared/ui/controls/Toggle.svelte'
import Modal from '../../shared/ui/dialog/Modal.svelte'
import Sheet from '../../shared/ui/dialog/Sheet.svelte'
import OptionGroup from '../../shared/ui/layout/OptionGroup.svelte'
import PagedGrid from '../../shared/ui/layout/PagedGrid.svelte'
import PagerDots from '../../shared/ui/layout/PagerDots.svelte'
import ScreenFrame from '../../shared/ui/layout/ScreenFrame.svelte'
import Split from '../../shared/ui/layout/Split.svelte'
import Chip from '../../shared/ui/status/Chip.svelte'
import LeaderboardPanel from '../../shared/ui/status/LeaderboardPanel.svelte'
import type { LeaderboardCopy } from '../../shared/ui/status/leaderboard-panel'
import SaveStatus from '../../shared/ui/status/SaveStatus.svelte'
import type { SaveStatusCopy } from '../../shared/ui/status/save-status'
import Toast from '../../shared/ui/status/Toast.svelte'
import { type FixtureLocale, say } from './locale-fixture'

const { show, locale = 'en' }: { show: PrimitiveShow; locale?: FixtureLocale } = $props()
/** A word in the contract's locale, as a game's `t()` would give it. A fixture's props are fixed for its mount. */
const t = (text: string): string => say(locale, text)
const none = (): void => undefined
const OPTIONS = ['low', 'medium', 'high'].map((value) => ({
  value,
  label: t(value[0]?.toUpperCase() + value.slice(1)),
  testId: `option-${value}`,
}))
const tiles = (from: number, count: number, name: (level: number) => string) =>
  Array.from({ length: count }, (_, i) => ({ id: String(from + i), name: name(from + i + 1) }))
const BOARD_COPY: LeaderboardCopy = {
  title: t('Best runs'),
  loading: t('Loading scores…'),
  empty: t('No scores yet'),
  unavailable: t("Scores aren't available here"),
  offline: t("You're offline"),
  you: t('You'),
  more: (count) => t(`+${count} more`),
}
// The longest line the status can take, so the contract holds a wrapped line to the same limits as a short one.
const STATUS_COPY: SaveStatusCopy = {
  checking: t('Checking your progress…'),
  syncing: t('Saving…'),
  saved: t('Progress saved'),
  'offline-queued': t('Offline: your progress will be saved to your account when you are back online'),
  retry: t('Could not save yet; trying again'),
  conflict: t('Choose which progress to keep'),
  recovered: t('Progress restored'),
  'no-grant': t("Progress won't be kept"),
}
const BOARD = Array.from({ length: 12 }, (_, i) => ({
  rank: i + 1,
  displayName: t(['Kite', 'Ash', 'Moss', 'Wren'][i % 4] ?? 'Kite'),
  score: 1000 - i * 37,
  isMe: i === 4,
}))
const groups = (name: (level: number) => string) => [
  { id: 'forest', title: t('Forest'), items: tiles(0, 18, name) },
  { id: 'caves', title: t('Caves'), items: tiles(18, 12, name) },
]
/** Tiles that show their number, the same in every language. */
const NUMBERED = groups(String)
const WORDED = groups((level) => t(`Level ${level}`))
</script>

{#snippet gear()}
  <svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="currentColor" /></svg>
{/snippet}

{#snippet levelTile(tile: { id: string; name: string })}
  <button type="button" class="af-control" style="width: 100%; height: 100%" data-testid={`tile-${tile.id}`}
    >{tile.name}</button
  >
{/snippet}

{#snippet wordedTile(tile: { id: string; name: string })}
  <button
    type="button"
    class="af-control"
    style="width: 100%; height: 100%; overflow-wrap: anywhere"
    data-testid={`tile-${tile.id}`}>{tile.name}</button
  >
{/snippet}

<ScreenFrame arrangement="stack" back={none} backLabel={t('Back')}>
  {#snippet body()}
    {#if show === 'split'}
      <Split min={240}>
        {#snippet first()}<button type="button" class="af-control" data-testid="split-first">{t('Level 1')}</button>{/snippet}
        {#snippet second()}<button type="button" class="af-control" data-testid="split-second">{t('Play')}</button>{/snippet}
      </Split>
    {:else if show === 'option-group'}
      <OptionGroup label={t('Quality')} options={OPTIONS} value="medium" onchange={none} />
    {:else if show === 'pager-dots'}
      <PagerDots label={t('Pages')} count={5} index={1} onselect={none} />
    {:else if show === 'paged-grid'}
      <!-- PagedGrid as it comes: 44 px tiles (`minTile`'s default), each showing its number. -->
      <div style="height: 100%; min-height: 0; display: grid">
        <PagedGrid label={t('Levels')} groups={NUMBERED} most={{ columns: 4, rows: 3 }} page={0} onpage={none} item={levelTile} />
      </div>
    {:else if show === 'paged-grid-worded'}
      <!-- A level tile holds its name, so the game lets a word too long for the tile break inside it, and asks for
           tiles that hold three lines (`minTile`). -->
      <div style="height: 100%; min-height: 0; display: grid">
        <PagedGrid
          label={t('Levels')}
          groups={WORDED}
          most={{ columns: 4, rows: 3 }}
          minTile={WORDED_TILE}
          page={0}
          onpage={none}
          item={wordedTile}
        />
      </div>
    {:else if show === 'controls'}
      <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center">
        <Button kind="primary" testId="button-primary">{#snippet children()}{t('Play')}{/snippet}</Button>
        <Button kind="ghost" testId="button-ghost">{#snippet children()}{t('Credits')}{/snippet}</Button>
        <IconButton label={t('Settings')} icon={gear} testId="icon-button" />
        <Toggle label={t('Music')} checked onLabel={t('On')} offLabel={t('Off')} onchange={none} testId="toggle" />
      </div>
    {:else if show === 'slider'}
      <Slider
        label={t('Music volume')}
        value={40}
        min={0}
        max={100}
        step={10}
        valueText={(value) => `${value}%`}
        onchange={none}
        testId="slider"
      />
    {:else if show === 'chip'}
      <div style="display: flex; flex-wrap: wrap; gap: 8px">
        <Chip text={t('New')} />
        <Chip text={t('Saved')} tone="success" toneLabel={t('Done')} />
        <Chip text={t('Offline')} tone="danger" toneLabel={t('Problem')} testId="chip-danger" />
      </div>
    {:else if show === 'leaderboard' || show === 'leaderboard-offline'}
      <LeaderboardPanel
        view={show === 'leaderboard' ? { state: 'entries', entries: BOARD } : { state: 'offline' }}
        copy={BOARD_COPY}
        testId={show}
      >
        {#snippet actions()}
          <Button kind="primary" testId={`${show}-back`}>{#snippet children()}{t('Back')}{/snippet}</Button>
        {/snippet}
      </LeaderboardPanel>
    {:else if show === 'save-status' || show === 'save-status-long'}
      <SaveStatus
        status={show === 'save-status' ? 'saved' : 'offline-queued'}
        copy={STATUS_COPY}
        testId={show}
      />
    {:else}
      <p style="margin: 0">{t('Choose a level')}</p>
    {/if}
  {/snippet}
</ScreenFrame>

{#if show === 'modal'}
  <Modal title={t('Levels')} closeLabel={t('Close')} onclose={none}>
    <p style="margin: 0">{t('Every level you have reached is listed here, with your best time on each.')}</p>
    {#snippet actions()}
      <Button kind="primary" testId="modal-done">{#snippet children()}{t('Done')}{/snippet}</Button>
    {/snippet}
  </Modal>
{:else if show === 'sheet'}
  <Sheet title={t('More')} closeLabel={t('Close')} onclose={none}>
    <p style="margin: 0">{t('Credits, licences and the privacy notice.')}</p>
    {#snippet actions()}
      <Button kind="primary" testId="sheet-done">{#snippet children()}{t('Done')}{/snippet}</Button>
    {/snippet}
  </Sheet>
{:else if show === 'toast'}
  <Toast text={t('This controller is not supported')} tone="warning" toneLabel={t('Warning')} testId="toast" />
{/if}
