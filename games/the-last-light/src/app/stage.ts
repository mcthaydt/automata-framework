import { content } from 'virtual:automata/content'
import type { DrawingCamera } from '@automata/3d'
import {
  drawLightPatches,
  drawWorld,
  type ModelLibrary,
  type Occluders,
  roomHooks,
  sceneLamps,
  updatePieces,
} from '@automata/3d'
import { fovOf } from '@automata/3d/camera-view'
import { noPieceStates, type PieceStates } from '@automata/3d/level'
import { CutsceneState, placeScript } from '@automata/cutscenes/sim'
import { cutsceneStage3d } from '@automata/cutscenes/stage-3d'
import { feelSchema } from '@automata/feel'
import { feelStage } from '@automata/feel/stage'
import type { PixiStage, PixiStageHooks } from '@automata/framework'
import { PuzzleState } from '@automata/puzzle/sim'
import type { SimContext } from '@automata/sim'
import { peekOf } from '@automata/systems/sim'
import type { Camera3D, Container3D, View3D } from '@pixi/3d'
import { Graphics } from 'pixi.js'
import type { Actors } from '../features/figures/figure-view.ts'
import { lightsOutSchema, lightsOutStates } from '../features/lamp/lights-out.content.ts'
import { centreOf, LEVEL, PAINT, WORLD } from '../features/room/room.ts'
import { TICK_HZ } from '../shared/constants.ts'
import type { PlayContent } from '../shared/play-content.ts'
import { anchorsOf } from './anchors.ts'
import { sounds } from './audio.ts'
import { createEnding } from './ending.ts'
import { live } from './live.ts'
import { lookProfilesSchema } from './look-profiles.content.ts'
import { adaAt } from './presentation.ts'
import { installProbe } from './probe.ts'
import { noteEvents, resetScreen } from './screen-state.ts'

// The picture of the night: the ward drawn from the level, the camera that follows Ada through its rooms, the cutscenes on the
// same camera and figures, and the screen's own notes of what the sim said. Presentation only: it reads the sim through
// the draw layer's view and writes meshes, the camera and the fade, never the sim (law 2).

const feelTable = feelSchema.parse((content as unknown as { feel?: { feel?: unknown } }).feel?.feel ?? {})

/** The levels the lamps burn at once the lights have gone (`content/lights-out.toml`). */
const lightsOutFile = lightsOutSchema.parse(content['lights-out'])

/** What a lamp of the level is at: dimmed as the old game dims them once the lights go, otherwise as the level lit it. */
function pieceStatesOf(lightsOut: boolean): PieceStates {
  return lightsOut ? lightsOutStates(lightsOutFile, WORLD.lamps) : noPieceStates()
}

/** Whether the lights have gone, by the puzzle's own fact. */
const lightsOut = (): boolean => live.sim?.resource(PuzzleState).facts.lightsOut === true

/** The spot a peek leans toward while one holds: the middle of the room past the doorway. */
function peekSpot(): { x: number; z: number } | undefined {
  const sim = live.sim
  if (sim === undefined) return undefined
  const peek = peekOf(sim)
  return peek === undefined ? undefined : centreOf(peek.into)
}

/**
 * The shot a cutscene is drawing, or none: the renderer's occluder rule follows it in place of the play camera's pose, so a wall a
 * shot looks at from inside the room is not cut away for a play camera standing outside it.
 */
let drawingShot: DrawingCamera | undefined
export const cutsceneShot = (): DrawingCamera | undefined => drawingShot

export interface StageOptions {
  readonly play: PlayContent
  readonly actors: Actors
  /** The picture's logical size, for the fade over it. */
  readonly size: { readonly width: number; readonly height: number }
}

/** The renderer's `scene` hook for the game: its world, its rooms and its cutscenes. */
export function sceneOf(options: StageOptions) {
  return (
    view: View3D,
    stage: PixiStage,
    occluders: Occluders,
    light: Parameters<typeof drawWorld>[0]['light'],
    models: ModelLibrary,
    camera: { active(): string | undefined; peek(offset?: { x: number; z: number }): void } | undefined,
  ): PixiStageHooks => {
    view.environment = { skyColor: 0x0d1016, groundColor: 0x1a1520 }
    const drawn = drawWorld({ parent: view.root as Container3D, occluders, light, ...PAINT }, WORLD.pieces, {
      props: WORLD.props,
      models,
    })

    // The moonlight on the floor under the barred windows: stripes the room's baked light cannot say, laid on the floor and added to it.
    const moonlight = drawLightPatches(
      view.root as Container3D,
      lookProfilesSchema.parse(content.look ?? {}).moonlight,
    )

    // The lights of the room: the level's lamps at the levels the pieces' state says.
    let shown = noPieceStates()
    const apply = (states: PieceStates): void => {
      updatePieces(drawn, shown, states)
      shown = states
      light?.setLevels(
        Object.fromEntries(sceneLamps(WORLD.lamps, true, states.lamps).map((lamp) => [lamp.id, lamp.level])),
      )
    }

    // A development build lets a journey read the sim and send what the controls send.
    const probe = installProbe(live, options.play)

    // The fade a cutscene asks for: black over the picture, in the letterbox's own field.
    const fade = new Graphics().rect(0, 0, options.size.width, options.size.height).fill(0x000000)
    fade.alpha = 0
    stage.ui.addChild(fade)

    // The cutscene playing, by id: the lights-out scene keys the lamps the old script names and leaves the rest, which then burn as the level
    // lit them (the exit lamp at 1.25, not the 0.95 the dark room has), so the dark room's levels sit under the scene's own keys.
    let playing: string | undefined
    const cutscene = cutsceneStage3d({
      camera: {
        set: ({ pos, look, lens }) => {
          const cam: Camera3D = view.camera
          cam.fov = fovOf(lens)
          cam.position.set(pos[0], pos[1], pos[2])
          cam.lookAt({ x: look[0], y: look[1], z: look[2] })
          drawingShot = {
            eye: { x: pos[0], y: pos[1], z: pos[2] },
            look: { x: look[0], y: look[1], z: look[2] },
          }
        },
        // The play camera writes itself again on the next frame, and the occluder rule follows it again.
        release: () => {
          drawingShot = undefined
        },
      },
      pieces: (states) =>
        apply(
          playing === 'lightsOut' ? { ...states, lamps: { ...pieceStatesOf(true).lamps, ...states.lamps } } : states,
        ),
      actor: (who) => options.actors.get(who),
      fade: (value) => {
        fade.alpha = value
      },
      sound: (kind) => void sounds.handle?.cue(kind),
      restore: () => pieceStatesOf(lightsOut()),
    })

    const rooms = roomHooks({
      level: LEVEL,
      world: {
        showRooms: (rooms) => {
          drawn.showRooms(rooms)
          moonlight.showRooms(rooms)
        },
      },
      view: () => camera?.active(),
      player: () => adaAt(live.sim),
      peek: peekSpot,
      cutscene: () => cutscene.playing,
    })

    // The night ends with the credits over the last frame; they have no links, so the host is never asked to open one.
    const ending = createEnding({
      target: () => stage.app.canvas.parentElement ?? document.body,
      hosting: { granted: new Set(), openLink: async () => ({ ok: false }) } as never,
    })

    // What the player feels: the shake goes to the camera's own gameplay shake (whole pixels), the flash and the tint over the picture.
    const feel = feelStage({
      content: () => feelTable,
      size: options.size,
      onCue: (cue) => void sounds.handle?.cue(cue),
      onHaptic: (pulse) => {
        if (pulse.phoneMs !== undefined) navigator.vibrate?.(pulse.phoneMs)
      },
    })(stage)

    // The room's lights follow the puzzle's fact between cutscenes (a cutscene sets them itself while it plays).
    let lamps: boolean | undefined
    return {
      apply: (result) => {
        noteEvents(result.events)
        probe.note(result.events)
        ending.note(result.events)
        feel.apply?.(result)
        for (const event of result.events) {
          if (event.type === 'cutscene.started') {
            const id = (event.payload as { id: string }).id
            playing = id
            const script = options.play.scripts.find((each) => each.id === id)
            const placed =
              script === undefined || live.sim === undefined
                ? undefined
                : placeScript(script, (name) =>
                    anchorsOf(options.play)(live.sim as unknown as SimContext, name),
                  )
            if (placed?.ok === true) cutscene.start(placed.script)
          } else if (event.type === 'cutscene.ended') {
            playing = undefined
            cutscene.end()
          }
        }
      },
      draw: (frame) => {
        rooms.draw?.(frame)
        feel.draw?.(frame)
        const sim = live.sim
        if (sim === undefined) return
        // A peek leans the camera toward the doorway; a cutscene's own camera is not leaned.
        const peek = peekOf(sim)
        camera?.peek(peek === undefined ? undefined : { x: peek.x, z: peek.z })
        const state = sim.resource(CutsceneState)
        if (state.id !== null && cutscene.playing) {
          cutscene.draw(Math.max(0, (sim.tick - state.start + frame.alpha - 1) / TICK_HZ))
          return
        }
        const out = lightsOut()
        if (out !== lamps) {
          lamps = out
          apply(pieceStatesOf(out))
        }
      },
      reset: () => {
        rooms.reset?.()
        feel.reset?.()
        ending.reset()
        resetScreen()
        lamps = undefined
        shown = noPieceStates()
      },
    }
  }
}
