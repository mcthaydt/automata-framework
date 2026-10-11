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
  Dialog,
  type GeometryState,
  LoaderOverlay,
  ScreenFrame,
  ScrollList,
} from '@mcthaydt/automata-ui'

interface Props {
  primitive: 'screen' | 'dialog' | 'loader' | 'error'
  geometry: GeometryState
  strip: { edge: 'left' | 'right'; width: number } | undefined
  keyboard: () => number
}

const { primitive, geometry, strip, keyboard }: Props = $props()

const arrangement = $derived(geometry.current.formFactor.endsWith('portrait') ? 'stack' : 'split')
const keyboardHeight = $derived(geometry.current.visualInsetBottom > 0 ? keyboard() : 0)

const LEVELS = ['Mossy Steps', 'Bubble Cave', 'Summit Wind', 'Lantern Lake', 'Old Tower', 'Star Garden']
const none = (): void => undefined
const barActions: BarAction[] = [
  { id: 'play', label: 'Play', kind: 'primary', onSelect: none },
  { id: 'settings', label: 'Settings', shortLabel: 'Set', kind: 'secondary', onSelect: none },
  { id: 'help', label: 'Help', kind: 'utility', onSelect: none },
]
</script>

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
  {#if primitive === 'dialog'}
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
