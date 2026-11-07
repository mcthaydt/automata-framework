<!--
  One primitive full-window, with the demo's own content. The screen picks its arrangement from the
  owner's geometry, as a game's screen root would: stacked when portrait, side by side otherwise.
  A fake keyboard and Ruken's strip are drawn so a reader can see what the layout stays clear of.
-->
<script lang="ts">
import {
  ActionBar,
  type BarAction,
  BootFailurePanel,
  Button,
  Chip,
  Dialog,
  type GeometryState,
  IconButton,
  LeaderboardPanel,
  LoaderOverlay,
  Modal,
  OptionGroup,
  PagedGrid,
  PagerDots,
  ScreenFrame,
  ScrollList,
  Sheet,
  Slider,
  Split,
  Toast,
  Toggle,
} from '@automata/framework'
import type { Primitive } from '../main'

interface Props {
  primitive: Primitive
  geometry: GeometryState
  strip: { edge: 'left' | 'right'; width: number } | undefined
  keyboard: () => number
}

const { primitive, geometry, strip, keyboard }: Props = $props()

const arrangement = $derived(geometry.current.formFactor.endsWith('portrait') ? 'stack' : 'split')
const keyboardHeight = $derived(geometry.current.visualInsetBottom > 0 ? keyboard() : 0)

// A board as the host returns it: the player is fifth, so the panel's "you" row sits mid-list.
const BOARD = ['Kite', 'Ash', 'Moss', 'Wren', 'You', 'Fern', 'Pip', 'Juno', 'Rook', 'Sol'].map(
  (displayName, i) => ({
    rank: i + 1,
    displayName,
    score: 9_400 - i * 610,
    isMe: i === 4,
  }),
)
const BOARD_COPY = {
  title: 'Best runs',
  loading: 'Loading scores…',
  empty: 'No scores yet',
  unavailable: "Scores aren't available here",
  offline: "You're offline",
  you: 'You',
  more: (count: number) => `+${count} more`,
}
const LEVELS = ['Mossy Steps', 'Bubble Cave', 'Summit Wind', 'Lantern Lake', 'Old Tower', 'Star Garden']
const none = (): void => undefined
const OVERLAID: readonly Primitive[] = ['modal', 'sheet', 'toast']
const IN_FRAME: readonly Primitive[] = [
  'split',
  'options',
  'pager',
  'paged-grid',
  'controls',
  'chip',
  'leaderboard',
]

// The demo owns the state a game's screen would, so the controls answer a player.
let quality = $state<string | undefined>('medium')
let music = $state(true)
let volume = $state(60)
let page = $state(0)
let dot = $state(1)
const QUALITY = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]
const WORLDS = [
  { id: 'meadow', title: 'Meadow', items: LEVELS.map((name, i) => ({ id: `m${i}`, name })) },
  {
    id: 'caves',
    title: 'Caves',
    items: LEVELS.slice(0, 4).map((name, i) => ({ id: `c${i}`, name: `${name} II` })),
  },
]
const barActions: BarAction[] = [
  { id: 'play', label: 'Play', kind: 'primary', onSelect: none },
  { id: 'settings', label: 'Settings', shortLabel: 'Set', kind: 'secondary', onSelect: none },
  { id: 'help', label: 'Help', kind: 'utility', onSelect: none },
]
</script>

{#snippet speaker()}
  <svg viewBox="0 0 10 10"><path d="M1 4h2l3-3v8L3 6H1z" fill="currentColor" /></svg>
{/snippet}

<div data-demo={primitive}>
  {#if primitive === 'screen' || primitive === 'dialog'}
    <ScreenFrame {arrangement} back={none} testId="screen">
      {#snippet header()}<strong>Choose a level</strong>{/snippet}
      {#snippet end()}<button type="button" class="af-control af-control--ghost">Mute</button>{/snippet}
      {#snippet hero()}<div class="hero" aria-hidden="true"></div>{/snippet}
      {#snippet body()}
        <ScrollList minRows={2} rowCount={LEVELS.length} rowGap="8px" label="Levels" moreLabel={(n) => `+${n} more`}>
          <div class="rows">
            {#each LEVELS as level (level)}
              <button type="button" class="af-control" data-row>{level}</button>
            {/each}
          </div>
        </ScrollList>
      {/snippet}
      {#snippet actions()}<ActionBar actions={barActions} />{/snippet}
    </ScreenFrame>
  {/if}
  {#if IN_FRAME.includes(primitive) || OVERLAID.includes(primitive)}
    <ScreenFrame arrangement="stack" back={none} testId="screen">
      {#snippet header()}<strong>{primitive}</strong>{/snippet}
      {#snippet body()}
        {#if primitive === 'split'}
          <Split min={240}>
            {#snippet first()}<div class="hero" aria-hidden="true"></div>{/snippet}
            {#snippet second()}
              <div class="rows">{#each LEVELS.slice(0, 3) as level (level)}<button type="button" class="af-control">{level}</button>{/each}</div>
            {/snippet}
          </Split>
        {:else if primitive === 'options'}
          <OptionGroup label="Quality" options={QUALITY} value={quality} onchange={(value) => (quality = value)} />
        {:else if primitive === 'pager'}
          <PagerDots label="Pages" count={5} index={dot} onselect={(index) => (dot = index)} />
        {:else if primitive === 'paged-grid'}
          <div class="fill">
            <PagedGrid label="Levels" groups={WORLDS} most={{ columns: 3, rows: 2 }} {page} onpage={(next) => (page = next)}>
              {#snippet item(level)}<button type="button" class="af-control tile">{level.name}</button>{/snippet}
            </PagedGrid>
          </div>
        {:else if primitive === 'controls'}
          <div class="rows">
            <div class="row">
              <Button kind="primary">{#snippet children()}Play{/snippet}</Button>
              <Button>{#snippet children()}Settings{/snippet}</Button>
              <Button kind="ghost">{#snippet children()}Credits{/snippet}</Button>
              <IconButton label="Mute" icon={speaker} />
            </div>
            <Toggle label="Music" checked={music} onLabel="On" offLabel="Off" onchange={(on) => (music = on)} />
            <Slider label="Music volume" value={volume} min={0} max={100} step={10} valueText={(v) => `${v}%`} onchange={(v) => (volume = v)} />
          </div>
        {:else if primitive === 'chip'}
          <div class="row">
            <Chip text="New" />
            <Chip text="Saved" tone="success" toneLabel="Done" />
            <Chip text="Low battery" tone="warning" toneLabel="Warning" />
            <Chip text="Offline" tone="danger" toneLabel="Problem" />
          </div>
        {:else if primitive === 'leaderboard'}
          <LeaderboardPanel view={{ state: 'entries', entries: BOARD }} copy={BOARD_COPY}>
            {#snippet actions()}<Button kind="primary">{#snippet children()}Play again{/snippet}</Button>{/snippet}
          </LeaderboardPanel>
        {:else}
          <p>Choose a level</p>
        {/if}
      {/snippet}
    </ScreenFrame>
  {/if}
  {#if primitive === 'modal'}
    <Modal title="Levels" closeLabel="Close" onclose={none}>
      <p>Every level you have reached is listed here, with your best time on each.</p>
      {#snippet actions()}<Button kind="primary">{#snippet children()}Done{/snippet}</Button>{/snippet}
    </Modal>
  {:else if primitive === 'sheet'}
    <Sheet title="More" closeLabel="Close" onclose={none}>
      <p>Credits, licences and the privacy notice.</p>
      {#snippet actions()}<Button kind="primary">{#snippet children()}Done{/snippet}</Button>{/snippet}
    </Sheet>
  {:else if primitive === 'toast'}
    <Toast text="This controller is not supported" tone="warning" toneLabel="Warning" />
  {:else if primitive === 'dialog'}
    <Dialog title="Delete this save?" onclose={none}>
      <p>Your progress in this slot will be gone for good. Other slots are not touched.</p>
      {#snippet actions()}
        <button type="button" class="af-control" data-initial-focus>Keep it</button>
        <button type="button" class="af-control af-control--primary" data-kind="primary">Delete</button>
      {/snippet}
    </Dialog>
  {:else if primitive === 'loader'}
    <LoaderOverlay label="Loading the game" progress={0.4} slow slowLabel="This is taking a while." />
  {:else if primitive === 'error'}
    <BootFailurePanel
      failure={{ _tag: 'HostError', code: 'TIMEOUT', retryable: true, operation: 'saves.get' }}
      hostKind="ruken"
      hostName="Ruken"
      canExit
      onRetry={none}
      onExit={none}
    />
  {/if}
  {#if strip !== undefined && strip.width > 0}
    <div class="strip" style:width={`${strip.width}px`} style:left={strip.edge === 'left' ? '0' : 'auto'} style:right={strip.edge === 'right' ? '0' : 'auto'} aria-hidden="true">Ruken</div>
  {/if}
  {#if keyboardHeight > 0}
    <div class="keyboard" style:height={`${keyboardHeight}px`} aria-hidden="true">keyboard</div>
  {/if}
</div>

<style>
  .hero {
    width: 100%;
    height: 100%;
    min-height: 0;
    border-radius: var(--af-radius);
    /* Endesga 64 sky over moss, a placeholder for the game's art. */
    background: linear-gradient(#0098dc, #1e6f50);
  }

  .rows {
    display: grid;
    gap: 8px;
  }

  .rows > button {
    width: 100%;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .fill {
    display: grid;
    height: 100%;
    min-height: 0;
  }

  .tile {
    width: 100%;
    height: 100%;
  }

  .strip,
  .keyboard {
    position: fixed;
    z-index: 200;
    display: grid;
    place-items: center;
    color: var(--af-ink);
    font: var(--af-text-small) var(--af-font);
    pointer-events: none;
    opacity: 0.85;
  }

  .strip {
    top: 0;
    bottom: 0;
    background: #3e3546;
    writing-mode: vertical-rl;
  }

  .keyboard {
    left: 0;
    right: 0;
    bottom: 0;
    background: #3e3546;
  }
</style>
