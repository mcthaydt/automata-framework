<!--
  The default paused screen (DX spec §7), laid out and behaving as FloorFifty's pause overlay
  (`ui/components/PauseOverlay.svelte` at a28dc44, Owner 2026-10-18: "match the layout and function, not the style"):
  a dialog over the dimmed game, titled Paused, with Resume (primary, focused), Mute, Settings and Quit to title, two
  across once the dialog is 340 px wide. Quit asks first, because the run is lost. Escape (the pad's B, the system
  back) steps back one level: from the confirm to the menu, on Quit; from the menu it resumes.
  A game with a save (M5.2) adds the host's word on the progress under the menu, and, once another device has changed
  the slot being played, a step of its own before the menu: Load newer or Keep playing (M5-D6). It is a step and not
  more lines in the menu so the menu's actions never move off a short screen; its two buttons are the dialog's actions,
  outside the body that scrolls, so a short screen scrolls the words and never the buttons.
-->
<script lang="ts">
import {
  type LeaderboardCopy,
  LeaderboardPanel,
  type LeaderboardView,
  Modal,
  SaveStatus,
} from '@mcthaydt/automata-ui'
import { tick } from 'svelte'
import type { PausedSaves } from './saves-paused.ts'

interface Props {
  onResume: () => void
  onQuit: () => void
  /** Opens Settings (M4.4), where the player rebinds controls and picks the quality. */
  onSettings: () => void
  /** Whether sound is muted when paused opens: the Audio group's Mute (M5.4). */
  muted: boolean
  /** Mute was pressed: the new state, applied and saved by the caller. */
  onMute: (muted: boolean) => void
  /** Why play paused, when it was not the player: "Reconnect your controller" (M4-D9). */
  message?: string | undefined
  /** The game's scored board (M5.7): read from the host when paused opens. */
  board?: { copy: LeaderboardCopy; load: () => Promise<LeaderboardView> } | undefined
  /** The game's save (M5.2): the host's word on the progress, and the choice once another device changed it. */
  saves?: PausedSaves | undefined
}

const { onResume, onQuit, onSettings, muted: mutedAtOpen, onMute, message, board, saves }: Props = $props()

// The button's own state from here on; the caller applies and saves each change.
// svelte-ignore state_referenced_locally
let muted = $state(mutedAtOpen)
function toggleMute(): void {
  muted = !muted
  onMute(muted)
}

// The choice comes first when another device has already changed the slot as paused opens.
// svelte-ignore state_referenced_locally
let view = $state<'menu' | 'confirm' | 'elsewhere'>(
  saves?.view.changedElsewhere === true ? 'elsewhere' : 'menu',
)
let root = $state<HTMLElement | undefined>(undefined)
/** Back from the choice leaves it for the menu, with the flag still up: it is not offered again until play resumes. */
let declined = $state(false)

/** Shows a view and puts focus on the button named: the one it was opened from, or the confirm's first. */
async function show(next: 'menu' | 'confirm' | 'elsewhere', focus: string): Promise<void> {
  view = next
  await tick()
  root?.querySelector<HTMLElement>(`[data-testid="${focus}"]`)?.focus()
}

const back = (): void => {
  if (view === 'menu') onResume()
  else if (view === 'elsewhere') {
    declined = true
    void show('menu', 'resume')
  } else void show('menu', 'quit')
}

// The flag rising while paused is open brings the choice; it lowering (Keep playing) takes it away.
$effect(() => {
  const changed = saves?.view.changedElsewhere === true
  if (changed && view === 'menu' && !declined) void show('elsewhere', 'load-newer')
  else if (!changed && view === 'elsewhere') void show('menu', 'resume')
})

let scores = $state<LeaderboardView>({ state: 'loading' })
$effect(() => {
  if (board === undefined) return
  let open = true
  void board.load().then((loaded) => {
    if (open) scores = loaded
  })
  return () => {
    open = false
  }
})
</script>

<!-- The choice's two buttons are the dialog's actions, outside the body that scrolls, so a short screen scrolls the words and never the buttons. -->
{#snippet choice()}
  {#if saves !== undefined}
    <div class="af-pause__choice" data-changed-elsewhere>
      <button
        type="button"
        class="af-control af-control--primary"
        data-kind="primary"
        data-testid="load-newer"
        data-initial-focus
        onclick={saves.onLoadNewer}>{saves.choiceCopy.loadNewer}</button
      >
      <button type="button" class="af-control" data-testid="keep-playing" onclick={saves.onKeepPlaying}
        >{saves.choiceCopy.keepPlaying}</button
      >
    </div>
  {/if}
{/snippet}

<div bind:this={root} class="af-game-menu" data-game-screen="paused">
  <Modal
    title="Paused"
    closeLabel={view === 'menu' ? 'Resume' : 'Back'}
    onclose={back}
    testId="paused-screen"
    actions={view === 'elsewhere' ? choice : undefined}
  >
    <div class="af-pause">
      {#if message !== undefined}
        <p class="af-pause__message" role="status">{message}</p>
      {/if}
      {#if view === 'menu'}
        <div class="af-pause__menu" data-pause-menu>
          <button
            type="button"
            class="af-control af-control--primary"
            data-kind="primary"
            data-testid="resume"
            data-initial-focus
            onclick={onResume}>Resume</button
          >
          <button type="button" class="af-control" data-testid="pause-mute" aria-pressed={muted} onclick={toggleMute}
            >{muted ? 'Unmute' : 'Mute'}</button
          >
          <button type="button" class="af-control" data-testid="settings" onclick={onSettings}>Settings</button>
          <button type="button" class="af-control" data-testid="quit" onclick={() => void show('confirm', 'quit-confirm')}
            >Quit to title</button
          >
        </div>
        <!-- Under the menu, so on a screen too short for both the actions stay on screen and the lines scroll. -->
        {#if saves !== undefined}
          {#if saves.view.loadFailed}
            <p class="af-pause__message" role="alert" data-load-failed>{saves.choiceCopy.failed}</p>
          {/if}
          <SaveStatus status={saves.view.status} copy={saves.statusCopy} />
        {/if}
        {#if board !== undefined}
          <LeaderboardPanel view={scores} copy={board.copy} />
        {/if}
      {:else if view === 'elsewhere' && saves !== undefined}
        <p class="af-pause__message">{saves.choiceCopy.message}</p>
        {#if saves.view.loadFailed}
          <p class="af-pause__message" role="alert" data-load-failed>{saves.choiceCopy.failed}</p>
        {/if}
      {:else}
        <p class="af-pause__message">Quit to title? This run is lost.</p>
        <div class="af-pause__menu">
          <button
            type="button"
            class="af-control af-control--primary"
            data-kind="primary"
            data-testid="quit-confirm"
            onclick={onQuit}>Quit to title</button
          >
          <button type="button" class="af-control" data-testid="quit-cancel" onclick={() => void show('menu', 'quit')}
            >Cancel</button
          >
        </div>
      {/if}
    </div>
  </Modal>
</div>

<style>
  .af-pause {
    display: grid;
    gap: 12px;
  }

  .af-pause__message {
    margin: 0;
    overflow-wrap: anywhere;
  }

  /* One column on a narrow dialog; two across from 340 px, Resume across both (FloorFifty's pause menu). */
  .af-pause__menu {
    display: grid;
    gap: 8px;
  }

  /* The choice, in the dialog's actions: side by side where they fit, one above the other where they do not. */
  .af-pause__choice {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .af-pause__choice > :global(.af-control) {
    flex: 1 1 12rem;
  }

  @container af-dialog (min-width: 340px) {
    .af-pause__menu {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .af-pause__menu > :first-child:nth-last-child(odd) {
      grid-column: span 2;
    }
  }
</style>
