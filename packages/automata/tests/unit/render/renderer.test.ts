import type { StepResult } from '@mcthaydt/automata-sim'
import { Application, type ApplicationOptions, Container, type Filter } from 'pixi.js'
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import { postFilter } from '#src/features/render/filter/post-filter.ts'
import { createPixiRenderer, type PixiRenderer } from '#src/features/render/renderer.ts'
import type { RendererUnavailable } from '#src/shared/runtime/boot-error.ts'
import type { FrameInfo } from '#src/shared/runtime/loop/frames.ts'
import type { Geometry } from '#src/shared/ui/geometry/geometry.ts'

/** Every renderer a test built, disposed when its `scoped` block ends (what closing the Effect scope did). */
let opened: PixiRenderer[] = []

/** The renderer a factory built; a refusal fails the test. */
async function built(
  made: Promise<Awaited<ReturnType<ReturnType<typeof createPixiRenderer>>>>,
): Promise<PixiRenderer> {
  const result = await made
  if (!result.ok) throw result.reason
  opened.push(result.value)
  return result.value
}

/** Runs `body`, then disposes the renderers it built, last first, as a closed scope would. */
async function scoped<A>(body: () => Promise<A>): Promise<A> {
  try {
    return await body()
  } finally {
    for (const renderer of opened.splice(0).reverse()) renderer.dispose()
  }
}

describe('createPixiRenderer', () => {
  let mockInitBehavior: (this: Application, opts?: Partial<ApplicationOptions>) => Promise<void> | void
  let initSpy: Mock

  function createFakeTarget(initialUsable = { width: 800, height: 600 }) {
    const host = document.createElement('div')
    document.body.appendChild(host)
    let changeListener: ((g: Geometry) => void) | undefined
    const geometryData: Geometry = {
      usable: { x: 0, y: 0, ...initialUsable },
      formFactor: 'desktop',
      layout: { ...initialUsable },
      heightTier: undefined,
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
      hostReserved: { left: 0, right: 0 },
      visualInsetBottom: 0,
      hiddenBarBottom: 0,
      keyboardResize: 0,
      visible: { x: 0, y: 0, ...initialUsable },
      scale: 1,
    }

    return {
      host,
      geometry: {
        geometry: { current: geometryData },
        onChange(listener: (g: Geometry) => void) {
          changeListener = listener
          return () => {
            changeListener = undefined
          }
        },
        setHostDisplay: () => {},
        remeasure: () => {},
        dispose: () => {},
      },
      assets: { get: () => undefined },
      triggerResize(usable: { width: number; height: number }) {
        changeListener?.({
          ...geometryData,
          usable: { x: 0, y: 0, ...usable },
          layout: { ...usable },
        })
      },
    }
  }

  beforeEach(() => {
    mockInitBehavior = function (this: Application, opts?: Partial<ApplicationOptions>) {
      const canvas = document.createElement('canvas')
      const target = this as unknown as { renderer: unknown; render: unknown }
      target.renderer = {
        name: opts?.preference === 'webgpu' ? 'webgpu' : 'webgl',
        canvas,
        resize: vi.fn((w: number, h: number) => {
          canvas.width = w
          canvas.height = h
        }),
        render: vi.fn(),
        destroy: vi.fn(),
        resolution: opts?.resolution ?? 1,
      }
      target.render = vi.fn()
      this.stage = new Container()
    }

    initSpy = vi.spyOn(Application.prototype, 'init').mockImplementation(function (
      this: Application,
      opts?: Partial<ApplicationOptions>,
    ) {
      return Promise.resolve(mockInitBehavior.call(this, opts))
    })
  })

  afterEach(() => {
    initSpy.mockRestore()
    document.body.innerHTML = ''
  })

  it('initializes with WebGL2 default, stamps renderer dataset and appends canvas', async () => {
    const target = createFakeTarget()
    const factory = createPixiRenderer({ logicalWidth: 960, logicalHeight: 540 })

    const program = scoped(async () => {
      const renderer = await built(factory(target))
      expect(renderer).toBeDefined()
      expect(initSpy).toHaveBeenCalledTimes(1)
      expect(initSpy.mock.calls[0]?.[0]?.preference).toBe('webgl')

      const canvas = target.host.querySelector('canvas')
      expect(canvas).not.toBeNull()
      expect(canvas?.dataset.renderer).toBe('webgl')
      expect(canvas?.classList.contains('af-stage')).toBe(true)

      expect(renderer.stage.frame).toBeDefined()
      expect(renderer.stage.world).toBeDefined()
      expect(renderer.stage.ui).toBeDefined()
      expect(renderer.stage.backdrop).toBeDefined()
    })

    await program
  })

  it('respects preference: webgpu', async () => {
    const target = createFakeTarget()
    const factory = createPixiRenderer({ preference: 'webgpu' })

    const program = scoped(async () => {
      const renderer = await built(factory(target))
      expect(initSpy).toHaveBeenCalledTimes(1)
      expect(initSpy.mock.calls[0]?.[0]?.preference).toBe('webgpu')
      expect(renderer.stage.app.canvas.dataset.renderer).toBe('webgpu')
    })

    await program
  })

  it('falls back to webgl when webgpu fails and cleans up partial app', async () => {
    const target = createFakeTarget()
    let attempts = 0
    mockInitBehavior = function (this: Application, opts?: Partial<ApplicationOptions>) {
      attempts++
      if (opts?.preference === 'webgpu') {
        throw new Error('WebGPU adapter not found')
      }
      const canvas = document.createElement('canvas')
      const appTarget = this as unknown as { renderer: unknown; render: unknown }
      appTarget.renderer = {
        name: 'webgl',
        canvas,
        resize: vi.fn(),
        render: vi.fn(),
        destroy: vi.fn(),
        resolution: 1,
      }
      appTarget.render = vi.fn()
      this.stage = new Container()
    }

    const destroySpy = vi.spyOn(Application.prototype, 'destroy')
    const factory = createPixiRenderer({ preference: 'webgpu' })

    const program = scoped(async () => {
      const renderer = await built(factory(target))
      expect(attempts).toBe(2)
      expect(destroySpy).toHaveBeenCalledWith(true, { children: true })
      expect(initSpy.mock.calls[0]?.[0]?.preference).toBe('webgpu')
      expect(initSpy.mock.calls[1]?.[0]?.preference).toBe('webgl')
      expect(renderer.stage.app.canvas.dataset.renderer).toBe('webgl')
    })

    await program
    destroySpy.mockRestore()
  })

  it('answers RendererUnavailable when all backends fail', async () => {
    const target = createFakeTarget()
    mockInitBehavior = () => {
      throw new Error('WebGL creation failed')
    }

    const factory = createPixiRenderer({ preference: 'webgpu' })

    const result = await factory(target)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      const err: RendererUnavailable = result.reason
      expect(err._tag).toBe('RendererUnavailable')
      expect(err.tried).toEqual(['webgpu', 'webgl2'])
    }
  })

  it('resizes renderer and updates letterbox layout when geometry changes', async () => {
    const target = createFakeTarget({ width: 800, height: 600 })
    const factory = createPixiRenderer({ logicalWidth: 960, logicalHeight: 540 })

    const program = scoped(async () => {
      const renderer = await built(factory(target))
      const frame = renderer.stage.frame
      expect(frame).toBeDefined()
      if (!frame) return
      const layoutSpy = vi.spyOn(frame, 'layout')

      target.triggerResize({ width: 1024, height: 768 })

      expect(renderer.stage.app.renderer.resize).toHaveBeenCalledWith(1024, 768)
      expect(layoutSpy).toHaveBeenCalledWith(1024, 768)
    })

    await program
  })

  it('dispose cleans up app, views, frame, and removes canvas from DOM', async () => {
    const target = createFakeTarget()
    const factory = createPixiRenderer({ logicalWidth: 960, logicalHeight: 540 })

    const renderer = await built(factory(target))
    opened = []

    const destroySpy = vi.spyOn(renderer.stage.app, 'destroy')
    const frame = renderer.stage.frame
    expect(frame).toBeDefined()
    if (!frame) return
    const frameDestroySpy = vi.spyOn(frame, 'destroy')

    expect(target.host.children.length).toBe(1)

    renderer.dispose()

    expect(destroySpy).toHaveBeenCalled()
    expect(frameDestroySpy).toHaveBeenCalled()
    expect(target.host.children.length).toBe(0)
  })

  it('closes cleanly after a real destroy, which leaves the app without a renderer (and so without a canvas)', async () => {
    const target = createFakeTarget()
    const renderer = await built(createPixiRenderer()(target))
    opened = []
    const app = renderer.stage.app as unknown as { renderer: unknown; destroy: () => void }
    // Pixi's Application.destroy drops its renderer; its `canvas` getter then throws.
    vi.spyOn(renderer.stage.app, 'destroy').mockImplementation(() => {
      app.renderer = null
    })

    expect(() => renderer.dispose()).not.toThrow()
    expect(target.host.children.length).toBe(0)
  })

  it('forwards delta in apply and executes synchronous draw without allocating', async () => {
    const target = createFakeTarget()
    const factory = createPixiRenderer()

    const program = scoped(async () => {
      const renderer = await built(factory(target))
      const consumerSpy = vi.spyOn(renderer.stage.consumer, 'apply')
      const interpolateSpy = vi.spyOn(renderer.stage.consumer, 'interpolate')
      const renderSpy = vi.spyOn(renderer.stage.app, 'render')

      const stepResult: StepResult = {
        tick: 0,
        render: {
          resync: false,
          added: [],
          changed: [],
          removed: [],
        },
        events: [],
        rejected: [],
      }

      renderer.apply(stepResult)
      expect(consumerSpy).toHaveBeenCalledWith(stepResult.render)

      const frameInfo: FrameInfo = {
        alpha: 0.75,
        frameMs: 16,
        paused: false,
      }
      renderer.draw(frameInfo)
      expect(interpolateSpy).toHaveBeenCalledWith(0.75)
      expect(renderSpy).toHaveBeenCalled()
    })

    await program
  })
  it('runs the hooks a setup returns: apply after the consumer, draw before app.render, reset after the consumer', async () => {
    const target = createFakeTarget()
    const calls: string[] = []
    const factory = createPixiRenderer({
      setup: () => ({
        apply: (result) => calls.push(`hook.apply:${result.tick}`),
        draw: (frame) => calls.push(`hook.draw:${frame.alpha}`),
        reset: () => calls.push('hook.reset'),
      }),
    })

    const program = scoped(async () => {
      const renderer = await built(factory(target))
      const { consumer, app } = renderer.stage
      const applyConsumer = consumer.apply.bind(consumer)
      vi.spyOn(consumer, 'apply').mockImplementation((delta) => {
        calls.push('consumer.apply')
        applyConsumer(delta)
      })
      vi.spyOn(consumer, 'reset').mockImplementation(() => void calls.push('consumer.reset'))
      vi.spyOn(app, 'render').mockImplementation(() => void calls.push('app.render'))

      renderer.apply({
        tick: 7,
        render: { resync: false, added: [], changed: [], removed: [] },
        events: [],
        rejected: [],
      })
      renderer.draw({ alpha: 0.5, frameMs: 16, paused: false })
      renderer.reset()
      // Read before `scoped` ends: disposing destroys the consumer, which resets it once more.
      return [...calls]
    })

    expect(await program).toEqual([
      'consumer.apply',
      'hook.apply:7',
      'hook.draw:0.5',
      'app.render',
      'consumer.reset',
      'hook.reset',
    ])
  })
  it("gives setup code the stage's layers and a post-filter slot that writes the scene's filters", async () => {
    const target = createFakeTarget()
    const hud = new Container()
    const flash = { name: 'flash' } as unknown as Filter
    const crt = { name: 'crt' } as unknown as Filter
    const factory = createPixiRenderer({
      logicalWidth: 960,
      logicalHeight: 540,
      composite: false,
      setup(stage) {
        stage.ui.addChild(hud)
        stage.postFilters.set('retro', [crt], 10)
        stage.postFilters.set('game', [flash])
      },
    })

    const program = scoped(async () => {
      const renderer = await built(factory(target))
      expect(hud.parent).toBe(renderer.stage.ui)
      expect(renderer.stage.frame?.scene.filters).toEqual([flash, crt])
      expect(renderer.stage.filters).toEqual([flash, crt])
      renderer.stage.postFilters.remove('retro')
      renderer.stage.postFilters.remove('game')
      expect(renderer.stage.filters).toBeNull()
    })

    await program
  })

  it('drops a filter that cannot be built: tryFilter returns undefined, warns once, publishes the fact, and the frame draws (Q-b)', async () => {
    const target = createFakeTarget()
    const published: unknown[] = []
    const bus = {
      publish: (name: string, fact: unknown) => void published.push([name, fact]),
      subscribe: () => () => {},
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const program = scoped(async () => {
      const renderer = await built(
        createPixiRenderer({ logicalWidth: 320, logicalHeight: 180 })({
          ...target,
          bus,
        }),
      )
      const filter = renderer.stage.tryFilter('bad', () => {
        throw new Error('no such uniform')
      })
      expect(filter).toBeUndefined()
      renderer.draw({ alpha: 1, frameMs: 16, paused: false })
      expect(renderer.stage.app.render).toHaveBeenCalled()
    })
    await program
    expect(warn).toHaveBeenCalledTimes(1)
    expect(published).toEqual([['render.filter.dropped', { id: 'bad', reason: 'no such uniform' }]])
    warn.mockRestore()
  })

  describe('declared post filters (postFilter)', () => {
    const glsl = `precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
void main() { finalColor = texture(uTexture, vTextureCoord); }`
    const wgsl = `
@fragment fn mainFragment(input: VSOutput) -> @location(0) vec4<f32> {
  return textureSample(uTexture, uSampler, input.uv);
}`
    const fragments = (filters: Filter[] | null) => (filters ?? []).map((f) => f.glProgram?.fragment)

    it("builds each declared filter and sets it in the slot under its name, before the game's own setup", async () => {
      const target = createFakeTarget()
      const flash = { name: 'flash' } as unknown as Filter
      const factory = createPixiRenderer({
        logicalWidth: 320,
        logicalHeight: 180,
        composite: false,
        postFilters: [postFilter('tint', { glsl, wgsl, order: 10 })],
        setup(stage) {
          // Registered first, so the game's own setup already sees the declared filter in the slot.
          expect(stage.postFilters.ids).toEqual(['tint'])
          stage.postFilters.set('game', [flash])
        },
      })
      const program = scoped(async () => {
        const { stage } = await built(factory(target))
        expect(stage.postFilters.ids).toEqual(['game', 'tint'])
        expect(stage.filters?.[0]).toBe(flash)
        expect(fragments(stage.filters)[1]).toContain('texture(uTexture, vTextureCoord)')
      })
      await program
    })

    it('leaves out a minTier medium filter at low until setQuality raises the tier', async () => {
      const target = createFakeTarget()
      const factory = createPixiRenderer({
        logicalWidth: 320,
        logicalHeight: 180,
        quality: 'low',
        postFilters: [postFilter('bloom', { glsl, wgsl, minTier: 'medium' })],
      })
      const program = scoped(async () => {
        const { stage } = await built(factory(target))
        expect(stage.postFilters.ids).toEqual([])
        expect(stage.filters).toBeNull()
        stage.setQuality('high')
        expect(stage.postFilters.ids).toEqual(['bloom'])
      })
      await program
    })

    it('drops a filter whose GLSL does not link, publishes it, and still applies the others (M4 spec §6)', async () => {
      const published: unknown[] = []
      const bus = {
        publish: (name: string, fact: unknown) => void published.push([name, fact]),
        subscribe: () => () => {},
      }
      // The renderer's WebGL2 context says every program fails to link; only `tint` is declared to compile here.
      const build = mockInitBehavior
      mockInitBehavior = function (this: Application, opts?: Partial<ApplicationOptions>) {
        build.call(this, opts)
        let linking = 0
        ;(this.renderer as unknown as { gl: unknown }).gl = {
          VERTEX_SHADER: 1,
          FRAGMENT_SHADER: 2,
          LINK_STATUS: 3,
          createShader: () => ({}),
          shaderSource: () => {},
          compileShader: () => {},
          createProgram: () => ({}),
          attachShader: () => {},
          linkProgram: () => void linking++,
          // The first program (`broken`) fails, the second (`tint`) links.
          getProgramParameter: () => linking > 1,
          getProgramInfoLog: () => 'ERROR: 0:3: syntax error',
          getShaderInfoLog: () => '',
          deleteShader: () => {},
          deleteProgram: () => {},
        }
      }
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const factory = createPixiRenderer({
        logicalWidth: 320,
        logicalHeight: 180,
        composite: false,
        postFilters: [postFilter('broken', { glsl: 'not glsl', wgsl }), postFilter('tint', { glsl, wgsl })],
      })
      const program = scoped(async () => {
        const { stage } = await built(factory({ ...createFakeTarget(), bus }))
        expect(stage.postFilters.ids).toEqual(['tint'])
      })
      await program
      expect(published).toEqual([
        ['render.filter.dropped', { id: 'broken', reason: expect.stringContaining('syntax error') }],
      ])
      warn.mockRestore()
    })

    it('throws when a name is declared twice, because the slot would silently replace the first', () => {
      expect(() =>
        createPixiRenderer({
          postFilters: [postFilter('tint', { glsl, wgsl }), postFilter('tint', { glsl, wgsl })],
        }),
      ).toThrow('postFilter "tint" is declared twice')
    })
  })

  describe('the fixed-resolution composite (M4 spec §4.11)', () => {
    it('is on for a letterboxed pixel-art stage: draw renders the world and UI into it before app.render', async () => {
      const target = createFakeTarget()
      const calls: string[] = []
      const program = scoped(async () => {
        const renderer = await built(createPixiRenderer({ logicalWidth: 320, logicalHeight: 180 })(target))
        const { composite, app, world, ui, frame } = renderer.stage
        expect(composite).toBeDefined()
        if (!composite || !frame) return
        expect(world.parent).toBe(composite.stage)
        expect(ui.parent).toBe(composite.stage)
        expect(composite.sprite.parent).toBe(frame.root)
        vi.mocked(app.renderer.render).mockImplementation(((options: {
          container: Container
          target: unknown
        }) => {
          calls.push(
            options.container === composite.stage && options.target === composite.texture
              ? 'composite'
              : 'other',
          )
        }) as never)
        vi.spyOn(app, 'render').mockImplementation(() => void calls.push('app.render'))
        renderer.draw({ alpha: 1, frameMs: 16, paused: false })
        return [...calls]
      })
      expect(await program).toEqual(['composite', 'app.render'])
    })

    it("resizes to the frame's field height when the geometry changes", async () => {
      const target = createFakeTarget()
      const program = scoped(async () => {
        const renderer = await built(createPixiRenderer({ logicalWidth: 320, logicalHeight: 180 })(target))
        const { composite, frame } = renderer.stage
        if (!composite || !frame) throw new Error('no composite')
        vi.spyOn(frame, 'layout').mockReturnValue({ ...frame.layout(800, 600), fieldHeight: 240 })
        target.triggerResize({ width: 390, height: 844 })
        return composite.texture.height
      })
      expect(await program).toBe(240)
    })

    it("puts the post-filter slot's filters on the composite stage, not the scene", async () => {
      const target = createFakeTarget()
      const crt = { name: 'crt' } as unknown as Filter
      const program = scoped(async () => {
        const renderer = await built(
          createPixiRenderer({
            logicalWidth: 320,
            logicalHeight: 180,
            setup: (stage) => void stage.postFilters.set('retro', [crt]),
          })(target),
        )
        expect(renderer.stage.composite?.stage.filters).toEqual([crt])
        expect(renderer.stage.frame?.scene.filters ?? null).toBeNull()
        expect(renderer.stage.filters).toEqual([crt])
      })
      await program
    })

    it('is off with composite: false, with pixelArt: false, and without a letterbox', async () => {
      const program = scoped(async () => {
        const off = await built(
          createPixiRenderer({ logicalWidth: 320, logicalHeight: 180, composite: false })(createFakeTarget()),
        )
        const smooth = await built(
          createPixiRenderer({
            logicalWidth: 320,
            logicalHeight: 180,
            pixelArt: false,
          })(createFakeTarget()),
        )
        const bare = await built(createPixiRenderer()(createFakeTarget()))
        return [off, smooth, bare].map((r) => [
          r.stage.composite,
          r.stage.world.parent === r.stage.frame?.root,
        ])
      })
      expect(await program).toEqual([
        [undefined, true],
        [undefined, true],
        [undefined, false],
      ])
    })

    it('is destroyed by dispose', async () => {
      const renderer = await built(
        createPixiRenderer({ logicalWidth: 320, logicalHeight: 180 })(createFakeTarget()),
      )
      opened = []
      const composite = renderer.stage.composite
      if (!composite) throw new Error('no composite')
      const destroy = vi.spyOn(composite, 'destroy')
      renderer.dispose()
      expect(destroy).toHaveBeenCalledTimes(1)
    })
  })

  describe('at a quality tier (M4 spec §4.11, Q-a)', () => {
    let dpr: PropertyDescriptor | undefined
    beforeEach(() => {
      dpr = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio')
      Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 })
    })
    afterEach(() => {
      if (dpr) Object.defineProperty(window, 'devicePixelRatio', dpr)
      else Reflect.deleteProperty(window, 'devicePixelRatio')
    })

    it('at low draws at resolution 1 and leaves out a minTier medium owner; setQuality brings both back', async () => {
      const target = createFakeTarget()
      const bloom = { name: 'bloom' } as unknown as Filter
      const lock = { name: 'lock' } as unknown as Filter
      const factory = createPixiRenderer({
        logicalWidth: 960,
        logicalHeight: 540,
        quality: 'low',
        setup(stage) {
          stage.postFilters.set('bloom', [bloom], 0, { minTier: 'medium' })
          stage.postFilters.set('lock', [lock], 10)
        },
      })

      const program = scoped(async () => {
        const renderer = await built(factory(target))
        expect(initSpy).toHaveBeenCalledWith(expect.objectContaining({ resolution: 1 }))
        expect(renderer.stage.quality).toBe('low')
        expect(renderer.stage.filters).toEqual([lock])

        renderer.stage.setQuality('high')
        expect(renderer.stage.app.renderer.resolution).toBe(2)
        expect(renderer.stage.filters).toEqual([bloom, lock])

        renderer.stage.setQuality('medium')
        target.triggerResize({ width: 1024, height: 768 })
        expect(renderer.stage.app.renderer.resolution).toBe(1.5)
      })

      await program
    })

    it('starts at high', async () => {
      const target = createFakeTarget()
      const program = scoped(async () => {
        const renderer = await built(createPixiRenderer({ logicalWidth: 960, logicalHeight: 540 })(target))
        expect(renderer.stage.quality).toBe('high')
        expect(initSpy).toHaveBeenCalledWith(expect.objectContaining({ resolution: 2 }))
      })
      await program
    })
  })
})
