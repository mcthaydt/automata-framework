<!--
  The editor's responsive shell (kit spec §4.2; layout from the Figma mockups in docs/design/editor-2d).

  Seven regions, each a snippet: topbar, rail, panel, canvas, inspector, dock, status. The mode comes from
  the geometry owner's form factor and nothing else (`shellModeOf`):

    wide     rail | panel | canvas | inspector, dock beneath the canvas, status at the foot
    medium   canvas full width; panel and inspector are drawers over its edges; the dock is a bottom sheet;
             the rail is a tab bar along the foot
    compact  as medium, but the panel and inspector are bottom sheets too, one open at a time

  Every region is a sibling that stays mounted. A mode change moves it with CSS (grid areas, a transform) and
  never renders it somewhere else, so focus, scroll position and half-typed text survive a rotation or a
  window drag. Drawers and sheets live in the canvas's grid cell, so the safe area, the keyboard and the
  browser bars are already out of their way; a closed one is `inert` and `visibility: hidden`, never
  `display: none`, which would throw its scroll position away.

  `rail` is optional. A screen with no destinations (Home) leaves it out, and the canvas takes the rail's column in
  wide and the tab bar's row below it (`data-rail="none"`).

  `panelOpen` and `inspectorOpen` only matter below `wide`, where the panel and inspector are always in view.
  `dockOpen` left `undefined` follows `defaultDockOpen`. The editor puts its own toggles in the top bar or the
  rail and binds these.

  The app imports `tokens.css` (and `fonts.css`) once; this component only reads the variables.
-->
<script lang="ts">
import type { GeometryState } from '@mcthaydt/automata-ui'
import type { Snippet } from 'svelte'
import {
  type Detent,
  defaultDockOpen,
  detentLength,
  dockPlacementOf,
  nextDetent,
  type ShellRegion,
  shellModeOf,
} from './shell-mode'
import { type OpenState, reconcileOpen } from './shell-open'

interface Props {
  geometry: GeometryState
  topbar: Snippet
  canvas: Snippet
  /** Told which way to lay out its destinations: a column beside the canvas, or a row along the foot. */
  rail?: Snippet<[{ orientation: 'vertical' | 'horizontal' }]> | undefined
  panel?: Snippet | undefined
  inspector?: Snippet | undefined
  dock?: Snippet | undefined
  status?: Snippet | undefined
  /** Dialogs and toasts. Rendered last, outside the grid; they position themselves above everything. */
  sheets?: Snippet | undefined
  panelOpen?: boolean
  inspectorOpen?: boolean
  dockOpen?: boolean | undefined
  testId?: string | undefined
}

type Presentation = 'inline' | 'drawer' | 'sheet'

let {
  geometry,
  topbar,
  canvas,
  rail,
  panel,
  inspector,
  dock,
  status,
  sheets,
  panelOpen = $bindable(false),
  inspectorOpen = $bindable(false),
  dockOpen = $bindable(undefined),
  testId,
}: Props = $props()

const mode = $derived(shellModeOf(geometry.current.formFactor))
const tier = $derived(geometry.current.heightTier)
const dockPlacement = $derived(dockPlacementOf(mode, tier))
const dockIsOpen = $derived(dockOpen ?? defaultDockOpen(mode, tier))

const sideRegion: Presentation = $derived(mode === 'wide' ? 'inline' : mode === 'medium' ? 'drawer' : 'sheet')
const presentation: Record<ShellRegion, Presentation> = $derived({
  panel: sideRegion,
  inspector: sideRegion,
  dock: dockPlacement === 'inline' ? 'inline' : 'sheet',
})

// A region is in view when it is inline (panel and inspector always are), or its flag says so.
const visible: Record<ShellRegion, boolean> = $derived({
  panel: mode === 'wide' || panelOpen,
  inspector: mode === 'wide' || inspectorOpen,
  dock: dockIsOpen,
})

// Where each sheet was last left. A panel or inspector opens half way; the dock opens as a strip.
let detents = $state<Record<ShellRegion, Detent>>({ panel: 'half', inspector: 'half', dock: 'peek' })

// In compact only one sheet is open: whichever just opened wins. This is the one place the bound flags are
// written for the editor, and it settles after one round (the second run finds nothing to change).
let settled: OpenState | undefined
$effect.pre(() => {
  const current: OpenState = { panel: panelOpen, inspector: inspectorOpen, dock: dockIsOpen }
  const next = reconcileOpen(mode, settled ?? current, current)
  settled = next
  if (next.panel !== panelOpen) panelOpen = next.panel
  if (next.inspector !== inspectorOpen) inspectorOpen = next.inspector
  if (next.dock !== dockIsOpen) dockOpen = next.dock
})

// A sheet taking the full height dims the canvas behind it; tapping the dimmed canvas closes the sheet.
const scrimmed: ShellRegion | undefined = $derived(
  (['panel', 'inspector', 'dock'] as const).find(
    (name) => presentation[name] === 'sheet' && visible[name] && detents[name] === 'full',
  ),
)

function close(name: ShellRegion): void {
  if (name === 'panel') panelOpen = false
  else if (name === 'inspector') inspectorOpen = false
  else dockOpen = false
}

// In medium the drawers end where an open dock sheet begins, so neither covers the other's controls.
const dockLift: string | undefined = $derived(
  mode === 'medium' && presentation.dock === 'sheet' && visible.dock
    ? detentLength('dock', detents.dock)
    : undefined,
)

function sheetStyle(name: ShellRegion): string | undefined {
  return presentation[name] === 'sheet' ? `--sheet-height: ${detentLength(name, detents[name])}` : undefined
}
</script>

{#snippet handle(name: ShellRegion)}
  <button
    type="button"
    class="handle"
    data-sheet-handle
    aria-label={`Resize ${name}`}
    aria-expanded={detents[name] !== 'peek'}
    onclick={() => (detents[name] = nextDetent(detents[name]))}
  >
    <span class="grip"></span>
  </button>
{/snippet}

<div
  class="shell"
  data-editor-shell
  data-mode={mode}
  data-dock={dockPlacement}
  data-rail={rail ? 'present' : 'none'}
  data-testid={testId}
  style:--dock-lift={dockLift}
>
  <header class="region" data-region="topbar">{@render topbar()}</header>

  {#if rail}
    <nav
      class="region"
      data-region="rail"
      data-presentation={mode === 'wide' ? 'rail' : 'tabbar'}
      aria-label="Editor sections"
    >
      {@render rail({ orientation: mode === 'wide' ? 'vertical' : 'horizontal' })}
    </nav>
  {/if}

  {#if panel}
    <aside
      class="region"
      data-region="panel"
      data-presentation={presentation.panel}
      data-open={visible.panel}
      data-detent={presentation.panel === 'sheet' && visible.panel ? detents.panel : undefined}
      inert={!visible.panel}
      aria-label="Panel"
      style={sheetStyle('panel')}
    >
      {#if presentation.panel === 'sheet'}{@render handle('panel')}{/if}
      <div class="body" data-scroll-region>{@render panel()}</div>
    </aside>
  {/if}

  <main class="region" data-region="canvas">{@render canvas()}</main>

  {#if inspector}
    <aside
      class="region"
      data-region="inspector"
      data-presentation={presentation.inspector}
      data-open={visible.inspector}
      data-detent={presentation.inspector === 'sheet' && visible.inspector ? detents.inspector : undefined}
      inert={!visible.inspector}
      aria-label="Inspector"
      style={sheetStyle('inspector')}
    >
      {#if presentation.inspector === 'sheet'}{@render handle('inspector')}{/if}
      <div class="body" data-scroll-region>{@render inspector()}</div>
    </aside>
  {/if}

  {#if dock}
    <section
      class="region"
      data-region="dock"
      data-presentation={presentation.dock}
      data-open={visible.dock}
      data-detent={presentation.dock === 'sheet' && visible.dock ? detents.dock : undefined}
      inert={!visible.dock}
      aria-label="Dock"
      style={sheetStyle('dock')}
    >
      {#if presentation.dock === 'sheet'}{@render handle('dock')}{/if}
      <div class="body" data-scroll-region>{@render dock()}</div>
    </section>
  {/if}

  {#if status}
    <footer class="region" data-region="status">{@render status()}</footer>
  {/if}

  {#if scrimmed}
    <button
      type="button"
      class="scrim"
      data-scrim
      tabindex="-1"
      aria-label={`Close ${scrimmed}`}
      onclick={() => close(scrimmed)}
    ></button>
  {/if}
</div>

{@render sheets?.()}

<style>
  /* Sizes from the mockups (docs/design/editor-2d). Targets never shrink with the window; only gutters do. */
  .shell {
    --shell-topbar: 52px;
    --shell-rail: 56px;
    --shell-tabbar: 64px;
    --shell-panel: 264px;
    --shell-inspector: 320px;
    --shell-drawer: 320px;
    --shell-dock: 148px;
    position: fixed;
    /* The insets and the keyboard come from the geometry owner; without one (a bare fixture) the browser's env(). */
    inset: 0 0 var(--af-visual-inset-bottom, 0px);
    box-sizing: border-box;
    padding: var(--af-inset-top, env(safe-area-inset-top, 0px)) var(--af-inset-right, env(safe-area-inset-right, 0px))
      var(--af-inset-bottom, env(safe-area-inset-bottom, 0px)) var(--af-inset-left, env(safe-area-inset-left, 0px));
    display: grid;
    background: var(--color-bg-app);
    color: var(--color-text-primary);
    font: var(--text-body-13);
    overflow: hidden;
  }

  /* With the keyboard up the foot already ends above it, and the bottom safe area is under the keyboard. */
  :global(:root[data-visual-inset]) .shell {
    padding-bottom: 0;
  }

  .shell[data-mode='wide'] {
    grid-template-columns: var(--shell-rail) var(--shell-panel) minmax(0, 1fr) var(--shell-inspector);
    grid-template-rows: var(--shell-topbar) minmax(0, 1fr) auto auto;
    grid-template-areas:
      'topbar topbar topbar topbar'
      'rail panel canvas inspector'
      'rail panel dock inspector'
      'status status status status';
  }

  /* A short window keeps the dock out of the grid: it is a sheet over the canvas, summoned by the editor. */
  .shell[data-mode='wide'][data-dock='sheet'] {
    grid-template-areas:
      'topbar topbar topbar topbar'
      'rail panel canvas inspector'
      'rail panel canvas inspector'
      'status status status status';
  }

  .shell[data-mode='medium'],
  .shell[data-mode='compact'] {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: var(--shell-topbar) minmax(0, 1fr) auto var(--shell-tabbar);
    grid-template-areas:
      'topbar'
      'canvas'
      'status'
      'rail';
  }

  /* A screen with no destinations (Home) gives the rail's column, and the tab bar's row, to the canvas. */
  .shell[data-mode='wide'][data-rail='none'] {
    grid-template-columns: var(--shell-panel) minmax(0, 1fr) var(--shell-inspector);
    grid-template-areas:
      'topbar topbar topbar'
      'panel canvas inspector'
      'panel dock inspector'
      'status status status';
  }

  .shell[data-mode='wide'][data-rail='none'][data-dock='sheet'] {
    grid-template-areas:
      'topbar topbar topbar'
      'panel canvas inspector'
      'panel canvas inspector'
      'status status status';
  }

  .shell[data-mode='medium'][data-rail='none'],
  .shell[data-mode='compact'][data-rail='none'] {
    grid-template-rows: var(--shell-topbar) minmax(0, 1fr) auto;
    grid-template-areas:
      'topbar'
      'canvas'
      'status';
  }

  .region {
    box-sizing: border-box;
    min-width: 0;
    min-height: 0;
  }

  [data-region='topbar'] {
    grid-area: topbar;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 0 var(--space-2);
    background: var(--color-bg-surface);
    border-bottom: 1px solid var(--color-border-default);
  }

  [data-region='rail'] {
    grid-area: rail;
    display: flex;
    background: var(--color-bg-surface);
  }

  [data-region='rail'][data-presentation='rail'] {
    flex-direction: column;
    border-right: 1px solid var(--color-border-default);
  }

  [data-region='rail'][data-presentation='tabbar'] {
    flex-direction: row;
    border-top: 1px solid var(--color-border-default);
  }

  [data-region='canvas'] {
    grid-area: canvas;
    position: relative;
    overflow: hidden;
    background: var(--color-bg-canvas);
    /* The canvas takes every gesture itself: it never scrolls or pulls the page. */
    touch-action: none;
    overscroll-behavior: none;
  }

  [data-region='status'] {
    grid-area: status;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: 0 var(--space-3);
    min-height: 28px;
    font: var(--text-mono-11);
    color: var(--color-text-dim);
    background: var(--color-bg-surface);
    border-top: 1px solid var(--color-border-default);
  }

  /* panel, inspector and dock share a column: an optional handle, then the scrolling body. */
  [data-region='panel'],
  [data-region='inspector'],
  [data-region='dock'] {
    display: flex;
    flex-direction: column;
    background: var(--color-bg-surface);
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    padding: var(--space-2);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  [data-region='panel'][data-presentation='inline'] {
    grid-area: panel;
    border-right: 1px solid var(--color-border-default);
  }

  [data-region='inspector'][data-presentation='inline'] {
    grid-area: inspector;
    border-left: 1px solid var(--color-border-default);
  }

  [data-region='dock'][data-presentation='inline'] {
    grid-area: dock;
    height: var(--shell-dock);
    border-top: 1px solid var(--color-border-default);
  }

  [data-region='dock'][data-presentation='inline'][data-open='false'] {
    height: 0;
    border-top-width: 0;
    visibility: hidden;
  }

  /* Drawers and sheets sit in the canvas's cell, above it. */
  [data-presentation='drawer'],
  [data-presentation='sheet'] {
    grid-area: canvas;
    z-index: 2;
    transition: none;
  }

  [data-presentation='drawer'] {
    align-self: start;
    height: calc(100% - var(--dock-lift, 0px));
    width: min(var(--shell-drawer), 100%);
    box-shadow: 0 0 24px rgb(0 0 0 / 0.4);
  }

  [data-region='panel'][data-presentation='drawer'] {
    justify-self: start;
    border-right: 1px solid var(--color-border-default);
    transform: translateX(-100%);
  }

  [data-region='inspector'][data-presentation='drawer'] {
    justify-self: end;
    border-left: 1px solid var(--color-border-default);
    transform: translateX(100%);
  }

  [data-presentation='drawer'][data-open='true'] {
    transform: none;
  }

  [data-presentation='sheet'] {
    align-self: end;
    justify-self: stretch;
    height: var(--sheet-height);
    border-top: 1px solid var(--color-border-strong);
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    box-shadow: 0 -8px 24px rgb(0 0 0 / 0.4);
    transform: translateY(100%);
  }

  [data-presentation='sheet'][data-open='true'] {
    transform: none;
  }

  /* Closed: out of sight and out of the tab order, but still laid out so scroll positions are kept. */
  [data-presentation='drawer'][data-open='false'],
  [data-presentation='sheet'][data-open='false'] {
    visibility: hidden;
  }

  @media (prefers-reduced-motion: no-preference) {
    [data-presentation='drawer'],
    [data-presentation='sheet'] {
      transition:
        transform 160ms ease-out,
        visibility 0s linear 160ms;
    }

    [data-presentation='drawer'][data-open='true'],
    [data-presentation='sheet'][data-open='true'] {
      transition:
        transform 160ms ease-out,
        visibility 0s;
    }
  }

  .handle {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: var(--size-hit);
    padding: 0;
    background: transparent;
    border: 0;
    cursor: pointer;
  }

  .handle:focus-visible {
    outline: 2px solid var(--color-accent-default);
    outline-offset: -4px;
    border-radius: var(--radius-md);
  }

  .grip {
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: var(--color-border-strong);
  }

  .scrim {
    grid-area: canvas;
    z-index: 1;
    padding: 0;
    border: 0;
    background: rgb(0 0 0 / 0.45);
    cursor: default;
  }
</style>
