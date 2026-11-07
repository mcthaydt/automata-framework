<!--
  @component
  The pause screen (PRODUCT.6): a dialog over the dimmed game with Resume (primary, focused), Mute, Settings and Quit. Quit asks first,
  because the run is lost. Escape (the pad's B, the system back) steps back one level: from the confirm to the menu, from the
  menu to resuming. The words are core's `ScreensCopy['paused']`. A game with a save, a leaderboard or a controller to
  reconnect uses core's default pause for those; this one is the plain version to edit.
-->
<script lang="ts">
import { Modal } from '@automata/framework'
import { tick } from 'svelte'

/** Core's `ScreensCopy['paused']`, the part this screen reads. */
export interface PauseCopy {
  readonly title: string
  readonly resume: string
  readonly back: string
  readonly mute: string
  readonly unmute: string
  readonly settings: string
  readonly quit: string
  readonly quitPrompt: string
  readonly quitConfirm: string
  readonly cancel: string
  readonly reconnect: string
}

interface Props {
  copy: PauseCopy
  /** Whether sound is muted when pause opens. */
  muted: boolean
  onResume: () => void
  onQuit: () => void
  onSettings: () => void
  /** Mute was pressed: the new state, applied and saved by the caller. */
  onMute: (muted: boolean) => void
  /** Play paused because the controller in use was unplugged: says to reconnect it. */
  reconnect?: boolean | undefined
}

const { copy, muted: mutedAtOpen, onResume, onQuit, onSettings, onMute, reconnect = false }: Props = $props()

// The button's own state from here on; the caller applies and saves each change.
// svelte-ignore state_referenced_locally
let muted = $state(mutedAtOpen)
let view = $state<'menu' | 'confirm'>('menu')
let root = $state<HTMLElement | undefined>(undefined)

function toggleMute(): void {
  muted = !muted
  onMute(muted)
}

/** Shows a view and puts focus on the button named. */
async function show(next: 'menu' | 'confirm', focus: string): Promise<void> {
  view = next
  await tick()
  root?.querySelector<HTMLElement>(`[data-testid="${focus}"]`)?.focus()
}

const back = (): void => {
  if (view === 'menu') onResume()
  else void show('menu', 'quit')
}
</script>

<div bind:this={root} class="pause" data-game-screen="paused">
  <Modal title={copy.title} closeLabel={view === 'menu' ? copy.resume : copy.back} onclose={back} testId="paused-screen">
    <div class="pause__body">
      {#if view === 'menu'}
        <div class="pause__menu" data-pause-menu>
          <button type="button" class="af-control af-control--primary" data-kind="primary" data-testid="resume" data-initial-focus onclick={onResume}>{copy.resume}</button>
          <button type="button" class="af-control" data-testid="pause-mute" aria-pressed={muted} onclick={toggleMute}>{muted ? copy.unmute : copy.mute}</button>
          <button type="button" class="af-control" data-testid="settings" onclick={onSettings}>{copy.settings}</button>
          <button type="button" class="af-control" data-testid="quit" onclick={() => void show('confirm', 'quit-confirm')}>{copy.quit}</button>
        </div>
        <!-- Under the menu, so on a screen too short for both the actions stay on screen and the line scrolls (as core's default pause does). -->
        {#if reconnect}
          <p class="pause__message" role="status">{copy.reconnect}</p>
        {/if}
      {:else}
        <p class="pause__message">{copy.quitPrompt}</p>
        <div class="pause__menu">
          <button type="button" class="af-control af-control--primary" data-kind="primary" data-testid="quit-confirm" onclick={onQuit}>{copy.quitConfirm}</button>
          <button type="button" class="af-control" data-testid="quit-cancel" onclick={() => void show('menu', 'quit')}>{copy.cancel}</button>
        </div>
      {/if}
    </div>
  </Modal>
</div>

<style>
  .pause__body {
    display: grid;
    gap: 12px;
  }
  .pause__message {
    margin: 0;
    overflow-wrap: anywhere;
  }
  /* One column on a narrow dialog; two across from 340 px, with an odd last button across both. */
  .pause__menu {
    display: grid;
    gap: 8px;
  }
  @container af-dialog (min-width: 340px) {
    .pause__menu {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .pause__menu > :first-child:nth-last-child(odd) {
      grid-column: span 2;
    }
  }
</style>
