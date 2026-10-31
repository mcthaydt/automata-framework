import {
  type EffectorId,
  evaluate,
  type FigureClipDef,
  type FigureDef,
  type FigureLibrary,
  J,
  MASK_GROUPS,
  type MotionLibrary,
  type PoseDef,
  skeleton,
} from '@mcthaydt/automata-figures'
import type { FigureViewState } from '@mcthaydt/automata-render-pixi3d'
import { type Readable, writable } from 'svelte/store'
import { DEFAULT_ORBIT, type Orbit, type Vec3 } from './stage/stage-camera'
import type { StudioContent } from './studio-content'

// What the Studio shows (EDS.9a to EDS.9c; editor suite spec §6.2): the view's own state (the mode, the chosen figure,
// pose and clip, the stage's orbit, the playhead) and, from it and the content, what the stage draws and where the
// pose handles stand. Headless and pure beyond the store, so the cases of what a person sees are unit tests; the
// renderer and the components only take what these say.

export type StudioMode = 'look' | 'pose' | 'animate'

export interface StudioViewState {
  readonly mode: StudioMode
  /** Ids of the chosen files, by kind. */
  readonly figure: string | undefined
  readonly pose: string | undefined
  readonly clip: string | undefined
  /** The outfit shown in Look; the figure's default when undefined. */
  readonly outfit: string | undefined
  readonly orbit: Orbit
  /** The figure's facing in Look, radians about +y. */
  readonly facing: number
  /** Seconds into the chosen clip (Animate). */
  readonly playhead: number
  readonly playing: boolean
  /** The chosen key of the chosen clip. */
  readonly key: number | undefined
  /** The chosen pose handle. */
  readonly handle: EffectorId | undefined
  /** The pose as it is being dragged, before it is a step of the history. */
  readonly live: PoseDef | undefined
}

export interface StudioView {
  readonly state: Readable<StudioViewState>
  readonly current: StudioViewState
  setMode(mode: StudioMode): void
  select(kind: 'figure' | 'pose' | 'clip', id: string | undefined): void
  setOutfit(outfit: string | undefined): void
  setOrbit(orbit: Orbit): void
  setFacing(facing: number): void
  setPlayhead(seconds: number): void
  setPlaying(playing: boolean): void
  selectKey(index: number | undefined): void
  selectHandle(handle: EffectorId | undefined): void
  setLive(pose: PoseDef | undefined): void
  /** The files the content has now: a chosen one that went away moves to the first that is left. */
  reconcile(content: StudioContent): void
}

const firstOf = (entries: readonly { readonly id: string }[]): string | undefined => entries[0]?.id
const keep = (id: string | undefined, entries: readonly { readonly id: string }[]): string | undefined =>
  id !== undefined && entries.some((entry) => entry.id === id) ? id : firstOf(entries)

const lengthOf = (content: StudioContent, id: string | undefined): number =>
  content.clips.find((entry) => entry.id === id)?.value?.length ?? 0

export function createStudioView(content: StudioContent): StudioView {
  let state: StudioViewState = {
    mode: 'look',
    figure: firstOf(content.figures),
    pose: firstOf(content.poses),
    clip: firstOf(content.clips),
    outfit: undefined,
    orbit: DEFAULT_ORBIT,
    facing: 0,
    playhead: 0,
    playing: false,
    key: undefined,
    handle: undefined,
    live: undefined,
  }
  let latest = content
  const store = writable(state)
  const set = (patch: Partial<StudioViewState>): void => {
    state = { ...state, ...patch }
    store.set(state)
  }
  return {
    state: { subscribe: store.subscribe },
    get current() {
      return state
    },
    setMode: (mode) => set({ mode, playing: false, live: undefined }),
    select(kind, id) {
      if (kind === 'figure') set({ figure: id, outfit: undefined })
      else if (kind === 'pose') set({ pose: id, handle: undefined, live: undefined })
      else set({ clip: id, key: undefined, playhead: 0, playing: false })
    },
    setOutfit: (outfit) => set({ outfit }),
    setOrbit: (orbit) => set({ orbit }),
    setFacing: (facing) => set({ facing }),
    setPlayhead: (seconds) => set({ playhead: Math.min(lengthOf(latest, state.clip), Math.max(0, seconds)) }),
    setPlaying: (playing) => set({ playing }),
    selectKey: (key) => set({ key }),
    selectHandle: (handle) => set({ handle }),
    setLive: (live) => set({ live }),
    reconcile(next) {
      latest = next
      set({
        figure: keep(state.figure, next.figures),
        pose: keep(state.pose, next.poses),
        clip: keep(state.clip, next.clips),
        playhead: Math.min(state.playhead, lengthOf(next, keep(state.clip, next.clips))),
      })
    },
  }
}

// --- what the stage draws -----------------------------------------------------------------------------------------

/** The pose shown as a clip that holds it: the figure view plays clips, and a pose is a clip's key. */
const HOLD: FigureClipDef = {
  length: 0.4,
  loop: 'hold',
  mask: MASK_GROUPS,
  keys: [
    { t: 0, pose: '__pose' },
    { t: 0.4, pose: '__pose' },
  ],
}

export interface Stage {
  readonly def: FigureDef | undefined
  readonly library: FigureLibrary
  readonly motion: MotionLibrary
  readonly state: FigureViewState
  /** Seconds, the view's clock. */
  readonly time: number
  /** Radians about +y. */
  readonly facing: number
}

/** The pose the stage holds in Pose mode: the one being dragged, else the chosen file's. */
function shownPose(content: StudioContent, view: StudioViewState): PoseDef | undefined {
  return view.live ?? content.poses.find((entry) => entry.id === view.pose)?.value
}

export function stageOf(content: StudioContent, view: StudioViewState): Stage {
  const def = content.figures.find((entry) => entry.id === view.figure)?.value
  const outfit = view.outfit === undefined ? {} : { outfit: view.outfit }
  if (view.mode === 'pose') {
    const pose = shownPose(content, view)
    const motion: MotionLibrary =
      pose === undefined
        ? content.motion
        : {
            ...content.motion,
            poses: { ...content.motion.poses, __pose: pose },
            clips: { ...content.motion.clips, __pose: HOLD },
          }
    return {
      def,
      library: content.library,
      motion,
      state: {
        moving: false,
        ...outfit,
        ...(pose === undefined ? {} : { action: { id: '__pose', startedAt: 0 } }),
      },
      time: 1,
      facing: 0,
    }
  }
  if (view.mode === 'animate' && view.clip !== undefined)
    return {
      def,
      library: content.library,
      motion: content.motion,
      state: { moving: false, ...outfit, action: { id: view.clip, startedAt: 0 } },
      time: view.playhead,
      facing: 0,
    }
  return {
    def,
    library: content.library,
    motion: content.motion,
    state: { moving: false, ...outfit },
    time: 0,
    facing: view.facing,
  }
}

// --- the pose handles -----------------------------------------------------------------------------------------------

export interface Handle {
  readonly id: EffectorId
  /** Where it stands in the figure's space, metres. */
  readonly position: Vec3
  /** Whether the pose sets it (a handle it does not set shows where the body is). */
  readonly set: boolean
  /** Whether the solve reached its target; false is drawn amber. */
  readonly reached: boolean
  /** How far short: metres for a position, degrees for a turn; 0 when reached. */
  readonly error: number
}

const HANDLE_JOINTS: ReadonlyArray<readonly [EffectorId, keyof typeof J]> = [
  ['handL', 'hand.L'],
  ['handR', 'hand.R'],
  ['footL', 'foot.L'],
  ['footR', 'foot.R'],
  ['pelvis', 'pelvis'],
  ['chest', 'chest'],
  ['head', 'head'],
]

export function handlesOf(content: StudioContent, view: StudioViewState): Handle[] {
  if (view.mode !== 'pose') return []
  const stage = stageOf(content, view)
  if (stage.def === undefined) return []
  const pose = shownPose(content, view)
  const rig = skeleton(stage.def)
  const evaluated = evaluate(
    rig,
    stage.def,
    { moving: false, facing: 0, speed: 0, action: stage.state.action, outfit: stage.state.outfit } as never,
    stage.time,
    stage.motion,
  )
  return HANDLE_JOINTS.map(([id, joint]) => {
    const world = evaluated.world[J[joint]]
    const reach = evaluated.report.reached[id]
    return {
      id,
      position: [world?.[9] ?? 0, world?.[10] ?? 0, world?.[11] ?? 0] as const,
      set: pose?.effectors[id] !== undefined,
      reached: reach?.ok ?? true,
      error: reach === undefined || reach.ok ? 0 : reach.error,
    }
  })
}
