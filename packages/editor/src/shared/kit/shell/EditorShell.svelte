<!--
  The editor's responsive shell.

  Seven regions, each a snippet: topbar, rail, panel, canvas, inspector, dock, status. The mode comes from the
  window's size before any keyboard shrank it (`shellModeAt`), the approved mockup's three layouts:

    wide     (1180 px and up) rail | panel | canvas | inspector, dock beneath the canvas, status at the foot
    medium   panel | canvas; the inspector floats over the canvas's lower right when open; the dock is a bottom
             sheet; the rail is a tab bar along the foot
    compact  (760 px and down, or 520 px high and less) the canvas alone; panel, inspector and dock are bottom
             sheets, one open at a time

  Every region is a sibling that stays mounted. A mode change moves it with CSS (grid areas, a transform) and
  never renders it somewhere else, so focus, scroll position and half-typed text survive a rotation or a
  window drag. The floating inspector and the sheets live in the canvas's grid cell, so the safe area, the keyboard and the
  browser bars are already out of their way; a closed one is `inert` and `visibility: hidden`, never
  `display: none`, which would throw its scroll position away.

  `panel` is optional: without one, `wide` gives its column to the canvas (`data-panel="none"`).
  `inspector` is optional as well: without one, `wide` gives its column to the canvas (`data-inspector="none"`).
  `rail` is optional. A screen with no destinations (Home) leaves it out, and the canvas takes the rail's column in
  wide and the tab bar's row below it (`data-rail="none"`). `dock` is optional too: without one, the floating
  inspector in medium keeps to the foot of the canvas instead of rising above where a dock sheet would begin.

  `panelOpen` only matters in `compact` (the panel is in view otherwise) and `inspectorOpen` below `wide`.
  `dockOpen` left `undefined` follows `defaultDockOpen`. The editor puts its own toggles in the top bar or the
  rail and binds these.

  Each region's content sits in its own error boundary: content that throws while rendering or updating
  is replaced by `RegionError` (the message, the details and Copy details) inside the same region box, and the other
  regions carry on. A sheet's handle is outside its boundary, so a broken sheet can still be resized and closed. Errors
  thrown by an event handler are not caught by a boundary; they leave the region as it was.

  The app imports `tokens.css` (and `fonts.css`) once; this component only reads the variables.
-->
<script lang="ts">
import type { GeometryState } from '@automata/framework'
import type { Snippet } from 'svelte'
import RegionError from './RegionError.svelte'
import type { SnippetRegion } from './region-error'
import { shellFoot } from './shell-foot.svelte'
import {
  type Detent,
  defaultDockOpen,
  detentLength,
  dockPlacementOf,
  nextDetent,
  type ShellRegion,
  shellModeAt,
} from './shell-mode'
import { type OpenState, reconcileOpen } from './shell-open'
import './shell-layout.css'
import './shell-regions.css'

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

type Presentation = 'inline' | 'float' | 'sheet'

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

const mode = $derived(shellModeAt(geometry.current))
const tier = $derived(geometry.current.heightTier)
const dockPlacement = $derived(dockPlacementOf(mode, tier))
const dockIsOpen = $derived(dockOpen ?? defaultDockOpen(mode, tier))

const presentation: Record<ShellRegion, Presentation> = $derived({
  panel: mode === 'compact' ? 'sheet' : 'inline',
  inspector: mode === 'wide' ? 'inline' : mode === 'medium' ? 'float' : 'sheet',
  dock: dockPlacement === 'inline' ? 'inline' : 'sheet',
})

// A region is in view when it is inline (panel and inspector always are), or its flag says so.
const visible: Record<ShellRegion, boolean> = $derived({
  panel: presentation.panel === 'inline' || panelOpen,
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

// In medium the floating inspector sits above an open dock sheet, so neither covers the other's controls. A screen with no
// dock has no sheet to make room for, whatever the dock's default says.
const dockLift: string | undefined = $derived(
  mode === 'medium' && dock !== undefined && presentation.dock === 'sheet' && visible.dock
    ? detentLength('dock', detents.dock)
    : undefined,
)

// How far the foot of the shell (the tab bar, and the status line above it or beside the canvas) rises from the
// bottom of the window, so a toast in `sheets` sits above it rather than over its controls.
let railElement = $state<HTMLElement>()
let statusElement = $state<HTMLElement>()
const foot = shellFoot({
  elements: () => [railElement, statusElement],
  railShown: () => rail !== undefined && mode !== 'wide',
  statusShown: () => status !== undefined,
})

function sheetStyle(name: ShellRegion): string | undefined {
  return presentation[name] === 'sheet' ? `--sheet-height: ${detentLength(name, detents[name])}` : undefined
}
</script>

{#snippet guarded(region: SnippetRegion, layout: 'bar' | 'block', content: Snippet)}
  <svelte:boundary>
    {@render content()}
    {#snippet failed(error)}
      <RegionError {region} {error} {layout} />
    {/snippet}
  </svelte:boundary>
{/snippet}

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
  data-panel={panel ? 'present' : 'none'}
  data-inspector={inspector ? 'present' : 'none'}
  data-testid={testId}
  style:--dock-lift={dockLift}
>
  <header class="region" data-region="topbar">{@render guarded('topbar', 'bar', topbar)}</header>

  {#if rail}
    <nav
      class="region"
      data-region="rail"
      data-presentation={mode === 'wide' ? 'rail' : 'tabbar'}
      aria-label="Editor sections"
      bind:this={railElement}
    >
      <!-- Inline rather than `guarded`: the rail's snippet takes an argument (its orientation). -->
      <svelte:boundary>
        {@render rail({ orientation: mode === 'wide' ? 'vertical' : 'horizontal' })}
        {#snippet failed(error)}
          <RegionError region="rail" {error} layout={mode === 'wide' ? 'block' : 'bar'} />
        {/snippet}
      </svelte:boundary>
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
      <div class="body" data-scroll-region>{@render guarded('panel', 'block', panel)}</div>
    </aside>
  {/if}

  <main class="region" data-region="canvas">{@render guarded('canvas', 'block', canvas)}</main>

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
      <div class="body" data-scroll-region>{@render guarded('inspector', 'block', inspector)}</div>
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
      <!-- The dock holds a strip wider than itself (scenes, frames), scrolled sideways: it says so, so the layout
           contract passes what lies past its side. The panel and inspector scroll up and down only. -->
      <div class="body" data-scroll-region="both">{@render guarded('dock', 'block', dock)}</div>
    </section>
  {/if}

  {#if status}
    <footer class="region" data-region="status" bind:this={statusElement}>{@render guarded('status', 'bar', status)}</footer>
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

<!-- `display: contents`: the sheets position themselves; this only hands them the height of the shell's foot. -->
<div class="sheets" style:--shell-foot={foot.lift}>{@render sheets?.()}</div>

<style>
  /* A touch must not behave like a web page's (the Owner, on a real iPad: a double tap zoomed, and a hold selected the
     screen like text). The page takes taps and drags without double-tap zoom (`manipulation`; a canvas says `none` for
     itself below, and pinch stays the page's own), and the chrome is not selectable and shows no long-press callout.
     Fields a person types in and the text they read as code (`data-selectable`) select. The one owner for every editor. */
  :global(html),
  :global(body) {
    touch-action: manipulation;
  }
  /* Every element says it itself (a computed `auto` is not `none`), at zero specificity so the rule below wins. */
  :global(:where(html, body, body *)) {
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
  :global(input),
  :global(textarea),
  :global([contenteditable='true']),
  :global([data-selectable]),
  :global([data-selectable] *) {
    user-select: text;
    -webkit-user-select: text;
    -webkit-touch-callout: default;
  }

  .sheets {
    display: contents;
  }
  /* The shell's own box: the whole window less the safe areas and the keyboard. Its grid is `shell-layout.css`, its
     regions `shell-regions.css`. */
  .shell {
    position: fixed;
    /* The insets and the keyboard come from the geometry owner; without one (a bare fixture) the browser's env(). */
    inset: 0 0 var(--af-visual-inset-bottom, 0px);
    box-sizing: border-box;
    padding: var(--af-inset-top, env(safe-area-inset-top, 0px)) var(--af-inset-right, env(safe-area-inset-right, 0px))
      var(--af-inset-bottom, env(safe-area-inset-bottom, 0px)) var(--af-inset-left, env(safe-area-inset-left, 0px));
    display: grid;
    background: var(--bg);
    color: var(--ink);
    font: var(--text-body-13);
    overflow: hidden;
  }

  /* With the keyboard up the foot already ends above it, and the bottom safe area is under the keyboard. */
  :global(:root[data-visual-inset]) .shell {
    padding-bottom: 0;
  }
</style>
