<!--
  base-3d’s Game group in Settings (DESIGN.md §12.2): Lock mode, Toggle or Hold, as an option group like the core
  groups. It reads and writes the `game` record of the open Settings screen’s store (`settingsInPlay`).
-->
<script lang="ts">
import { OptionGroup } from '@mcthaydt/automata-ui'
import { LOCK_MODES, type LockMode, lockModeOf, settingsInPlay } from './settings.ts'

const LABELS: Record<LockMode, string> = { toggle: 'Toggle', hold: 'Hold' }

const store = settingsInPlay.store
let value = $state(lockModeOf(store?.get()))

function choose(mode: string): void {
  const lockMode = mode as LockMode
  value = lockMode
  store?.update((record) => ({ ...(record as object), game: { lockMode } }))
}
</script>

<section class="lock-mode" data-settings-section="lock-mode">
  <h3 class="af-settings__heading">Game</h3>
  <OptionGroup
    label="Lock mode"
    options={LOCK_MODES.map((mode) => ({ value: mode, label: LABELS[mode], testId: `lock-mode-${mode}` }))}
    {value}
    onchange={choose}
  />
</section>

<style>
  .lock-mode {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
