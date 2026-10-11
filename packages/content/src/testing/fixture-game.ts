// The fixture game: FloorFifty's own declarations (FloorFifty 122a220), registered through the AF API.
// `TUNABLES` is copied from packages/shared/src/common/tuning.ts, `AUTHORING_INVARIANTS` from
// packages/content/src/validate/bounds.ts, and the flow capability map from
// packages/shared/src/content/presentation.ts (SCREEN_IDS, FLOW_TARGETS, TRANSITION_STYLES).
// `fixtures/valid/content/flow.toml` and `tuning.toml` are FloorFifty's shipped files, byte for byte.

import { fileURLToPath } from 'node:url'
import type { FlowCapabilities } from '../flow/check-flow'
import type { TunableDeclarations } from '../tuning/check-tuning'

export const FIXTURES: string = fileURLToPath(new URL('./fixtures/', import.meta.url))

export const TUNABLES: TunableDeclarations = {
  COURSE_FLOOR_COUNT: { type: 'int', min: 20, max: 100, default: 20 },
  FLOOR_WIDTH: { type: 'int', min: 64, max: 256, default: 120 },
  FLOOR_HEIGHT: { type: 'int', min: 8, max: 64, default: 20 },
  PLAYER_WIDTH: { type: 'int', min: 16, max: 96, default: 59 },
  PLAYER_HEIGHT: { type: 'int', min: 16, max: 128, default: 59 },
  GRAVITY: { type: 'float', min: -1200, max: -100, default: -275 },
  BOUNCE_VELOCITY: { type: 'float', min: 100, max: 1200, default: 268.2 },
  MAX_MOVE_SPEED: { type: 'float', min: 50, max: 900, default: 356 },
  FAST_FALL_VELOCITY: { type: 'float', min: -2000, max: -100, default: -1341 },
  FLOOR_GAP_MIN: { type: 'float', min: 40, max: 200, default: 540 / 4.2 },
  FLOOR_GAP_MAX: { type: 'float', min: 40, max: 320, default: 540 / 4.2 },
  MOVING_FLOOR_SPEED_MIN: { type: 'float', min: 0, max: 400, default: 100 },
  MOVING_FLOOR_SPEED_MAX: { type: 'float', min: 0, max: 400, default: 200 },
  DEATH_LINE_MARGIN: { type: 'int', min: 100, max: 800, default: 265 },
  LAP_HOLD_TICKS: { type: 'int', min: 0, max: 120, default: 48 },
  MOVING_FLOOR_CARRY: { type: 'float', min: 0, max: 1, default: 1 },
  RACE_TIME_LIMIT_TICKS: { type: 'int', min: 0, max: 36_000, default: 0 },
  SURVIVAL_VIEW_HEIGHT: { type: 'float', min: 300, max: 1200, default: 480 },
  SURVIVAL_GRACE_TICKS: { type: 'int', min: 0, max: 1800, default: 180 },
  SURVIVAL_RISE_START: { type: 'float', min: 0, max: 400, default: 55 },
  SURVIVAL_RISE_STEP: { type: 'float', min: 0, max: 200, default: 20 },
  SURVIVAL_RISE_STEP_TICKS: { type: 'int', min: 60, max: 3600, default: 1800 },
  SURVIVAL_RISE_CAP: { type: 'float', min: 0, max: 400, default: 150 },
  SURVIVAL_PUSH_AT: { type: 'float', min: 0.3, max: 0.9, default: 0.55 },
  SURVIVAL_PUSH_SPEED: { type: 'float', min: 50, max: 1200, default: 300 },
  SURVIVAL_BAND_AHEAD_STEP: { type: 'float', min: 0, max: 1, default: 0.1 },
  SURVIVAL_BAND_AHEAD_MAX: { type: 'float', min: 1, max: 3, default: 1.5 },
  SURVIVAL_BAND_BEHIND_STEP: { type: 'float', min: 0, max: 1, default: 0.05 },
  SURVIVAL_BAND_BEHIND_MIN: { type: 'float', min: 0.1, max: 1, default: 0.7 },
  DEMAND_RAMP_FROM_FLOOR: { type: 'int', min: 50, max: 1000, default: 50 },
  DEMAND_RAMP_BAND_FLOORS: { type: 'int', min: 1, max: 100, default: 10 },
  MOVING_SHARE_STEP: { type: 'float', min: 0, max: 0.5, default: 0.05 },
  MOVING_SHARE_MAX: { type: 'float', min: 0.5, max: 1, default: 0.8 },
  MOVING_SPEED_STEP: { type: 'float', min: 0, max: 100, default: 10 },
  MOVING_FLOOR_SPEED_CAP: { type: 'float', min: 0, max: 400, default: 300 },
}

export const INVARIANTS: readonly string[] = [
  'TICK_HZ',
  'TICK_MS',
  'TICK_SECONDS',
  'SNAPSHOT_HZ',
  'VIEWPORT',
  'VIEWPORT_WIDTH',
  'VIEWPORT_HEIGHT',
  'MAX_PLAYERS',
  'PROTOCOL_VERSION',
  'COUNTDOWN_TICKS',
  'RECONNECT_GRACE_TICKS',
]

/** The values `resolveTuning()` gives in FloorFifty: every tunable at its default. */
export const TUNABLE_DEFAULTS: Readonly<Record<string, number>> = Object.fromEntries(
  Object.entries(TUNABLES).map(([name, declaration]) => [name, declaration.default]),
)

export const FLOW: FlowCapabilities = {
  entry: 'Splash',
  screens: ['Splash', 'MainMenu', 'Lobby', 'Gameplay', 'GameEnd', 'Tutorial', 'Replay'],
  targets: {
    Splash: { splashComplete: ['MainMenu'], resumeRoom: ['Lobby'] },
    MainMenu: { play: ['Lobby'], tutorial: ['Tutorial'] },
    Lobby: {
      back: ['MainMenu'],
      roomRacing: ['Gameplay'],
      raceFinished: ['GameEnd'],
      tutorial: ['Tutorial'],
    },
    Gameplay: { raceFinished: ['GameEnd'], recoverToMenu: ['MainMenu'], leaveRace: ['MainMenu'] },
    GameEnd: {
      raceAgain: ['Lobby'],
      returnToMenu: ['MainMenu'],
      roomRacing: ['Gameplay'],
      watchReplay: ['Replay'],
    },
    Tutorial: { tutorialToTitle: ['MainMenu'], tutorialToLobby: ['Lobby'] },
    Replay: { replayExit: ['GameEnd'], replayExitToRoom: ['Lobby'] },
  },
  styles: ['cut', 'liquid'],
}
