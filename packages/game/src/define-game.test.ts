import { BootDefect, type ScreenDef } from '@mcthaydt/automata-runtime'
import { defineComponent, defineEvent, definePlugin } from '@mcthaydt/automata-sim'
import { Effect } from 'effect'
import { Container } from 'pixi.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { defaultContent } from './default-content.ts'
import { defineGame, type GameSpec, pixiOptions } from './define-game.ts'
import { createDrawLayer } from './draw/draw-layer.ts'
import { rect } from './index.ts'

const Body = defineComponent('body', { x: 'f32', y: 'f32' })
const Hidden = defineComponent('hidden', { n: 'i32' }, { render: false })
const Chime = defineEvent('chime', z.object({}))
const square = definePlugin({ name: 'square', defs: [Body, Hidden, Chime] })

const spec: GameSpec = { id: 'my-game', size: { width: 320, height: 180 }, sim: { plugins: [square] } }

/** The BootDefect's cause, which lists every invalid field path. */
function problemsOf(bad: GameSpec): string {
  try {
    defineGame(bad)
  } catch (error) {
    expect(error).toBeInstanceOf(BootDefect)
    return String((error as BootDefect).cause)
  }
  throw new Error('defineGame accepted an invalid spec')
}

describe('defineGame defaults (DX spec §3.1)', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('hosts under the game id, asks for nothing and pauses with the host', () => {
    expect(defineGame(spec).hosting).toEqual({ gameId: 'my-game', wants: [], pauseBehavior: 'pause' })
  })

  it('merges the spec’s hosting over the defaults, but never its game id', () => {
    const game = defineGame({ ...spec, hosting: { wants: ['saves'], pauseBehavior: 'continue' } })
    expect(game.hosting).toEqual({ gameId: 'my-game', wants: ['saves'], pauseBehavior: 'continue' })
  })

  it('uses the default content, or the game’s own', () => {
    expect(defineGame(spec).content).toEqual(defaultContent())
    const own = { data: defaultContent().data, hash: defaultContent().hash, sim: { rooms: 1 } }
    const game = defineGame({ ...spec, content: own })
    expect(game.content).toEqual({ data: own.data, hash: own.hash })
    expect(game.sim.content).toEqual({ rooms: 1 })
  })

  it('fills the seed (1) and the title (the id), and keeps the plugins and setup', () => {
    const setup = () => {}
    const game = defineGame({ ...spec, sim: { plugins: [square], setup } })
    expect(game.sim).toEqual({ plugins: [square], seed: 1, setup })
    expect(game.title).toBe('my-game')
    expect(game.id).toBe('my-game')
    expect(game.size).toEqual({ width: 320, height: 180 })
  })

  it('adds the title, play and paused screens unless the game brings its own', () => {
    expect(defineGame(spec).screens.map((screen) => screen.id)).toEqual(['title', 'play', 'paused'])
    const own: ScreenDef[] = [{ id: 'title', enter: () => Effect.void }]
    expect(defineGame({ ...spec, screens: own }).screens).toBe(own)
  })

  it('makes a renderer factory', () => {
    expect(typeof defineGame(spec).renderer).toBe('function')
  })

  it('finds its root in #game, unless given one', () => {
    const main = document.body.appendChild(document.createElement('main'))
    main.id = 'game'
    expect(defineGame(spec).root).toBe(main)
    const own = document.createElement('div')
    expect(defineGame({ ...spec, root: own }).root).toBe(own)
  })

  it('is a BootDefect with no root and no #game, when the root is read', () => {
    const game = defineGame(spec)
    expect(() => game.root).toThrow(BootDefect)
  })
})

describe('defineGame validation (DX spec §5 step 1, §6)', () => {
  it('checks the id with Ruken’s rule', () => {
    expect(problemsOf({ ...spec, id: 'My Game' })).toContain('id:')
  })

  it('needs a positive whole-number size', () => {
    const problems = problemsOf({ ...spec, size: { width: 0, height: 1.5 } })
    expect(problems).toContain('size.width:')
    expect(problems).toContain('size.height:')
  })

  it('refuses a view for a component no plugin draws, rather than drawing nothing', () => {
    const views = { ghost: rect({ w: 1, h: 1, color: 0 }), [Hidden.id]: rect({ w: 1, h: 1, color: 0 }) }
    const problems = problemsOf({ ...spec, views })
    expect(problems).toContain('views.ghost:')
    expect(problems).toContain('views.hidden:')
  })

  it('refuses a sound for an event no plugin defines (M5.3)', () => {
    expect(problemsOf({ ...spec, sounds: { ghost: 'ghost.wav' } })).toContain('sounds.ghost:')
  })

  it('hands the sounds to the runtime, which plays them on sim events (M5.3)', () => {
    const sounds = { [Chime.id]: 'chime.wav' }
    expect(defineGame({ ...spec, sounds }).sounds).toEqual(sounds)
  })

  it('accepts a view for a drawn component', () => {
    expect(() => defineGame({ ...spec, views: { [Body.id]: rect({ w: 1, h: 1, color: 0 }) } })).not.toThrow()
  })

  it('needs a 16-hex-digit content hash', () => {
    expect(problemsOf({ ...spec, content: { data: defaultContent().data, hash: 'nope' } })).toContain(
      'content.hash:',
    )
  })

  it('lists every problem at once', () => {
    const problems = problemsOf({ ...spec, id: '', size: { width: -1, height: 180 } })
    expect(problems).toContain('id:')
    expect(problems).toContain('size.width:')
  })
})

describe('defineGame with draw (PRODUCT spec §7)', () => {
  it('needs the default screens: custom screens do not feed the draw layer (plan D-4)', () => {
    const own: ScreenDef[] = [{ id: 'title', enter: () => Effect.void }]
    expect(problemsOf({ ...spec, draw: () => {}, screens: own })).toContain('draw: needs the default screens')
  })

  it('needs draw to be a function', () => {
    expect(problemsOf({ ...spec, draw: 'hud' as never })).toContain('draw:')
  })

  it('accepts draw with the default screens', () => {
    expect(() => defineGame({ ...spec, draw: () => {} })).not.toThrow()
  })
})

describe('pixiOptions (the renderer defineGame makes)', () => {
  const frame = { alpha: 1, frameMs: 16, paused: false }

  it('fills the logical size, pixel art and the views, under the game’s own options', () => {
    const views = { [Body.id]: rect({ w: 1, h: 1, color: 0 }) }
    expect(pixiOptions({ ...spec, views, renderer: { backgroundColor: 1 } }, undefined)).toEqual({
      logicalWidth: 320,
      logicalHeight: 180,
      pixelArt: true,
      entityViews: views,
      backgroundColor: 1,
    })
  })

  it('runs the game’s own setup and hooks first, then mounts the draw layer over them', () => {
    const calls: string[] = []
    const ui = new Container()
    const ownSetup = vi.fn((stage: { ui: Container }) => {
      stage.ui.addChild(new Container({ label: 'own' }))
      return { draw: () => void calls.push('own') }
    })
    const layer = createDrawLayer(() => {}, spec.size)
    const options = pixiOptions({ ...spec, renderer: { setup: ownSetup } }, layer)
    const hooks = options.setup?.({ ui } as never)
    expect(ownSetup).toHaveBeenCalledOnce()
    expect(ui.children.map((child) => child.label)).toEqual(['own', 'draw'])
    hooks?.draw?.(frame)
    expect(calls).toEqual(['own'])
  })

  it('keeps the game’s own setup alone when there is no draw', () => {
    const setup = () => undefined
    expect(pixiOptions({ ...spec, renderer: { setup } }, undefined).setup).toBe(setup)
  })
})
