// Combat (DESIGN.md §7, GAME-3D.1c part 1): hitstop, fighters' states and moves, and hits gathered then resolved.
// The rules follow The Last Light's duel (`src/fight/sim.ts` and `moves.ts`, read at `92e6704`): frame data per
// move, every hit of a tick gathered before any applies so two on one tick trade, a parry staggering the attacker,
// a block costing blockstun and a push, hitstop as one freeze counter. Rewritten on integers for the sim; the source
// is not edited. Sim code: `pnpm boundaries` checks it.
import { defineSystem, type EntityRef, type SimContext, type SystemDef } from '@mcthaydt/automata-sim'
import { Drop, Enemy, Fighter, Hero, HeroAction, HeroControl, Target } from '../components.ts'
import { dropOf, enemyOf } from '../constants/enemies.ts'
import {
  ACTION_BITS,
  ACTION_CLIP,
  BLOCK_FREEZE,
  BLOCK_PUSH,
  BLOCK_STUN,
  BUFFER_FROM,
  CombatState,
  FALL_IFRAMES,
  GUARD_HALF_ARC,
  HERO_MOVES,
  HURT_IFRAMES,
  HURT_STUN,
  KNOCKDOWN_POWER,
  KNOCKDOWN_TICKS,
  type MoveDef,
  PARRY_FRAMES,
  PARRY_FREEZE,
  PARRY_STAGGER,
  RISE_TICKS,
  SPIN_CHARGE,
  TICK_HZ,
} from '../constants/index.ts'
import { CaptainDefeated, FoeDefeated, HeroDefeated, HitLanded } from '../events.ts'
import { Freeze, Location } from '../resources.ts'
import { areaIn, slide, worldOf } from './area.ts'
import { facingVector, inArc, type Q12Direction, reachHits, ringHits } from './combat-geometry.ts'
import { angleOf } from './lock-target.ts'

/** Whether this tick is a hitstop tick: every system but the input copy and `combat.freeze` skips it. */
export const frozen = (ctx: SimContext): boolean => ctx.resource(Freeze).active

/** The states in which a fighter neither walks nor starts a move. */
const HELD_STATES: readonly number[] = [
  CombatState.stun,
  CombatState.blockstun,
  CombatState.stagger,
  CombatState.down,
  CombatState.defeated,
  CombatState.rise,
  CombatState.fall,
]
/** The states in which no hit lands: down and getting up (§7.2), falling, and out of the fight. */
const UNTOUCHABLE: readonly number[] = [
  CombatState.down,
  CombatState.rise,
  CombatState.fall,
  CombatState.defeated,
]
export const isHeld = (state: number): boolean => HELD_STATES.includes(state)

/** A fighter's place and facing: Wick's `hero` row, or anyone else's `target` row. */
function placeOf(entity: EntityRef): { x: number; z: number; facing: number } | undefined {
  if (entity.has(Hero)) return entity.get(Hero)
  if (entity.has(Target)) return entity.get(Target)
  return undefined
}

/** A push of `speed` (Q16.16 metres a second) along `direction`, as Q16.16 metres a tick. Exact: under 2^53. */
const pushOf = (direction: Q12Direction, speed: number): { pushX: number; pushZ: number } => ({
  pushX: Math.trunc((direction.x * speed) / 4096 / TICK_HZ),
  pushZ: Math.trunc((direction.z * speed) / 4096 / TICK_HZ),
})

const movesOf = (ctx: SimContext): readonly MoveDef[] => worldOf(ctx.content).moves

/**
 * Counts hitstop down (DESIGN.md §7.5). On a frozen tick it keeps what the freeze must not lose: a slash pressed now
 * is latched for the first live tick (the input buffer, G3-j), and the clocks that run on absolute ticks move on one
 * (an action's start, the guard's raise, an area swap), so nothing runs ahead of the frozen sim.
 */
export const combatFreeze: SystemDef = defineSystem({
  name: 'combat.freeze',
  phase: 'input',
  after: ['hero.input'],
  run(ctx) {
    const freeze = ctx.resource(Freeze)
    freeze.active = freeze.ticks > 0
    if (!freeze.active) return
    freeze.ticks -= 1
    for (const entity of ctx.query(Fighter, HeroControl))
      if ((entity.get(HeroControl).actPressed & ACTION_BITS.slash) !== 0)
        entity.set(Fighter, { latched: true })
    for (const entity of ctx.query(HeroAction)) {
      const action = entity.get(HeroAction)
      entity.set(HeroAction, {
        startedAt: action.clip === 0 ? action.startedAt : action.startedAt + 1,
        guardSince: action.guard ? action.guardSince + 1 : action.guardSince,
      })
    }
    const place = ctx.resource(Location)
    if (place.next >= 0) place.swapAt += 1
  },
})

/**
 * Runs the fighters' clocks: i-frames, and the held states' ticks. A held state ends in `idle`, except Wick's
 * `down` at 0 health, which ends in `defeated` and raises `hero.defeated` once (§7.8). A dummy's push moves it here;
 * Wick's moves him in `hero.move`.
 */
export const combatStatus: SystemDef = defineSystem({
  name: 'combat.status',
  phase: 'prePhysics',
  before: ['combat.moves'],
  run(ctx) {
    if (frozen(ctx)) return
    const { walls } = areaIn(ctx.content, ctx.resource(Location))
    for (const entity of ctx.query(Fighter)) {
      const fighter = entity.get(Fighter)
      const next: Partial<{ iframes: number; stun: number; state: number; pushTicks: number }> = {}
      // Ticks the attack button has been held running are counted in `combat.moves`.
      if (fighter.iframes > 0) next.iframes = fighter.iframes - 1
      if (isHeld(fighter.state) && fighter.state !== CombatState.defeated && fighter.stun > 0) {
        next.stun = fighter.stun - 1
        if (next.stun === 0) {
          const down = fighter.state === CombatState.down
          const defeated = down && fighter.health <= 0
          // A knockdown with health left gets up (`rise`) before it is idle again (§7.2).
          next.state = defeated ? CombatState.defeated : down ? CombatState.rise : CombatState.idle
          if (down && !defeated) next.stun = RISE_TICKS
          if (defeated) ctx.emit(HeroDefeated, {})
          // The end of a fall puts Wick back where he came into the room, facing in, with i-frames (§7.8).
          if (fighter.state === CombatState.fall && entity.has(Hero)) {
            const place = ctx.resource(Location)
            entity.set(Hero, { x: place.returnX, z: place.returnZ, facing: place.returnFacing })
            next.iframes = FALL_IFRAMES
          }
        }
      }
      if (fighter.pushTicks > 0 && entity.has(Target)) {
        const target = entity.get(Target)
        const moved = slide(walls, fighter.radius, target, fighter.pushX, fighter.pushZ)
        entity.set(Target, { x: moved.x, z: moved.z })
        next.pushTicks = fighter.pushTicks - 1
      }
      entity.set(Fighter, next)
    }
  },
})

/**
 * Advances every move a frame and starts the next (§7.2). Wick's slash press (or one latched through hitstop) starts
 * `slash-1` when he is idle, and during a slash from frame `BUFFER_FROM` to the end of its window queues the move's
 * `next`, which starts at the window's first frame (at once, inside it). One press queues one move; a move with no
 * `next` (the thrust) ends the chain. A move ends after its `total` frames. Wick's `hero-action` follows his move,
 * so the figure plays the slash clip from the move's start.
 */
export const combatMoves: SystemDef = defineSystem({
  name: 'combat.moves',
  phase: 'prePhysics',
  after: ['hero.act'],
  run(ctx) {
    if (frozen(ctx)) return
    const moves = movesOf(ctx)
    const first = moves.findIndex((move) => move.id === HERO_MOVES[0]?.id) + 1
    const spin = moves.findIndex((move) => move.id === 'spin') + 1
    for (const entity of ctx.query(Fighter)) {
      const fighter = entity.get(Fighter)
      const control = entity.has(HeroControl) ? entity.get(HeroControl) : undefined
      const pressed =
        fighter.latched || (control !== undefined && (control.actPressed & ACTION_BITS.slash) !== 0)
      // Attack held counts a charge; let go at `SPIN_CHARGE` or more, it spins, idle or out of a sword move (§7.2).
      const held = control !== undefined && (control.actHeld & ACTION_BITS.slash) !== 0
      const charge = held ? fighter.charge + 1 : 0
      const swinging = fighter.state === CombatState.act && moves[fighter.move - 1]?.hit !== undefined
      const spins =
        control !== undefined &&
        !held &&
        fighter.charge >= SPIN_CHARGE &&
        spin !== 0 &&
        (fighter.state === CombatState.idle || swinging)
      let { move, moveTick, moveStart, queued, state } = fighter
      if (spins) {
        move = spin
        moveTick = 1
        moveStart = ctx.tick
        queued = 0
        state = CombatState.act
      } else if (move !== 0) {
        moveTick += 1
        const def = moves[move - 1]
        const nextIndex = def?.next === undefined ? 0 : moves.findIndex((other) => other.id === def.next) + 1
        const windowEnd = def?.window?.[1] ?? 0
        if (pressed && nextIndex !== 0 && queued === 0 && moveTick >= BUFFER_FROM && moveTick <= windowEnd)
          queued = nextIndex
        if (queued !== 0 && moveTick >= (def?.window?.[0] ?? 0)) {
          move = queued
          moveTick = 1
          moveStart = ctx.tick
          queued = 0
        } else if (moveTick > (def?.total ?? 0)) {
          move = 0
          moveTick = 0
          queued = 0
          state = CombatState.idle
        }
      } else if (pressed && control !== undefined && state === CombatState.idle && first !== 0) {
        move = first
        moveTick = 1
        moveStart = ctx.tick
        state = CombatState.act
      }
      entity.set(Fighter, { move, moveTick, moveStart, queued, state, latched: false, charge })
      if (entity.has(HeroAction)) {
        // The figure plays the running move's clip from its start: a sword move as `slash`, a roll or hop as `move`
        // (the view finds which from `fighter.move`). It stops with the move: ended, cut short by a hit, or turned
        // into a roll. Both codes' starts shift through hitstop (`combat.freeze`), so the clip holds while frozen.
        const action = entity.get(HeroAction)
        const running = move === 0 ? undefined : moves[move - 1]
        const code =
          running?.hit !== undefined
            ? ACTION_CLIP.slash
            : running?.travel !== undefined
              ? ACTION_CLIP.move
              : 0
        if (code !== 0 && (moveStart !== fighter.moveStart || fighter.move === 0))
          entity.set(HeroAction, { clip: code, startedAt: moveStart })
        else if (code === 0 && (action.clip === ACTION_CLIP.slash || action.clip === ACTION_CLIP.move))
          entity.set(HeroAction, { clip: 0 })
      }
    }
  },
})

interface Contact {
  readonly attacker: EntityRef
  readonly defender: EntityRef
  readonly def: MoveDef
}

/** The hits this tick's active frames make, gathered before any applies (attackers, then defenders, by id). */
function gather(ctx: SimContext, moves: readonly MoveDef[]): Contact[] {
  const fighters = ctx.query(Fighter)
  const contacts: Contact[] = []
  for (const attacker of fighters) {
    const fighter = attacker.get(Fighter)
    const def = fighter.move === 0 ? undefined : moves[fighter.move - 1]
    const hit = def?.hit
    if (def === undefined || hit === undefined) continue
    if (fighter.moveTick < def.active[0] || fighter.moveTick > def.active[1]) continue
    const from = placeOf(attacker)
    if (from === undefined) continue
    const forward = facingVector(from.facing)
    for (const defender of fighters) {
      const target = defender.get(Fighter)
      if (target.side === fighter.side || target.health <= 0 || target.iframes > 0) continue
      if (UNTOUCHABLE.includes(target.state)) continue
      if (target.hitBy === attacker.sid && target.hitStamp === fighter.moveStart) continue
      // A roll's or hop's invulnerable frames, and its lower hurt cylinder (§7.2, §7.3).
      const running = target.move === 0 ? undefined : moves[target.move - 1]
      const invuln = running?.invuln
      if (invuln !== undefined && target.moveTick >= invuln[0] && target.moveTick <= invuln[1]) continue
      const at = placeOf(defender)
      // The hurt cylinder stands from its floor (`lift`, a hovering Wisp's) up its height.
      const height = running?.height ?? target.height
      if (at === undefined || hit.bottom > target.lift + height || hit.top < target.lift) continue
      const reaches =
        hit.around === true
          ? ringHits(from, hit.far, at, target.radius)
          : reachHits(from, forward, hit, at, target.radius)
      if (reaches) contacts.push({ attacker, defender, def })
    }
  }
  return contacts
}

/**
 * Lands this tick's hits (§7.3, §7.4): gathered first, then applied in order, so two on one tick both land (G3-k)
 * and a defender already at 0 takes no second (G3-F8). Wick's guard parries a frontal hit on its frames 1 to 8 and
 * blocks one after; a low or unblockable hit, or one from outside the arc, lands. A hit costs health (double on a
 * staggered defender), stuns and pushes; the tick's hitstop is the largest of its hits' (§7.5).
 */
export const combatHits: SystemDef = defineSystem({
  name: 'combat.hits',
  phase: 'gameplay',
  run(ctx) {
    if (frozen(ctx)) return
    const moves = movesOf(ctx)
    let freeze = 0
    for (const { attacker, defender, def } of gather(ctx, moves)) {
      const hit = def.hit
      const target = defender.get(Fighter)
      const from = placeOf(attacker)
      const at = placeOf(defender)
      if (hit === undefined || from === undefined || at === undefined || target.health <= 0) continue
      const stamp = { hitBy: attacker.sid, hitStamp: attacker.get(Fighter).moveStart }
      const forward = facingVector(from.facing)
      const landed = (kind: 'hit' | 'block' | 'parry') =>
        ctx.emit(HitLanded, { attacker: attacker.sid, target: defender.sid, kind, power: hit.power, ...at })

      const action = defender.has(HeroAction) ? defender.get(HeroAction) : undefined
      const facesIt = inArc(at.facing, angleOf(from.x - at.x, from.z - at.z), GUARD_HALF_ARC)
      // An Ash Knight's shield blocks a frontal hit while it neither attacks nor reels (DESIGN.md §8.2).
      const kind = defender.has(Enemy) ? enemyOf(defender.get(Enemy).kind) : undefined
      if (kind?.shield === true && target.state === CombatState.idle && facesIt && hit.unblockable !== true) {
        defender.set(Fighter, stamp)
        freeze = Math.max(freeze, BLOCK_FREEZE)
        landed('block')
        continue
      }
      if (action?.guard === true && facesIt && hit.low !== true && hit.unblockable !== true) {
        if (ctx.tick - action.guardSince < PARRY_FRAMES) {
          attacker.set(Fighter, {
            state: CombatState.stagger,
            stun: PARRY_STAGGER,
            move: 0,
            moveTick: 0,
            queued: 0,
          })
          defender.set(Fighter, stamp)
          freeze = Math.max(freeze, PARRY_FREEZE)
          landed('parry')
        } else {
          const push = pushOf(forward, BLOCK_PUSH)
          defender.set(Fighter, {
            ...stamp,
            state: CombatState.blockstun,
            stun: BLOCK_STUN,
            ...push,
            pushTicks: BLOCK_STUN,
          })
          // A blocked bite or dive stops short: the enemy reels back, its move over (DESIGN.md §8.2).
          if (def.lunge !== undefined)
            attacker.set(Fighter, {
              state: CombatState.stun,
              stun: BLOCK_STUN,
              move: 0,
              moveTick: 0,
              queued: 0,
            })
          freeze = Math.max(freeze, BLOCK_FREEZE)
          landed('block')
        }
        continue
      }

      const damage = target.state === CombatState.stagger ? hit.dmg * 2 : hit.dmg
      const health = Math.max(0, target.health - damage)
      const isHero = defender.has(Hero)
      const cancel = { move: 0, moveTick: 0, queued: 0 }
      freeze = Math.max(freeze, hit.stop)
      landed('hit')
      if (health === 0 && !isHero) {
        defender.set(Fighter, { ...stamp, ...cancel, health, state: CombatState.defeated })
        ctx.emit(FoeDefeated, { target: defender.sid })
        ctx.despawn(defender.sid)
        // A beaten enemy may leave something where it fell: one roll on the seeded table (DESIGN.md §8.1 rule 6).
        if (kind?.rank === 'captain') ctx.emit(CaptainDefeated, { target: defender.sid })
        const drop = kind === undefined || kind.rank !== undefined ? undefined : dropOf(ctx.rng.int(10))
        if (drop !== undefined) ctx.spawn([Drop, { x: at.x, z: at.z, ...drop }])
        continue
      }
      if (health === 0) {
        defender.set(Fighter, { ...stamp, ...cancel, health, state: CombatState.down, stun: KNOCKDOWN_TICKS })
        continue
      }
      // A hit on a hovering Wisp drops it to the floor, stunned (DESIGN.md §8.2: the sling's answer).
      const grounded = kind?.grounded !== undefined && target.lift > 0 ? kind.grounded : undefined
      if (grounded !== undefined) {
        defender.set(Fighter, {
          ...stamp,
          ...cancel,
          health,
          state: CombatState.stun,
          stun: grounded,
          lift: 0,
        })
        continue
      }
      // A power-3 hit knocks the defender down, then it rises (§7.2); any other hit stuns.
      const knocked = hit.power >= KNOCKDOWN_POWER
      const stun = isHero ? HURT_STUN : hit.stun
      defender.set(Fighter, {
        ...stamp,
        ...cancel,
        health,
        state: knocked ? CombatState.down : CombatState.stun,
        stun: knocked ? KNOCKDOWN_TICKS : stun,
        ...pushOf(forward, hit.kb),
        pushTicks: stun,
        ...(isHero && { iframes: HURT_IFRAMES }),
      })
    }
    const resource = ctx.resource(Freeze)
    resource.ticks = Math.max(resource.ticks, freeze)
  },
})
