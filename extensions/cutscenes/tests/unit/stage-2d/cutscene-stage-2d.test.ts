import type { ContentLevel, ContentProject } from '@automata/content/level-2d'
import type { Camera2d, DrawSim, LevelScene, LevelSceneHooks, PictureViewOptions } from '@automata/framework'
import { Container, type Graphics } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import { cutsceneStage2d } from '#src/features/stage-2d/cutscene-stage-2d.ts'
import type { PlacedScript } from '#src/shared/sim/anchors.ts'
import type { CutsceneStateValue } from '#src/shared/sim/cutscene.resource.ts'

// The cutscene on a 2D stage: it reads the cutscene under way from the sim, plays the script with the director, and
// moves the camera and the placed characters the script names. The sim is not touched, so a replay is the same.

const METRE = 16
const HZ = 60

/** A level with one placed character, a keeper named "keeper". */
const LEVEL = {
  id: 'yard',
  layers: [
    {
      kind: 'entities',
      def: 'people',
      items: [{ id: 'item-1', def: 'keeper-def', x: 32, y: 48, fields: { name: 'keeper' } }],
    },
  ],
} as unknown as ContentLevel

/** The keeper's character: it idles until a cue names another clip. */
const PROJECT = {
  entities: [{ id: 'keeper-def', animation: { clips: [{ id: 'idle' }, { id: 'wave' }] } }],
} as unknown as ContentProject

const SCRIPT: PlacedScript = {
  id: 'gate',
  duration: 4,
  camera: [{ t: 0, pos: [0, 5, 0], look: [3, 0, 2] }],
  actor: [
    { who: 'keeper', t: 0, x: 2, z: 3 },
    { who: 'keeper', t: 2, x: 4, z: 3 },
  ],
  cues: [{ at: 1, who: 'keeper', clip: 'wave' }],
}

function setup(script: PlacedScript = SCRIPT) {
  const container = new Container()
  const overlay = new Container()
  const hide = vi.fn()
  let hook: LevelSceneHooks | undefined
  const scene: LevelScene = { add: (hooks) => (hook = hooks) }
  const target = vi.fn()
  const camera: Camera2d = { target, shake: vi.fn(), update: vi.fn(), transform: { x: 0, y: 0, scale: 1 } }
  const clips: string[] = []
  const views: { def: string; container: Container }[] = []
  cutsceneStage2d({
    scene,
    project: PROJECT,
    level: LEVEL,
    images: {},
    camera,
    metre: METRE,
    scripts: { gate: script },
    view: { width: 320, height: 180 },
    tickHz: HZ,
    // The picture of a character is core's `pictureView`; here a plain container records which clip it was asked for.
    viewOf: (def: string, options: PictureViewOptions) => () => {
      const view = new Container()
      views.push({ def, container: view })
      return {
        container: view,
        update(curr: Readonly<Record<string, Readonly<Record<string, number | boolean | string>>>>) {
          view.position.set(curr.actor?.x as number, curr.actor?.y as number)
          const clip = options.clip?.(curr)
          if (clip !== undefined) clips.push(clip)
        },
      }
    },
  })
  const draw = (state: CutsceneStateValue, tick: number): void => {
    const sim = { tick, resource: () => state } as unknown as DrawSim
    hook?.draw(sim, { container, overlay, hide })
  }
  return { container, overlay, hide, target, draw, clips, views }
}
const going = (start: number): CutsceneStateValue => ({ id: 'gate', start, end: start + 4 * HZ })
const idle: CutsceneStateValue = { id: null, start: 0, end: 0 }
const fadeOf = (container: Container): Graphics | undefined =>
  container.children.find((child) => child.label === 'cutscene-fade') as Graphics | undefined

describe('the 2D cutscene stage', () => {
  it('draws nothing and moves nothing while there is no cutscene', () => {
    const { container, target, draw, hide } = setup()
    draw(idle, 10)
    expect(container.children).toHaveLength(0)
    expect(target).not.toHaveBeenCalled()
    expect(hide).not.toHaveBeenCalled()
  })

  it('centres the camera on the script’s look point, in pixels', () => {
    const { target, draw } = setup()
    draw(going(0), 0)
    expect(target).toHaveBeenLastCalledWith(3 * METRE, 2 * METRE)
  })

  it('draws the character whose name the actor has, where the script puts it, and hides the placed one', () => {
    const { container, hide, draw, views } = setup()
    draw(going(0), HZ) // one second in: halfway between the keys at (2, 3) and (4, 3)
    expect(views.map((view) => view.def)).toEqual(['keeper-def'])
    expect(container.children).toContain(views[0]?.container)
    expect(hide).toHaveBeenCalledWith('item-1', true)
    expect(views[0]?.container.position.x).toBeCloseTo(3 * METRE)
    expect(views[0]?.container.position.y).toBeCloseTo(3 * METRE)
  })

  it('starts the clip a cue names, once the scene passes it', () => {
    const { draw, clips } = setup()
    draw(going(0), 0)
    expect(clips.at(-1)).toBe('idle')
    draw(going(0), HZ + 1)
    expect(clips.at(-1)).toBe('wave')
  })

  it('shows the placed character again when the cutscene is over, and takes its own drawing away', () => {
    const { container, hide, draw } = setup()
    draw(going(0), 10)
    expect(container.children.length).toBeGreaterThan(0)
    draw(idle, 20)
    expect(hide).toHaveBeenLastCalledWith('item-1', false)
    expect(container.children).toHaveLength(0)
  })

  it('draws the fade as a black rectangle at the fade’s alpha, on the overlay over the whole view', () => {
    const { container, overlay, draw } = setup({
      ...SCRIPT,
      fade: [
        { t: 0, value: 0 },
        { t: 2, value: 1 },
      ],
    } as PlacedScript)
    draw(going(0), HZ)
    const fade = fadeOf(overlay)
    expect(fade?.alpha).toBeCloseTo(0.5)
    expect(fade?.getLocalBounds().width).toBe(320)
    expect(fade?.getLocalBounds().height).toBe(180)
    expect(fadeOf(container)).toBeUndefined()
  })

  it('plays a new cutscene from its own start, not the old one’s', () => {
    const { draw, clips } = setup()
    draw(going(0), HZ + 5)
    expect(clips.at(-1)).toBe('wave')
    draw(going(500), 500)
    expect(clips.at(-1)).toBe('idle')
  })
})
