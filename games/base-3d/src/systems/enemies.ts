// The enemies' brains (DESIGN.md §8.1, GAME-3D.1d part 1): deterministic state machines on sim state and integer
// timers, with no RNG (the drops are the only roll). An enemy fights through the combat systems as Wick does: its
// brain starts a move on its `fighter` row, `combat.moves` runs it and `combat.hits` lands it. The waiting ring
// follows the brawl's `watch` strafe in The Last Light's `src/fight/brawl/moves.ts` (read at `92e6704`), rewritten
// on integers; the source is not edited. Sim code: `pnpm boundaries` checks it.
import { defineSystem, type EntityRef, type SimContext, type SystemDef } from '@mcthaydt/automata-sim'
import { Enemy, Fighter, Hero, Target } from '../components.ts'
import {
  angerSkip,
  BrainState,
  ENEMIES,
  type EnemyDef,
  enemyOf,
  MAX_TOKENS,
  NOTICE_TICKS,
  PACE_TICKS,
  RING_FAR,
  RING_NEAR,
} from '../constants/enemies.ts'
import { CombatState, type MoveDef, metres } from '../constants/index.ts'
import { Location } from '../resources.ts'
import { type Area, areaIn, type PlanPoint, slide, worldOf } from './area.ts'
import { foeParts } from './area-foes.ts'
import { frozen, isHeld } from './combat.ts'
import { facingVector } from './combat-geometry.ts'
import { angleOf, lineOfSight, signedTurn } from './lock-target.ts'

const HALF_TURN = 32_768
const QUARTER_TURN = 16_384
const PACE = metres(1)
/**
 * A centimetre: an enemy this near its reach attacks. Its steps are truncated toward zero along a Q12 direction, so
 * the last fraction of a step can come out as nothing and it would stand short of its reach for ever.
 */
const REACH_SLACK = metres(0.01)

/** `facing` turned toward `wanted` by at most `rate` turn units. */
function turnToward(facing: number, wanted: number, rate: number): number {
  const turn = Math.max(-rate, Math.min(rate, signedTurn(wanted - facing)))
  return (facing + turn + 65_536) % 65_536
}

/** `step` Q16.16 metres along `heading` (turn units): truncated, so an engine never rounds differently. */
function along(heading: number, step: number): { dx: number; dz: number } {
  const direction = facingVector(heading)
  return { dx: Math.trunc((direction.x * step) / 4096), dz: Math.trunc((direction.z * step) / 4096) }
}

/** How far an idle enemy stands from home on tick `cycle` of its pace: out, still, back, still (`PACE_TICKS` each). */
function paceOffset(cycle: number): number {
  if (cycle < PACE_TICKS) return Math.trunc((PACE * (cycle + 1)) / PACE_TICKS)
  if (cycle < 2 * PACE_TICKS) return PACE
  if (cycle < 3 * PACE_TICKS) return Math.trunc((PACE * (3 * PACE_TICKS - 1 - cycle)) / PACE_TICKS)
  return 0
}

interface Scene {
  readonly ctx: SimContext
  readonly area: Area
  readonly moves: readonly MoveDef[]
  readonly wick: PlanPoint
  /** The tokens held so far this tick, counted in id order as each enemy takes or gives one up. */
  tokens: number
}

/** One enemy's tick: its brain's state, its place and facing, its token and the move it starts. */
function think(scene: Scene, entity: EntityRef, type: EnemyDef): void {
  const { ctx, area, wick } = scene
  const enemy = entity.get(Enemy)
  const fighter = entity.get(Fighter)
  const at = entity.get(Target)
  const dx = wick.x - at.x
  const dz = wick.z - at.z
  // Exact under 2^53 for any room under a few hundred metres; the square root of an integer is the same everywhere.
  const distance = Math.floor(Math.sqrt(dx * dx + dz * dz))
  const toWick = angleOf(dx, dz)
  let { brain, timer, token, attacks, follow, calls, called } = enemy
  // At half health or less an angry type's windups are shorter (§8.3): its moves start a few frames in.
  const angry = type.anger === true && fighter.health * 2 <= type.health
  const start = (move: number, opener: boolean) => {
    const def = scene.moves[move - 1]
    if (def === undefined) return
    follow = def.next === undefined ? 0 : scene.moves.findIndex((other) => other.id === def.next) + 1
    const moveTick = angry ? angerSkip(def, opener) : 0
    entity.set(Fighter, { move, moveTick, moveStart: ctx.tick, state: CombatState.act })
  }
  let { x, z, facing } = at
  let lift = type.lift
  const walk = (heading: number, step: number) => {
    const { dx: mx, dz: mz } = along(heading, step)
    const moved = slide(area.walls, type.radius, { x, z }, mx, mz)
    x = moved.x
    z = moved.z
  }
  const release = () => {
    if (token) scene.tokens -= 1
    token = false
  }

  if (isHeld(fighter.state)) {
    // Hit or stopped: it loses its token (§8.1 rule 3), and once it is up it recovers before it closes in again. A Wisp that is hit,
    // blocked or parried lies on the floor while it reels (§8.2).
    release()
    brain = BrainState.recover
    timer = type.recover
    follow = 0
    if (type.grounded !== undefined) lift = 0
  } else if (brain === BrainState.attack) {
    const def = scene.moves[fighter.move - 1]
    // A combo's move about to end chains into its next at once, keeping the token (§8.3).
    if (def !== undefined && follow !== 0 && fighter.moveTick + 1 > def.total) start(follow, false)
    else if (fighter.move === 0 || def === undefined) {
      release()
      brain = BrainState.recover
      timer = type.recover
    } else {
      // The frame `combat.moves` plays this tick: a bite or a dive carries it along its facing on its active frames,
      // and a dive brings a Wisp down to Wick's height.
      const frame = fighter.moveTick + 1
      const [first, last] = def.active
      if (frame >= first && frame <= last) {
        lift = 0
        if (def.lunge !== undefined) {
          const span = last - first + 1
          const lunge = def.lunge
          const done = (count: number) => Math.trunc((lunge * count) / span)
          walk(facing, done(frame - first + 1) - done(frame - first))
        }
      }
    }
  } else if (brain === BrainState.idle) {
    const cycle = timer % (4 * PACE_TICKS)
    const out = cycle < 2 * PACE_TICKS
    facing = out ? enemy.homeFacing : (enemy.homeFacing + HALF_TURN) % 65_536
    const offset = along(enemy.homeFacing, paceOffset(cycle))
    const moved = slide(area.walls, type.radius, at, enemy.homeX + offset.dx - x, enemy.homeZ + offset.dz - z)
    x = moved.x
    z = moved.z
    timer += 1
    if (distance <= type.notice && lineOfSight(area.walls, at, wick)) {
      brain = BrainState.notice
      timer = NOTICE_TICKS
    }
  } else {
    facing = turnToward(facing, toWick, type.turn)
    if (brain === BrainState.notice || brain === BrainState.recover) {
      timer = Math.max(0, timer - 1)
      if (timer === 0) brain = BrainState.approach
    } else {
      // Approaching or circling: a token when fewer than `MAX_TOKENS` are held (§8.1 rule 2).
      if (!token && scene.tokens < MAX_TOKENS) {
        token = true
        scene.tokens += 1
      }
      brain = token ? BrainState.approach : BrainState.circle
      if (token && distance <= type.reach + REACH_SLACK) {
        const id = type.attacks[attacks % type.attacks.length]
        const move = scene.moves.findIndex((candidate) => candidate.id === id) + 1
        if (move !== 0) {
          brain = BrainState.attack
          attacks += 1
          start(move, true)
        }
      } else if (token) walk(toWick, Math.min(type.speed, distance - type.reach))
      else if (distance < RING_NEAR) walk(toWick + HALF_TURN, Math.min(type.speed, RING_NEAR - distance))
      else if (distance > RING_FAR) walk(toWick, Math.min(type.speed, distance - RING_FAR))
      // Inside the ring: it strafes round Wick at half its walk, never starting a windup without a token.
      else walk(toWick + QUARTER_TURN, Math.trunc(type.speed / 2))
    }
  }
  // An angry Captain calls one of its kind from the next vent while fewer than `most` live (§8.3).
  if (angry && type.calls !== undefined && !isHeld(fighter.state)) {
    const { kind: callKind, every, most } = type.calls
    const kind = ENEMIES.findIndex((other) => other.id === callKind) + 1
    const vent = area.vents[called % Math.max(1, area.vents.length)]
    const alive = ctx.query(Enemy).filter((other) => other.get(Enemy).kind === kind).length
    if (calls > 0) calls -= 1
    else if (vent !== undefined && kind !== 0 && alive < most) {
      ctx.spawn(...foeParts({ kind, ...vent, facing: 0 }))
      called += 1
      calls = every
    }
  }
  entity.set(Enemy, { brain, timer, token, attacks, follow, calls, called })
  entity.set(Target, { x, z, facing })
  if (lift !== fighter.lift) entity.set(Fighter, { lift })
}

/**
 * Runs every enemy's brain (§8.1 rule 5), in id order, before `combat.moves` plays the move one starts: idle pacing
 * at home until Wick is in sight within its `notice`, a pause turning to him, then closing to its `reach` with an
 * attack token and attacking, or keeping the 2.9 to 3.8 m ring without one, and recovering after each attack.
 */
export const enemyBrain: SystemDef = defineSystem({
  name: 'enemy.brain',
  phase: 'prePhysics',
  after: ['combat.status'],
  before: ['combat.moves'],
  run(ctx) {
    if (frozen(ctx)) return
    const [wick] = ctx.query(Hero)
    if (wick === undefined) return
    const enemies = ctx.query(Enemy, Fighter, Target)
    const scene: Scene = {
      ctx,
      area: areaIn(ctx.content, ctx.resource(Location)),
      moves: worldOf(ctx.content).moves,
      wick: wick.get(Hero),
      tokens: enemies.filter((entity) => entity.get(Enemy).token).length,
    }
    for (const entity of enemies) {
      const type = enemyOf(entity.get(Enemy).kind)
      if (type !== undefined) think(scene, entity, type)
    }
  },
})
