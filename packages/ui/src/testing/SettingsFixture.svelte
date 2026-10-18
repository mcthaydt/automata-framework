<!--
  The core Settings screen for the layout contracts (M4 spec §4.8, M4.4), in FloorFifty's two tabs: `settings` shows
  the Settings tab (Display, Touch controls); `controls` the Controls tab with four actions, both devices and touch; `controls-capturing`
  shows its first row waiting for a press. Words are English stand-ins of a typical length.
-->
<script lang="ts" module>
export const SETTINGS_SHOWS = ['settings', 'controls', 'controls-capturing'] as const
export type SettingsShow = (typeof SETTINGS_SHOWS)[number]
</script>

<script lang="ts">
import type { PromptCopy } from '../prompts/prompt-label'
import ControlsSection from '../settings/ControlsSection.svelte'
import type { ControlsCopy, ControlsRow } from '../settings/controls-section'
import DisplaySection from '../settings/DisplaySection.svelte'
import TouchSection from '../settings/TouchSection.svelte'
import type { DisplayCopy } from '../settings/display-section'
import SettingsScreen from '../settings/SettingsScreen.svelte'

const { show }: { show: SettingsShow } = $props()
const none = (): void => undefined

const PROMPT_COPY: PromptCopy = {
  unbound: 'Unbound',
  touch: 'Tap',
  pad: {
    bottom: 'Bottom button',
    right: 'Right button',
    left: 'Left button',
    top: 'Top button',
    leftBumper: 'Left bumper',
    rightBumper: 'Right bumper',
    leftTrigger: 'Left trigger',
    rightTrigger: 'Right trigger',
    select: 'Select',
    start: 'Start',
    leftStick: 'Left stick',
    rightStick: 'Right stick',
    home: 'Home',
  },
}
const CONTROLS_COPY: ControlsCopy = {
  title: 'Controls',
  keyboard: 'Keyboard',
  gamepad: 'Controller',
  touch: 'Touch',
  inUse: 'In use',
  reset: 'Reset controls',
  press: 'Press…',
  rebind: (action, device) => `Change ${action} on ${device}`,
  capturing: (action, device, seconds) => `Press a ${device} input for ${action} (${seconds} s)`,
  conflict: (action, other) => `${action} can't take that: ${other} would have nothing`,
  reserved: (action) => `That input is kept for menus; pick another for ${action}`,
  timedOut: (action) => `Nothing pressed; ${action} is unchanged`,
  saved: (action) => `${action} saved`,
}
const DISPLAY_COPY: DisplayCopy = {
  title: 'Display',
  quality: 'Graphics quality',
  qualities: { high: 'High', medium: 'Medium', low: 'Low' },
  reducedMotion: (reduced) => `Reduced motion: ${reduced ? 'on' : 'off'} (from your device)`,
}
const ROWS: ControlsRow[] = [
  { id: 'left', label: 'Move left', binding: { keys: ['ArrowLeft'], pad: [14], touch: true } },
  { id: 'right', label: 'Move right', binding: { keys: ['ArrowRight'], pad: [15], touch: true } },
  { id: 'jump', label: 'Jump', binding: { keys: ['Space'], pad: [0], touch: true } },
  { id: 'fire', label: 'Fire', binding: { keys: [], pad: [2], touch: false } },
]
</script>

{#snippet controls()}
  <ControlsSection
    rows={ROWS}
    devices={['keyboard', 'gamepad']}
    touch
    inUse="keyboard"
    glyphs="xbox"
    promptCopy={PROMPT_COPY}
    copy={CONTROLS_COPY}
    state={show === 'controls-capturing'
      ? { kind: 'capturing', action: 'left', device: 'keyboard', secondsLeft: 9 }
      : { kind: 'list' }}
    onrebind={none}
    onreset={none}
  />
{/snippet}

{#snippet touch()}
  <TouchSection
    copy={{ title: 'Touch controls', mode: 'Play with', modes: { buttons: 'Buttons', swipe: 'Swipe' } }}
    modes={['buttons', 'swipe']}
    value="buttons"
    onchange={none}
  />
{/snippet}

{#snippet display()}
  <DisplaySection copy={DISPLAY_COPY} quality="high" onquality={none} reducedMotion={false} />
{/snippet}

<SettingsScreen
  title="Settings"
  backLabel="Back"
  onback={none}
  tabs={[
    { id: 'settings', label: 'Settings', sections: [{ snippet: display }, { snippet: touch }] },
    { id: 'controls', label: 'Controls', sections: [{ snippet: controls }] },
  ]}
  tabsLabel="Settings sections"
  moreLabel={(count) => `+${count} more`}
/>
