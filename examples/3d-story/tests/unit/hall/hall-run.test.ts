import { content } from 'virtual:automata/content'
import { cameraHeadingPlugin } from '@automata/3d/sim'
import { navExtension } from '@automata/nav'
import { puzzleExtension } from '@automata/puzzle'
import { sectorsExtension } from '@automata/sectors'
import { InSector } from '@automata/sectors/sim'
import { createSim, type Sim, type SimEvent } from '@automata/sim'
import { systemsExtension } from '@automata/systems'
import { SystemsMode, SystemsState } from '@automata/systems/sim'
import { describe, expect, it } from 'vitest'
import { scenePlugin } from '#src/app/scene.plugin.ts'
import type { StoryContent } from '#src/app/story.ts'
import { storyOf } from '#src/app/story-content.ts'
import { Actor } from '#src/features/guard/actor.component.ts'
import { spawnWick, wickPlugin } from '#src/features/wick/wick.plugin.ts'
import { TICK_HZ } from '#src/shared/constants.ts'

// The hall played in Node, with no browser: the sim a scripted run drives, and what it holds. A run is the game's own
// files (the level, the guard's behaviour, the places and the puzzle) and a list of seconds to wait, so the same list
// must end in the same state, and the guard must patrol.

async function hall(story: StoryContent = storyOf(content)) {
  const systems = systemsExtension()
  const sim = await createSim({
    seed: 1,
    tickHz: TICK_HZ,
    plugins: [
      ...[
        sectorsExtension,
        navExtension,
        puzzleExtension({ extensions: ['systems'] }),
        systems.extension,
      ].flatMap((e) => e.sim ?? []),
      cameraHeadingPlugin,
      wickPlugin,
      scenePlugin(systems),
    ],
    content: story,
  })
  spawnWick(sim, story.room)
  return sim
}

/** Steps for `seconds`, with no one pushing the stick, and gives every event on the way. */
function wait(sim: Sim, seconds: number): SimEvent[] {
  const events: SimEvent[] = []
  for (let i = 0; i < Math.round(seconds * TICK_HZ); i++) events.push(...sim.step([]).events)
  return events
}

const guardAt = (sim: Sim) => {
  const record = sim.resource(SystemsState).agents.guard
  const at = sim.entity((record as { sid: number }).sid)?.get(InSector)
  return { mode: record?.mode, x: at?.x ?? NaN, z: at?.z ?? NaN }
}

describe('the hall', () => {
  it('puts the guard on its first stop and the player 5 m from it', async () => {
    const sim = await hall()
    wait(sim, 0.1)
    expect(guardAt(sim)).toMatchObject({ mode: 'patrol', x: 7, z: 0 })
    expect(sim.query(Actor)).toHaveLength(1)
    sim.dispose()
  })

  it('leaves the guard on patrol for 3 s when the player is outside its sight (4 m, and 5 m away)', async () => {
    const sim = await hall()
    const modes = wait(sim, 3).filter((e) => e.type === SystemsMode.id)
    expect(modes).toEqual([])
    expect(guardAt(sim).mode).toBe('patrol')
    sim.dispose()
  })

  it('patrols: after its wait at the first stop it walks toward the doorway, and notices the player on the way', async () => {
    const sim = await hall()
    wait(sim, 3.9)
    const early = guardAt(sim)
    expect(early.x).toBe(7)
    const events = wait(sim, 2)
    // It walks west at 1.4 m/s and is within 4 m of the player (at x = 2) before long: the first thing it does is hunt.
    expect(guardAt(sim).x).toBeLessThan(early.x - 1)
    expect(events.find((e) => e.type === SystemsMode.id)?.payload).toMatchObject({
      from: 'patrol',
      to: 'hunt',
    })
    sim.dispose()
  })

  it('gives chase once the guard sees farther than the player is (the file is the guard)', async () => {
    const story = storyOf(content)
    const sees7 = {
      ...story,
      systems: {
        ...story.systems,
        agents: story.systems.agents.map((agent) => ({
          ...agent,
          senses: agent.senses.map((sense) =>
            'sight' in sense ? { sight: { ...sense.sight, range: 7 } } : sense,
          ),
        })),
      },
    } as StoryContent
    const sim = await hall(sees7)
    const modes = wait(sim, 1).filter((e) => e.type === SystemsMode.id)
    expect(modes[0]?.payload).toMatchObject({ agent: 'guard', from: 'patrol', to: 'hunt' })
    sim.dispose()
  })

  it('ends in the same state every time the same run is played', async () => {
    const hashes: string[] = []
    for (let run = 0; run < 2; run++) {
      const sim = await hall()
      wait(sim, 8)
      hashes.push(sim.hash())
      sim.dispose()
    }
    expect(hashes[0]).toBe(hashes[1])
  })
})
