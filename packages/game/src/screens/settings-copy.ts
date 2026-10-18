// The default Settings screen's words (M4 spec §4.8). English, like the other default screens' words; PRODUCT.L
// localizes them (02 follow-up).
import type { AudioCopy, ControlsCopy, DisplayCopy, PromptCopy, TouchCopy } from '@mcthaydt/automata-ui'

export const PROMPT_COPY: PromptCopy = {
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

export const CONTROLS_COPY: ControlsCopy = {
  title: 'Controls',
  keyboard: 'Keyboard',
  gamepad: 'Controller',
  touch: 'Touch',
  inUse: 'In use',
  reset: 'Reset controls',
  press: 'Press…',
  rebind: (action, device) => `Change ${action} on ${device}`,
  capturing: (action, device, seconds) =>
    `Press a ${device.toLowerCase()} input for ${action} (${seconds} s). Escape cancels.`,
  conflict: (action, other) => `${action} can't take that: ${other} needs it`,
  reserved: (action) => `That one is kept for menus. Pick another for ${action}.`,
  timedOut: (action) => `Nothing was pressed. ${action} is unchanged.`,
  saved: (action) => `${action} saved`,
}

export const AUDIO_COPY: AudioCopy = {
  title: 'Audio',
  mute: 'Mute',
  muteUnfocused: 'Mute in the background',
  on: 'On',
  off: 'Off',
  buses: { master: 'Master', music: 'Music', sfx: 'Effects', ui: 'Menus', voice: 'Voices' },
  percent: (value) => `${Math.round(value * 100)}%`,
  unavailable: 'Sound could not start on this device.',
  hostVolume: 'Your device’s volume in the host also applies.',
}

export const TOUCH_COPY: TouchCopy = {
  title: 'Touch controls',
  mode: 'Play with',
  modes: { buttons: 'Buttons', swipe: 'Swipe' },
}

export const DISPLAY_COPY: DisplayCopy = {
  title: 'Display',
  quality: 'Graphics quality',
  qualities: { high: 'High', medium: 'Medium', low: 'Low' },
  reducedMotion: (reduced) => `Reduced motion: ${reduced ? 'on' : 'off'} (from your device)`,
}

export const SETTINGS_COPY = {
  title: 'Settings',
  back: 'Back',
  tabs: 'Settings sections',
  settingsTab: 'Settings',
  controlsTab: 'Controls',
  more: (count: number): string => `+${count} more`,
} as const
