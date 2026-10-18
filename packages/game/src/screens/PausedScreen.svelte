<!--
  The default paused screen (DX spec §7): Resume (primary, focused by the flow) and Quit to title, with Settings
  (M4.4) as a gear at the end of the corner row, where a phone's short action bar never has to fit a third action,
  over a scrim so the paused game shows through.
-->
<script lang="ts">
import {
  ActionBar,
  IconButton,
  type LeaderboardCopy,
  LeaderboardPanel,
  type LeaderboardView,
  ScreenFrame,
} from '@mcthaydt/automata-ui'

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

let view = $state<LeaderboardView>({ state: 'loading' })
$effect(() => {
  if (board === undefined) return
  let open = true
  void board.load().then((loaded) => {
    if (open) view = loaded
  })
  return () => {
    open = false
  }
})
</script>

{#snippet body()}
  <div class="af-game-menu__body">
    <h2 class="af-game-menu__title">Paused</h2>
    {#if message !== undefined}
      <p class="af-game-menu__message" role="status">{message}</p>
    {/if}
    {#if board !== undefined}
      <LeaderboardPanel {view} copy={board.copy} />
    {/if}
  </div>
{/snippet}

{#snippet actions()}
  <ActionBar
    actions={[
      { id: 'resume', label: 'Resume', kind: 'primary', onSelect: onResume },
      { id: 'quit', label: 'Quit to title', shortLabel: 'Quit', kind: 'secondary', onSelect: onQuit },
    ]}
  />
{/snippet}

{#snippet gear()}
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path
      fill="currentColor"
      d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 1.7 1L11 21h4l.4-2.6a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.4zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"
    />
  </svg>
{/snippet}

{#snippet end()}
  <IconButton label="Settings" icon={gear} onclick={onSettings} testId="settings" />
{/snippet}

<div class="af-game-menu af-game-menu--scrim" data-game-screen="paused">
  <ScreenFrame arrangement="stack" testId="paused-screen" {body} {actions} {end} />
</div>
