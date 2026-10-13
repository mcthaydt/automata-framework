import type { FrameInfo, RendererUnavailable } from '@mcthaydt/automata-runtime'
import type { StepResult } from '@mcthaydt/automata-sim'
import type { Geometry } from '@mcthaydt/automata-ui'
import { Effect, Exit, Scope } from 'effect'
import { Application, type ApplicationOptions, Container } from 'pixi.js'
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import { createPixiRenderer } from './renderer.js'

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

    const program = Effect.scoped(
      Effect.gen(function* () {
        const renderer = yield* factory(target)
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
      }),
    )

    await Effect.runPromise(program)
  })

  it('respects preference: webgpu', async () => {
    const target = createFakeTarget()
    const factory = createPixiRenderer({ preference: 'webgpu' })

    const program = Effect.scoped(
      Effect.gen(function* () {
        const renderer = yield* factory(target)
        expect(initSpy).toHaveBeenCalledTimes(1)
        expect(initSpy.mock.calls[0]?.[0]?.preference).toBe('webgpu')
        expect(renderer.stage.app.canvas.dataset.renderer).toBe('webgpu')
      }),
    )

    await Effect.runPromise(program)
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

    const program = Effect.scoped(
      Effect.gen(function* () {
        const renderer = yield* factory(target)
        expect(attempts).toBe(2)
        expect(destroySpy).toHaveBeenCalledWith(true, { children: true })
        expect(initSpy.mock.calls[0]?.[0]?.preference).toBe('webgpu')
        expect(initSpy.mock.calls[1]?.[0]?.preference).toBe('webgl')
        expect(renderer.stage.app.canvas.dataset.renderer).toBe('webgl')
      }),
    )

    await Effect.runPromise(program)
    destroySpy.mockRestore()
  })

  it('fails with RendererUnavailable when all backends fail', async () => {
    const target = createFakeTarget()
    mockInitBehavior = () => {
      throw new Error('WebGL creation failed')
    }

    const factory = createPixiRenderer({ preference: 'webgpu' })

    const program = Effect.scoped(factory(target))
    const result = await Effect.runPromise(Effect.either(program))

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      const err = result.left as RendererUnavailable
      expect(err._tag).toBe('RendererUnavailable')
      expect(err.tried).toEqual(['webgpu', 'webgl2'])
    }
  })

  it('resizes renderer and updates letterbox layout when geometry changes', async () => {
    const target = createFakeTarget({ width: 800, height: 600 })
    const factory = createPixiRenderer({ logicalWidth: 960, logicalHeight: 540 })

    const program = Effect.scoped(
      Effect.gen(function* () {
        const renderer = yield* factory(target)
        const frame = renderer.stage.frame
        expect(frame).toBeDefined()
        if (!frame) return
        const layoutSpy = vi.spyOn(frame, 'layout')

        target.triggerResize({ width: 1024, height: 768 })

        expect(renderer.stage.app.renderer.resize).toHaveBeenCalledWith(1024, 768)
        expect(layoutSpy).toHaveBeenCalledWith(1024, 768)
      }),
    )

    await Effect.runPromise(program)
  })

  it('scope finalizer cleans up app, views, frame, and removes canvas from DOM', async () => {
    const target = createFakeTarget()
    const factory = createPixiRenderer({ logicalWidth: 960, logicalHeight: 540 })

    const scope = Effect.runSync(Scope.make())
    const renderer = await Effect.runPromise(Scope.extend(factory(target), scope))

    const destroySpy = vi.spyOn(renderer.stage.app, 'destroy')
    const frame = renderer.stage.frame
    expect(frame).toBeDefined()
    if (!frame) return
    const frameDestroySpy = vi.spyOn(frame, 'destroy')

    expect(target.host.children.length).toBe(1)

    await Effect.runPromise(Scope.close(scope, Exit.void))

    expect(destroySpy).toHaveBeenCalled()
    expect(frameDestroySpy).toHaveBeenCalled()
    expect(target.host.children.length).toBe(0)
  })

  it('forwards delta in apply and executes synchronous draw without Effect allocation', async () => {
    const target = createFakeTarget()
    const factory = createPixiRenderer()

    const program = Effect.scoped(
      Effect.gen(function* () {
        const renderer = yield* factory(target)
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
      }),
    )

    await Effect.runPromise(program)
  })
})
