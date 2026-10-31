// The lock (DESIGN.md §11): the target picked, cycled, held or let go, and the heading assist while locked.
import { CameraHeading, wrapHeading } from '@mcthaydt/automata-render-pixi3d/sim'
import { defineSystem, type SystemDef } from '@mcthaydt/automata-sim'
import { Hero, HeroControl, Target } from '../components.ts'
import { LOCK_ASSIST_LIMIT, LOCK_ASSIST_PER_TICK, LOCK_BREAK, LOCK_HIDDEN_TICKS } from '../constants/index.ts'
import { Location } from '../resources.ts'
import { type Area, areaIn } from './area.ts'
import { frozen } from './combat.ts'
import {
  angleOf,
  cycleLock,
  type LockPoint,
  lineOfSight,
  lockCandidates,
  selectLock,
  signedTurn,
} from './lock-target.ts'
import { wallsOf } from './walls.ts'

/** Whether the room's view lets the camera turn: what `camera-heading.rotate` goes back to once the lock lets go. */
const viewTurns = (area: Area, view: string): boolean | undefined =>
  area.views.find((candidate) => candidate.id === view)?.rotate

/**
 * Holds Wick's lock (DESIGN.md §11.1, §11.2). A press with nothing locked picks a target (`selectLock`); with none
 * in reach it recentres the heading on his facing, in a view that turns. The lock lets go on the player's release
 * (hold mode) or next press (toggle mode), when the target is gone or past 15 m, or after 60 ticks running out of
 * sight. A `lock-cycle` while locked moves it to the next candidate around him. While locked, `rotate` is off, so
 * render-pixi3d's `camera.turn` ignores the player's turns: the assist owns the heading.
 */
export const lockSelect: SystemDef = defineSystem({
  name: 'lock.select',
  phase: 'prePhysics',
  run(ctx) {
    if (frozen(ctx)) return
    const area = areaIn(ctx.content, ctx.resource(Location))
    const walls = wallsOf(ctx)
    const targets: LockPoint[] = ctx
      .query(Target)
      .map((entity) => ({ id: entity.sid, ...entity.get(Target) }))
    for (const entity of ctx.query(Hero, HeroControl, CameraHeading)) {
      const hero = entity.get(Hero)
      const control = entity.get(HeroControl)
      const heading = entity.get(CameraHeading)
      let { lockTarget, lockHidden } = hero
      let units = heading.heading
      const held = targets.find((target) => target.id === lockTarget)
      if (lockTarget !== 0) {
        const letGo = control.lockHold ? !control.lockHeld : control.lockPressed
        const dx = (held?.x ?? 0) - hero.x
        const dz = (held?.z ?? 0) - hero.z
        lockHidden = held !== undefined && !lineOfSight(walls, hero, held) ? lockHidden + 1 : 0
        if (
          letGo ||
          held === undefined ||
          dx * dx + dz * dz > LOCK_BREAK * LOCK_BREAK ||
          lockHidden >= LOCK_HIDDEN_TICKS
        )
          lockTarget = 0
      } else if (control.lockPressed) {
        lockTarget = selectLock(lockCandidates(walls, hero, targets), hero, units)
        if (lockTarget === 0 && viewTurns(area, heading.view) === true) units = hero.facing
      }
      const current = targets.find((target) => target.id === lockTarget)
      if (current !== undefined && control.lockCycle !== 0) {
        const dir = control.lockCycle > 0 ? 1 : -1
        const next = cycleLock(lockCandidates(walls, hero, targets), hero, current, dir)
        if (next !== 0) lockTarget = next
      }
      if (lockTarget === 0) lockHidden = 0
      if (lockTarget !== hero.lockTarget || lockHidden !== hero.lockHidden)
        entity.set(Hero, { lockTarget, lockHidden })
      const rotate = lockTarget !== 0 ? false : (viewTurns(area, heading.view) ?? heading.rotate)
      if (rotate !== heading.rotate || units !== heading.heading)
        entity.set(CameraHeading, { heading: units, rotate })
    }
  },
})

/**
 * The lock heading assist (DESIGN.md §11.2, GAME3D-D5): while locked in a view that turns, a target more than 45°
 * off the heading as seen from Wick turns the heading toward it by up to 546 units a tick, stopping at 45°. Integer
 * and in the golden; it never touches the stick's latch (only a view change latches, M3R-D15).
 */
export const lockAssist: SystemDef = defineSystem({
  name: 'lock.assist',
  phase: 'prePhysics',
  run(ctx) {
    if (frozen(ctx)) return
    const area = areaIn(ctx.content, ctx.resource(Location))
    for (const entity of ctx.query(Hero, CameraHeading)) {
      const hero = entity.get(Hero)
      const heading = entity.get(CameraHeading)
      const target = hero.lockTarget === 0 ? undefined : ctx.entity(hero.lockTarget)?.get(Target)
      if (target === undefined || viewTurns(area, heading.view) !== true) continue
      if (target.x === hero.x && target.z === hero.z) continue
      const off = signedTurn(angleOf(target.x - hero.x, target.z - hero.z) - heading.heading)
      const beyond = Math.abs(off) - LOCK_ASSIST_LIMIT
      if (beyond <= 0) continue
      const by = Math.min(LOCK_ASSIST_PER_TICK, beyond) * Math.sign(off)
      entity.set(CameraHeading, { heading: wrapHeading(heading.heading + by) })
    }
  },
})
