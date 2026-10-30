import { BodyKind, RigidBody2D, Transform2D } from '@mcthaydt/automata-physics/2d'
import { defineSystem, type EntityRef, type SimContext, type SystemDef } from '@mcthaydt/automata-sim'
import { type ContactFact, type ContactFloor, racerContacts } from './contacts'
import { courseBounds, deathLineY as deathLineOf } from './course.generator'
import { Floor } from './floor.component'
import { FloorLanded, LapCompleted, RaceFinished, RacerReset } from './race.event'
import { Race } from './race.resource'
import {
  advanceFloor,
  ascentComplete,
  credit,
  freshVisited,
  isHeld,
  spawnPoint,
  wrapSymmetric,
} from './race-rules'
import { HeldInput, Racer } from './racer.component'
import type { RaceTuning } from './tuning.schema'

// The race tick around the Rapier step, in FloorFifty's fixed order (`planck-simulation.ts`, 677d456):
//
//   prePhysics  1. inputs: the lap hold, the first-input bounce, steer, fast fall; 2. moving floors advanced and their
//               bodies steered onto them; the racers' velocities and kinds written for the step.
//   physics     3. one Rapier step (`physics2d`): integration and push-out.
//   postPhysics 4. positions read back, horizontal speed restored from input (a contact never takes it away);
//               5. contacts: bounce, landing, floor credit; 6. a moving floor's carry; 7. a held fast fall wins;
//               8. wrap, death line, manual reset; 9. laps, standings and the winner.
//
// The order is the rules: inputs before the step so a frame acts on the tick it arrives; floors before the step so a
// landing uses this tick's floor; the fast fall after the bounce so a held control wins; wrap and resets after both.

const physicsStep = (ctx: SimContext): boolean => ctx.resource(Race).phase === 'racing'

/** Racer state the step reads and writes as one record, then stores once. */
interface RacerTick {
  x: number
  y: number
  vx: number
  vy: number
  visited: string
  grounded: boolean
}

function respawn(tick: RacerTick, tuning: RaceTuning): void {
  const spawn = spawnPoint(tuning)
  tick.x = spawn.x
  tick.y = spawn.y
  tick.vx = 0
  // A respawn is mid-play, so it bounces at once.
  tick.vy = tuning.bounceVelocity
  tick.grounded = true
  tick.visited = freshVisited(tuning.floorCount)
}

function prePhysics(ctx: SimContext, tuning: RaceTuning): void {
  if (!physicsStep(ctx)) return
  for (const racer of ctx.query(Racer, HeldInput, RigidBody2D, Transform2D)) {
    const rules = racer.get(Racer)
    const held = racer.get(HeldInput)
    // Out of play: finished, held after a lap, or their seat left (FloorFifty freezes a gone racer where it was).
    if (rules.finishedAt >= 0 || !rules.connected || isHeld(rules, ctx.tick)) {
      standStill(racer)
      continue
    }
    let { vy } = racer.get(RigidBody2D)
    let { awaitingInput, holdUntil, facingRight } = rules
    // The hold ends: the racer bounces from the spawn on the release tick.
    if (holdUntil >= 0) {
      holdUntil = -1
      vy = tuning.bounceVelocity
    }
    // The first input of the race, whatever it asks for, starts the bounce.
    if (awaitingInput && (held.left || held.right || held.fastFall || rules.resetRequested)) {
      awaitingInput = false
      vy = tuning.bounceVelocity
    }
    if (awaitingInput) {
      standStill(racer)
      continue
    }
    const direction = (held.right ? 1 : 0) - (held.left ? 1 : 0)
    if (direction !== 0) facingRight = direction > 0
    // Horizontal speed is assigned outright every tick: releasing stops dead, in the air as on a floor.
    const vx = direction * tuning.moveSpeed
    if (held.fastFall) vy = tuning.fastFallVelocity
    // No fall is faster than the fast fall (8b-D9): a long free fall is clamped to it, so the schema's one-tick bound
    // covers every fall and none passes a floor. FloorFifty faulted at its speed bound instead; a clamp keeps a legal
    // long drop playable.
    vy = Math.max(vy, tuning.fastFallVelocity)
    racer.set(Racer, { awaitingInput, holdUntil, facingRight, enterVx: vx, enterVy: vy })
    // A racer never tips (FloorFifty's fixedRotation): RigidBody2D has no rotation lock, so the pose is upright and
    // the spin zero going into every step (8b-D2).
    racer.set(RigidBody2D, { kind: BodyKind.dynamic, vx, vy, angvel: 0 })
    if (racer.get(Transform2D).rotation !== 0) racer.set(Transform2D, { rotation: 0 })
  }
  const bounds = courseBounds(tuning)
  for (const floor of ctx.query(Floor, RigidBody2D, Transform2D)) {
    const rules = floor.get(Floor)
    if (!rules.moving) continue
    const next = advanceFloor(rules, bounds, ctx.dt)
    floor.set(Floor, { x: next.x, direction: next.direction, shift: next.x - rules.x })
    // A kinematic body moves by velocity, so the velocity is solved back from where the rules put the floor: one
    // answer to where a floor is, and a real velocity for the contact rules to read.
    floor.set(RigidBody2D, { vx: (next.x - floor.get(Transform2D).x) / ctx.dt })
  }
}

/** Out of the step: a kinematic body at rest, which neither falls nor is pushed (FloorFifty's inactive body). */
function standStill(racer: EntityRef): void {
  racer.set(RigidBody2D, { kind: BodyKind.kinematicPosition, vx: 0, vy: 0, angvel: 0 })
}

function floorsNow(
  ctx: SimContext,
): Array<ContactFloor & { readonly moving: boolean; readonly shift: number }> {
  return ctx.query(Floor, Transform2D).map((floor) => {
    const rules = floor.get(Floor)
    const at = floor.get(Transform2D)
    const vx = floor.has(RigidBody2D) ? floor.get(RigidBody2D).vx : 0
    return { index: rules.index, x: at.x, y: at.y, vx, moving: rules.moving, shift: rules.shift }
  })
}

function postPhysics(ctx: SimContext, tuning: RaceTuning): void {
  if (!physicsStep(ctx)) return
  const floors = floorsNow(ctx)
  const sizes = {
    racerHalfWidth: tuning.racerWidth / 2,
    racerHalfHeight: tuning.racerHeight / 2,
    floorHalfWidth: tuning.floorWidth / 2,
    floorHalfHeight: tuning.floorHeight / 2,
  }
  const deathLineY = deathLineOf(tuning)
  for (const racer of ctx.query(Racer, HeldInput, RigidBody2D, Transform2D)) {
    const rules = racer.get(Racer)
    // Only a racer the step moved resolves contacts; a request from one that did not is dropped (a held racer's
    // reset is not taken).
    if (racer.get(RigidBody2D).kind !== BodyKind.dynamic) {
      if (rules.resetRequested) racer.set(Racer, { resetRequested: false })
      continue
    }
    const at = racer.get(Transform2D)
    const tick: RacerTick = {
      x: at.x,
      y: at.y,
      vx: rules.enterVx,
      vy: racer.get(RigidBody2D).vy,
      visited: rules.visited,
      grounded: false,
    }
    // A top counts unless the racer is already leaving it at half the bounce speed (FloorFifty's `leavingTop`).
    const entering = { x: at.x, y: at.y, vx: rules.enterVx, vy: rules.enterVy }
    const facts = racerContacts(entering, floors, sizes, tuning.bounceVelocity / 2)
    applyContacts(ctx, rules.seat, tick, facts, tuning)
    applyCarry(tick, facts, floors, tuning)
    if (racer.get(HeldInput).fastFall) tick.vy = tuning.fastFallVelocity
    tick.x = wrapSymmetric(tick.x, tuning.viewportWidth / 2)
    const fell = tick.y < deathLineY
    if (rules.resetRequested || fell) {
      respawn(tick, tuning)
      ctx.emit(RacerReset, { seat: rules.seat, reason: rules.resetRequested ? 'manual' : 'fall' })
    }
    racer.set(Transform2D, { x: tick.x, y: tick.y, rotation: 0 })
    racer.set(RigidBody2D, { vx: tick.vx, vy: tick.vy })
    racer.set(Racer, { visited: tick.visited, grounded: tick.grounded, resetRequested: false })
  }
  resolveLaps(ctx, tuning)
}

/**
 * What the contacts mean (FloorFifty's `applyContactConsequences`): any solid face lifts the racer at bounce speed,
 * which makes a side a wall to ride and an underside a ceiling to hang from; a top grounds and credits; the foot band
 * credits. A floor is credited once per ascent.
 */
function applyContacts(
  ctx: SimContext,
  seat: number,
  tick: RacerTick,
  facts: readonly ContactFact[],
  tuning: RaceTuning,
): void {
  for (const fact of facts) {
    if (fact.kind !== 'foot') tick.vy = tuning.bounceVelocity
    if (fact.kind === 'top') tick.grounded = true
    if (fact.kind === 'top' || fact.kind === 'foot') {
      const visited = credit(tick.visited, fact.floor)
      if (visited !== tick.visited) ctx.emit(FloorLanded, { seat, floor: fact.floor })
      tick.visited = visited
    }
  }
}

/**
 * A racer on top of a moving floor moves with it by the floor's travel this tick, once, by the first such contact
 * (facts are sorted by floor). Position only: nothing is added to the speed, so leaving keeps none of the floor's.
 */
function applyCarry(
  tick: RacerTick,
  facts: readonly ContactFact[],
  floors: ReadonlyArray<{ readonly index: number; readonly moving: boolean; readonly shift: number }>,
  tuning: RaceTuning,
): void {
  for (const fact of facts) {
    if (fact.kind !== 'top') continue
    const floor = floors.find((f) => f.index === fact.floor)
    if (!floor?.moving) continue
    tick.x += floor.shift * tuning.movingFloorCarry
    return
  }
}

/**
 * Laps and the result (FloorFifty's `resolveLapAndWinner`, race mode). Completing an ascent short of the last lap
 * respawns the racer and holds them at the spawn; completing the last finishes the race, in the same tick for
 * everyone who completes it, so two racers finishing together still get one order (seat order).
 */
function resolveLaps(ctx: SimContext, tuning: RaceTuning): void {
  const race = ctx.resource(Race)
  for (const racer of ctx.query(Racer, RigidBody2D, Transform2D)) {
    const rules = racer.get(Racer)
    if (rules.finishedAt >= 0 || !rules.connected || !ascentComplete(rules.visited)) continue
    if (rules.lap < tuning.lapCount) {
      ctx.emit(LapCompleted, { seat: rules.seat, lap: rules.lap })
      const spawn = spawnPoint(tuning)
      racer.set(Transform2D, { x: spawn.x, y: spawn.y, rotation: 0 })
      racer.set(Racer, {
        lap: rules.lap + 1,
        visited: freshVisited(tuning.floorCount),
        // A respawn stands on the start floor (FloorFifty's respawnPlayer).
        grounded: true,
        holdUntil: tuning.lapHoldTicks > 0 ? ctx.tick + tuning.lapHoldTicks : -1,
      })
      if (tuning.lapHoldTicks > 0) racer.set(RigidBody2D, { vx: 0, vy: 0 })
      else racer.set(RigidBody2D, { vx: 0, vy: tuning.bounceVelocity })
      continue
    }
    racer.set(Racer, { finishedAt: ctx.tick - race.startedAt })
    race.standings.push(rules.seat)
    if (race.winner < 0) {
      race.winner = rules.seat
      ctx.emit(RaceFinished, { winner: rules.seat })
    }
    race.phase = 'finished'
  }
  if (race.phase === 'finished') freeze(ctx)
}

/** A finished race moves nothing: every racer and floor comes to rest where it is. */
function freeze(ctx: SimContext): void {
  for (const racer of ctx.query(Racer, RigidBody2D)) standStill(racer)
  for (const floor of ctx.query(Floor, RigidBody2D)) floor.set(RigidBody2D, { vx: 0 })
}

/** The steps before Rapier's: inputs, moving floors, the racers' velocities and body kinds. */
export function racePreStepSystem(tuning: RaceTuning): SystemDef {
  return defineSystem({
    name: 'party-racer.pre-step',
    phase: 'prePhysics',
    before: ['physics2d.sync-in'],
    run: (ctx) => prePhysics(ctx, tuning),
  })
}

/** The steps after Rapier's: contacts, carry, fast fall, wrap, deaths, resets, laps and the result. */
export function racePostStepSystem(tuning: RaceTuning): SystemDef {
  return defineSystem({
    name: 'party-racer.post-step',
    phase: 'postPhysics',
    after: ['physics2d.events'],
    run: (ctx) => postPhysics(ctx, tuning),
  })
}
