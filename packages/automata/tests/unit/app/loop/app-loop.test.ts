import {
  createSim,
  defineCommand,
  defineEvent,
  definePlugin,
  defineSystem,
  SimFaultedError,
} from '@mcthaydt/automata-sim'
import { Context, Effect, Exit, Scope } from 'effect'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { AppLoop, makeAppLoop } from '#src/app/loop/app-loop.manager.ts'
import { makePresentationBus } from '#src/app/presentation/presentation-bus.manager.ts'
import { makeTime } from '#src/app/time/time.manager.ts'
import { manualFrames } from '#src/testing/runtime/manual-frames.ts'
import { type NullRendererEntry, nullRenderer } from '#src/testing/runtime/null-renderer.ts'

describe('AppLoop', () => {
  const Ping = defineCommand('ping', z.object({ value: z.number() }))
  const Pong = defineEvent('pong', z.object({ value: z.number() }))

  const pingPlugin = definePlugin({
    name: 'ping-plugin',
    commands: [Ping],
    events: [Pong],
    systems: [
      defineSystem({
        name: 'ping-system',
        phase: 'gameplay',
        run(ctx) {
          for (const cmd of ctx.commands.of(Ping)) {
            ctx.emit(Pong, { value: cmd.payload.value })
          }
        },
      }),
    ],
  })

  it('runs one step in order: commands(sim.tick), sim.step, renderer.apply(result); rejected commands go to error log; sim.events published only when non-empty', async () => {
    const sim = await createSim({ seed: 1, plugins: [pingPlugin] })
    const frames = manualFrames(0)
    const renderLog: NullRendererEntry[] = []

    await Effect.gen(function* () {
      const scope = yield* Scope.make()
      const bus = yield* makePresentationBus().pipe(Scope.extend(scope))
      const time = makeTime(bus)
      const renderer = yield* nullRenderer(renderLog)({
        host: document.createElement('div'),
        geometry: {} as any,
        assets: { get: () => undefined },
      }).pipe(Scope.extend(scope))

      const loggedErrors: unknown[] = []
      const busEvents: unknown[] = []
      bus.subscribe('sim.events', (events) => {
        busEvents.push(...events)
      })

      const callOrder: string[] = []
      const loop = yield* makeAppLoop({
        frames,
        renderer: {
          apply: (res) => {
            callOrder.push('renderer.apply')
            renderer.apply(res)
          },
          draw: renderer.draw,
          reset: renderer.reset,
        },
        time,
        bus,
        onFault: () => {},
        logError: (err) => loggedErrors.push(err),
      }).pipe(Scope.extend(scope))

      // Run with commands function
      loop.run({
        sim,
        commands: (tick) => {
          callOrder.push(`commands:${tick}`)
          if (tick === 0) {
            return [
              // valid ping command
              { tick, source: 0, seq: 1, type: 'ping', payload: { value: 42 } },
              // invalid command to trigger rejection
              { tick, source: 0, seq: 2, type: 'unknown_cmd', payload: {} },
            ]
          }
          return []
        },
      })

      expect(loop.running).toBe(true)

      // Advance by one full step (1000/60 ms)
      frames.advance(1000 / 60)

      expect(callOrder).toEqual(['commands:0', 'renderer.apply'])
      expect(renderLog).toEqual([{ type: 'reset' }, { type: 'apply', tick: 1 }, { type: 'draw', alpha: 0 }])

      // Rejected command was logged
      expect(loggedErrors.length).toBe(1)
      expect((loggedErrors[0] as any).reason).toBe('unknown-command')

      // Event was emitted
      expect(busEvents).toEqual([{ type: 'pong', payload: { value: 42 } }])

      // Advance again with no commands -> sim.events is NOT published if result.events is empty
      busEvents.length = 0
      frames.advance(1000 / 60)
      expect(busEvents.length).toBe(0)

      yield* Scope.close(scope, Exit.void)
      sim.dispose()
    }).pipe(Effect.runPromise)
  })

  it('draws every display frame with alpha; while Time is paused, frames draw without stepping', async () => {
    const sim = await createSim({ seed: 1, plugins: [pingPlugin] })
    const frames = manualFrames(0)
    const renderLog: NullRendererEntry[] = []

    await Effect.gen(function* () {
      const scope = yield* Scope.make()
      const bus = yield* makePresentationBus().pipe(Scope.extend(scope))
      const time = makeTime(bus)
      const renderer = yield* nullRenderer(renderLog)({
        host: document.createElement('div'),
        geometry: {} as any,
        assets: { get: () => undefined },
      }).pipe(Scope.extend(scope))

      const loop = yield* makeAppLoop({
        frames,
        renderer,
        time,
        bus,
        onFault: () => {},
      }).pipe(Scope.extend(scope))

      loop.run({
        sim,
        commands: () => [],
      })

      // Half step advance: 1000 / 120 ms
      renderLog.length = 0
      frames.advance(1000 / 120)
      expect(renderLog).toEqual([{ type: 'draw', alpha: 0.5 }])

      // Pause Time
      time.pause('menu')
      renderLog.length = 0

      // When paused, frames draw with alpha 1 and no steps run
      frames.advance(1000 / 60)
      expect(renderLog).toEqual([{ type: 'draw', alpha: 1 }])
      expect(sim.tick).toBe(0)

      yield* Scope.close(scope, Exit.void)
      sim.dispose()
    }).pipe(Effect.runPromise)
  })

  it('run replaces the sim, calls renderer.reset() and resets the accumulator; stop stops stepping and drawing; running reflects both', async () => {
    const sim1 = await createSim({ seed: 1, plugins: [pingPlugin] })
    const sim2 = await createSim({ seed: 2, plugins: [pingPlugin] })
    const frames = manualFrames(0)
    const renderLog: NullRendererEntry[] = []

    await Effect.gen(function* () {
      const scope = yield* Scope.make()
      const bus = yield* makePresentationBus().pipe(Scope.extend(scope))
      const time = makeTime(bus)
      const renderer = yield* nullRenderer(renderLog)({
        host: document.createElement('div'),
        geometry: {} as any,
        assets: { get: () => undefined },
      }).pipe(Scope.extend(scope))

      const loop = yield* makeAppLoop({
        frames,
        renderer,
        time,
        bus,
        onFault: () => {},
      }).pipe(Scope.extend(scope))

      expect(loop.running).toBe(false)

      loop.run({ sim: sim1, commands: () => [] })
      expect(loop.running).toBe(true)
      expect(renderLog).toEqual([{ type: 'reset' }])

      // Advance half a step
      frames.advance(1000 / 120)

      // Replace sim with sim2
      renderLog.length = 0
      loop.run({ sim: sim2, commands: () => [] })
      expect(renderLog).toEqual([{ type: 'reset' }])

      // Accumulator was reset, so advance another half step does NOT step sim2 yet
      frames.advance(1000 / 120)
      expect(sim2.tick).toBe(0)

      // Stop
      loop.stop()
      expect(loop.running).toBe(false)
      renderLog.length = 0

      // Frames advance does nothing while stopped
      frames.advance(1000 / 60)
      expect(renderLog).toEqual([])
      expect(sim2.tick).toBe(0)

      yield* Scope.close(scope, Exit.void)
      sim1.dispose()
      sim2.dispose()
    }).pipe(Effect.runPromise)
  })

  it('a step that throws stops the loop, calls onFault(cause) once and requests no more frames; the loop does not restart it', async () => {
    const faultPlugin = definePlugin({
      name: 'fault-plugin',
      systems: [
        defineSystem({
          name: 'fault-system',
          phase: 'gameplay',
          run() {
            throw new Error('boom!')
          },
        }),
      ],
    })
    const sim = await createSim({ seed: 1, plugins: [faultPlugin] })
    const frames = manualFrames(0)
    const faults: unknown[] = []

    await Effect.gen(function* () {
      const scope = yield* Scope.make()
      const bus = yield* makePresentationBus().pipe(Scope.extend(scope))
      const time = makeTime(bus)
      const renderer = yield* nullRenderer()({
        host: document.createElement('div'),
        geometry: {} as any,
        assets: { get: () => undefined },
      }).pipe(Scope.extend(scope))

      const loop = yield* makeAppLoop({
        frames,
        renderer,
        time,
        bus,
        onFault: (cause) => faults.push(cause),
      }).pipe(Scope.extend(scope))

      loop.run({ sim, commands: () => [] })
      expect(loop.running).toBe(true)

      // Advance frame to trigger step which throws
      frames.advance(1000 / 60)

      expect(loop.running).toBe(false)
      expect(faults.length).toBe(1)
      expect(faults[0]).toBeInstanceOf(SimFaultedError)
      expect((faults[0] as Error).message).toContain('boom!')
      expect(frames.pending).toBe(false)

      // Another frame advance does nothing
      frames.advance(1000 / 60)
      expect(faults.length).toBe(1)

      // Attempting to run does not restart faulted loop
      loop.run({ sim, commands: () => [] })
      expect(loop.running).toBe(false)

      yield* Scope.close(scope, Exit.void)
      sim.dispose()
    }).pipe(Effect.runPromise)
  })

  it('closing the scope cancels the pending frame and a later run does not start the loop', async () => {
    const sim = await createSim({ seed: 1, plugins: [pingPlugin] })
    const frames = manualFrames(0)

    await Effect.gen(function* () {
      const scope = yield* Scope.make()
      const bus = yield* makePresentationBus().pipe(Scope.extend(scope))
      const time = makeTime(bus)
      const renderer = yield* nullRenderer()({
        host: document.createElement('div'),
        geometry: {} as any,
        assets: { get: () => undefined },
      }).pipe(Scope.extend(scope))

      const loop = yield* makeAppLoop({
        frames,
        renderer,
        time,
        bus,
        onFault: () => {},
      }).pipe(Scope.extend(scope))

      loop.run({ sim, commands: () => [] })
      expect(loop.running).toBe(true)
      expect(frames.pending).toBe(true)

      // Close scope
      yield* Scope.close(scope, Exit.void)

      expect(loop.running).toBe(false)
      expect(frames.pending).toBe(false)

      // Later run does not start the loop
      loop.run({ sim, commands: () => [] })
      expect(loop.running).toBe(false)
      expect(frames.pending).toBe(false)

      sim.dispose()
    }).pipe(Effect.runPromise)
  })

  it('the AppLoop tag provides the service', async () => {
    const sim = await createSim({ seed: 1, plugins: [pingPlugin] })
    const frames = manualFrames(0)

    await Effect.gen(function* () {
      const scope = yield* Scope.make()
      const bus = yield* makePresentationBus().pipe(Scope.extend(scope))
      const time = makeTime(bus)
      const renderer = yield* nullRenderer()({
        host: document.createElement('div'),
        geometry: {} as any,
        assets: { get: () => undefined },
      }).pipe(Scope.extend(scope))

      const loop = yield* makeAppLoop({
        frames,
        renderer,
        time,
        bus,
        onFault: () => {},
      }).pipe(Scope.extend(scope))

      const context = Context.make(AppLoop, loop)
      const resolved = Context.get(context, AppLoop)
      expect(resolved).toBe(loop)

      yield* Scope.close(scope, Exit.void)
      sim.dispose()
    }).pipe(Effect.runPromise)
  })
})
