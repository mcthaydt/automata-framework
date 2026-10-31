<!--
  base-3d’s Game group in Settings (DESIGN.md §12.2): Lock mode, Toggle or Hold, as an option group like the core
  groups. It reads and writes the `game` record of the open Settings screen’s store (`settingsInPlay`).
-->
<script lang="ts">
import { OptionGroup } from '@mcthaydt/automata-ui'
import { liveCopy } from './copy.svelte.ts'
import { LOCK_MODES, type LockMode, lockModeOf, settingsInPlay } from './settings.ts'

const words = $derived(liveCopy.current)

const store = settingsInPlay.store
let value = $state(lockModeOf(store?.get()))

function choose(mode: string): void {
  const lockMode = mode as LockMode
  value = lockMode
  store?.update((record) => ({ ...(record as object), game: { lockMode } }))
}
</script>

<section class="lock-mode" data-settings-section="lock-mode">
  <h3 class="af-settings__heading">{words.lockMode.heading}</h3>
  <OptionGroup
    label={words.lockMode.label}
    options={LOCK_MODES.map((mode) => ({ value: mode, label: words.lockMode[mode], testId: `lock-mode-${mode}` }))}
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
