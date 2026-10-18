<!--
  The default paused screen (DX spec §7), laid out and behaving as FloorFifty's pause overlay
  (`ui/components/PauseOverlay.svelte` at a28dc44, Owner 2026-10-18: "match the layout and function, not the style"):
  a dialog over the dimmed game, titled Paused, with Resume (primary, focused), Settings and Quit to title, two
  across once the dialog is 340 px wide. Quit asks first, because the run is lost. Escape (the pad's B, the system
  back) steps back one level: from the confirm to the menu, on Quit; from the menu it resumes.
-->
<script lang="ts">
import { type LeaderboardCopy, LeaderboardPanel, type LeaderboardView, Modal } from '@mcthaydt/automata-ui'
import { tick } from 'svelte'

interface Props {
  onResume: () => void
  onQuit: () => void
  /** Opens Settings (M4.4), where the player rebinds controls and picks the quality. */
  onSettings: () => void
  /** Why play paused, when it was not the player: "Reconnect your controller" (M4-D9). */
  message?: string | undefined
  /** The game's scored board (M5.7): read from the host when paused opens. */
  board?: { copy: LeaderboardCopy; load: () => Promise<LeaderboardView> } | undefined
}

const { onResume, onQuit, onSettings, message, board }: Props = $props()

let view = $state<'menu' | 'confirm'>('menu')
let body = $state<HTMLElement | undefined>(undefined)

/** Shows a view and puts focus on the button named: the one it was opened from, or the confirm's first. */
async function show(next: 'menu' | 'confirm', focus: string): Promise<void> {
  view = next
  await tick()
  body?.querySelector<HTMLElement>(`[data-testid="${focus}"]`)?.focus()
}

const back = (): void => (view === 'menu' ? onResume() : void show('menu', 'quit'))

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

<div class="af-game-menu" data-game-screen="paused">
  <Modal title="Paused" closeLabel={view === 'menu' ? 'Resume' : 'Back'} onclose={back} testId="paused-screen">
    <div bind:this={body} class="af-pause">
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
          <button type="button" class="af-control" data-testid="settings" onclick={onSettings}>Settings</button>
          <button type="button" class="af-control" data-testid="quit" onclick={() => void show('confirm', 'quit-confirm')}
            >Quit to title</button
          >
        </div>
        {#if board !== undefined}
          <LeaderboardPanel view={scores} copy={board.copy} />
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

  @container af-dialog (min-width: 340px) {
    .af-pause__menu {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .af-pause__menu > :first-child:nth-last-child(odd) {
      grid-column: span 2;
    }
  }
</style>
