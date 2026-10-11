// Which screen shows. Stand-in for the runtime's Flow manager (M1.5): a pure table, so every transition is
// tested without a browser. Events that make no sense on a screen leave it where it is.

export type Screen = 'splash' | 'menu' | 'room' | 'paused' | 'end'

export type FlowEvent =
  | 'continue' // splash: any key or tap
  | 'play' // menu Play, end Play again
  | 'pause' // the Pause button, Escape or P
  | 'resume'
  | 'quit' // back to the menu
  | 'goal' // the sim's goal.reached
  | 'background' // the host's lifecycle went to background (tab hidden, host overlay, ad)
  | 'menu-request' // the host's "Open game menu"

const TRANSITIONS: Readonly<Record<Screen, Partial<Record<FlowEvent, Screen>>>> = {
  splash: { continue: 'menu' },
  menu: { play: 'room' },
  room: { pause: 'paused', background: 'paused', 'menu-request': 'paused', goal: 'end' },
  paused: { resume: 'room', quit: 'menu' },
  end: { play: 'room', quit: 'menu' },
}

export function next(screen: Screen, event: FlowEvent): Screen {
  return TRANSITIONS[screen][event] ?? screen
}
