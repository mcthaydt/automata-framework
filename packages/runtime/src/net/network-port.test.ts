import {
  type Command,
  createSim,
  defineCommand,
  definePlugin,
  defineResource,
  defineSystem,
  type Sim,
} from '@mcthaydt/automata-sim'
import { Context, Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { type AuthoritativeSnapshot, NetworkPort } from './network-port.js'

// What a networking extension (Plus `net`) or a game does with the port (PRODUCT spec §2 F1): remote commands
// in, authoritative snapshots out. The transport here is user code: two in-memory ends of one link.

const Add = defineCommand('add', z.object({ value: z.number().int() }))
const Total = defineResource('total', z.object({ sum: z.number().int() }), () => ({ sum: 0 }))
const adder = definePlugin({
  name: 'adder',
  commands: [Add],
  resources: [Total],
  systems: [
    defineSystem({
      name: 'add',
      phase: 'gameplay',
      run(ctx) {
        for (const command of ctx.commands.of(Add)) ctx.resource(Total).sum += command.payload.value
      },
    }),
  ],
})

/** A loopback link written as a game or extension would write its own transport. */
function memoryLink(): { readonly client: NetworkPort; readonly authority: NetworkPort } {
  const toAuthority = new Set<(command: Command) => void>()
  const toClient = new Set<(snapshot: AuthoritativeSnapshot) => void>()
  const listen =
    <T>(listeners: Set<(value: T) => void>) =>
    (listener: (value: T) => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  const none = () => () => undefined
  return {
    client: {
      onRemoteCommand: none,
      sendCommand: (command) => {
        for (const listener of toAuthority) listener(command)
      },
      publishSnapshot: () => undefined,
      onSnapshot: listen(toClient),
    },
    authority: {
      onRemoteCommand: listen(toAuthority),
      sendCommand: () => undefined,
      publishSnapshot: (snapshot) => {
        for (const listener of toClient) listener(snapshot)
      },
      onSnapshot: none,
    },
  }
}

const snapshotOf = (sim: Sim): AuthoritativeSnapshot => ({
  tick: sim.tick,
  bytes: sim.snapshot(),
  hash: sim.hash(),
})

describe('NetworkPort: remote commands in, authoritative snapshots out', () => {
  it('drives an authority sim from remote commands and brings the client to its snapshot', async () => {
    const authoritySim = await createSim({ seed: 7, plugins: [adder] })
    const clientSim = await createSim({ seed: 7, plugins: [adder] })
    const link = memoryLink()

    // The authority side, reached only through the tag, as an extension would.
    const authority = Effect.gen(function* () {
      const port = yield* NetworkPort
      const inbox: Command[] = []
      const stop = port.onRemoteCommand((command) => inbox.push(command))
      return {
        step: () => {
          authoritySim.step(inbox.splice(0))
          port.publishSnapshot(snapshotOf(authoritySim))
        },
        stop,
      }
    }).pipe(Effect.provide(Context.make(NetworkPort, link.authority)), Effect.runSync)

    const received: AuthoritativeSnapshot[] = []
    link.client.onSnapshot((snapshot) => {
      received.push(snapshot)
      clientSim.restore(snapshot.bytes)
    })

    link.client.sendCommand({ tick: 0, source: 1, seq: 0, type: 'add', payload: { value: 5 } })
    link.client.sendCommand({ tick: 0, source: 2, seq: 0, type: 'add', payload: { value: 3 } })
    authority.step()

    expect(received.map((snapshot) => snapshot.tick)).toEqual([1])
    expect(authoritySim.resource(Total).sum).toBe(8)
    expect(clientSim.resource(Total).sum).toBe(8)
    expect(clientSim.hash()).toBe(received[0]?.hash)
    expect(clientSim.hash()).toBe(authoritySim.hash())

    // After the listener is removed, later commands never reach the authority.
    authority.stop()
    link.client.sendCommand({ tick: 1, source: 1, seq: 1, type: 'add', payload: { value: 100 } })
    authority.step()
    expect(authoritySim.resource(Total).sum).toBe(8)
  })
})
