import type { PieceStates } from '@automata/3d/level'
import { createDirector, type Director } from '../../shared/director/director.ts'
import type { PlacedScript } from '../../shared/sim/anchors.ts'
import type { SoundKey, V3 } from '../../shared/sim/cutscene.schema.ts'

// A cutscene drawn in 3D: the director's scene, handed to the parts of a game that show it. The camera is the game's play
// camera (it is handed over for the cutscene and given back), the doors, props and lamps are the world's pieces, each
// actor is the game's view of a character, the fade and the sounds are the game's own. The stage holds no time of its own
// and decides nothing: the caller passes the sim's cutscene clock (`(tick - start) / tickHz`), so a replay draws the same
// frames (law 2). It is presentation only.

export interface CutsceneStage3dOptions {
  /** The game's play camera hands over for the cutscene: `set` each frame, `release` when it ends. */
  readonly camera: {
    set(pose: { pos: V3; look: V3; lens: number }): void
    release(): void
  }
  /** Doors, props and lamp levels: the world's `updatePieces`, and the light's `setLevels`. The scene state is a `PieceStates`. */
  readonly pieces: (states: PieceStates) => void
  /** The game's view of a character (`'player'`, an agent's id), or undefined for one it does not draw. */
  readonly actor: (who: string) => ActorView | undefined
  /** 0 clear, 1 black. */
  readonly fade: (value: number) => void
  /** A sound the script asks for, once as the scene passes its time. */
  readonly sound?: ((kind: string) => void) | undefined
  /**
   * The pieces' states when no cutscene plays (the game's own view of its doors, props and lamps), put back when the
   * cutscene ends. Without it the pieces stay as the last frame left them.
   */
  readonly restore?: (() => PieceStates) | undefined
}

/** One character as the stage drives it. */
export interface ActorView {
  place(at: { x: number; z: number; y?: number }, facing: number): void
  /** The pose being played (a name in the figure's clips) and whether the character is walking. */
  pose(name: string | undefined, moving: boolean): void
  alpha(value: number): void
  /** Starts a clip on the figure, `at` seconds into the scene (a script's `cues`). */
  clip(name: string, at: number): void
}

export interface CutsceneStage3d {
  start(script: PlacedScript): void
  /** Draws the scene `seconds` into the cutscene. Nothing happens while it is not playing. */
  draw(seconds: number): void
  end(): void
  readonly playing: boolean
}

/** The focal length in mm for a vertical field of view in degrees on the 24 mm frame the director's `fovOf` uses. */
const lensOf = (fov: number): number => 12 / Math.tan((fov * Math.PI) / 360)

export function cutsceneStage3d(options: CutsceneStage3dOptions): CutsceneStage3d {
  let script: PlacedScript | undefined
  let director: Director | undefined
  let sounds: readonly SoundKey[] = []
  /** How many of `sounds` have played; winding the scene back lets the later ones play again. */
  let played = 0
  let last = Number.NEGATIVE_INFINITY

  function playSounds(seconds: number): void {
    if (seconds < last)
      played =
        sounds.findIndex((s) => s.t > seconds) === -1 ? sounds.length : sounds.findIndex((s) => s.t > seconds)
    last = seconds
    for (; played < sounds.length && (sounds[played] as SoundKey).t <= seconds; played += 1)
      options.sound?.((sounds[played] as SoundKey).kind)
  }

  return {
    get playing() {
      return script !== undefined
    },
    start(placed) {
      script = placed
      sounds = [...(placed.sound ?? [])].sort((a, b) => a.t - b.t)
      played = 0
      last = Number.NEGATIVE_INFINITY
      director = createDirector(placed, (who, clip, at) => options.actor(who)?.clip(clip, at))
    },
    draw(seconds) {
      if (director === undefined) return
      const state = director.stateAt(seconds)
      options.camera.set({ pos: state.camera.pos, look: state.camera.look, lens: lensOf(state.camera.fov) })
      options.pieces(state)
      for (const [who, frame] of Object.entries(state.actors)) {
        const view = options.actor(who)
        if (view === undefined) continue
        view.place(
          frame.y === undefined ? { x: frame.x, z: frame.z } : { x: frame.x, z: frame.z, y: frame.y },
          frame.facing,
        )
        view.pose(frame.pose, frame.moving)
        view.alpha(frame.alpha)
      }
      options.fade(state.fade)
      playSounds(seconds)
    },
    end() {
      if (script === undefined) return
      script = undefined
      director = undefined
      options.camera.release()
      options.fade(0)
      const restored = options.restore?.()
      if (restored !== undefined) options.pieces(restored)
    },
  }
}
