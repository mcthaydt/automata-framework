// The dungeon pieces of GAME-3D.1f part 4 (DESIGN.md §10): chests and what they give, pots and cracked walls that
// break. The one-way gate, the ledge drop, the npc, the shop and heart pieces were cut by the 2026-10-31 rescope
// (DESIGN.md §0.4). Sim code.
import { defineSystem, type SimContext, type SpawnPart, type SystemDef } from '@mcthaydt/automata-sim'
import { Breakable, Chest, Door, Drop, Fighter, Hero, HeroControl, Switch, Target } from '../components.ts'
import { dropOf } from '../constants/enemies.ts'
import { ACTION_BITS, BREAKABLE } from '../constants/index.ts'
import { BOMBS, ItemCode, SLING } from '../constants/items.ts'
import { ChestOpened, PieceBroke } from '../events.ts'
import { Dungeon, Freeze, Inventory, Location, Progress } from '../resources.ts'
import { type Area, type AreaEntity, areaIn, type PlanBox } from './area.ts'
import { addFlag, boxOf, flagOf, heroBox, inReach, inside, overlaps } from './dungeon-common.ts'

/** A pot's or a cracked wall's parts: a wall with a hurt cylinder from the floor, on the foes' side. */
function breakableParts(entity: AreaEntity, index: number): SpawnPart[] {
  const box = boxOf(entity)
  const radius = Math.max(Math.trunc((box.maxX - box.minX) / 2), Math.trunc((box.maxZ - box.minZ) / 2))
  const height = entity.def === 'pot' ? BREAKABLE.potHeight : BREAKABLE.crackedHeight
  return [
    [Target, { x: entity.x, z: entity.z, facing: 0 }],
    [Fighter, { side: 1, health: BREAKABLE.health, radius, height }],
    [Breakable, { piece: index + 1, ...box }],
  ]
}

/**
 * The part-4 pieces an area starts with (`spawnPieces` adds them): each chest, hidden until `dungeon.pieces` shows it;
 * and each pot and cracked wall standing.
 */
export function pieceParts(entity: AreaEntity, index: number): SpawnPart[][] {
  const piece = index + 1
  if (entity.def === 'chest') return [[[Chest, { piece, shown: false, open: false, ...boxOf(entity) }]]]
  if (entity.def === 'pot' || entity.def === 'cracked') return [breakableParts(entity, index)]
  return []
}

/** Whether the entity `id` names is on or open: a switch on, a door open, or its flag saved (§10's `hidden`). */
function holds(ctx: SimContext, area: Area, id: string): boolean {
  const piece = area.entities.findIndex((entity) => entity.id === id) + 1
  if (piece === 0) return false
  const def = area.entities[piece - 1] as AreaEntity
  if (ctx.resource(Dungeon).flags.includes(flagOf(area, def))) return true
  if (ctx.query(Switch).some((entity) => entity.get(Switch).piece === piece && entity.get(Switch).on))
    return true
  return ctx.query(Door).some((entity) => entity.get(Door).piece === piece && entity.get(Door).open)
}

/**
 * Gives what a chest holds (§10): a key, the map or the compass into the dungeon; embers into the run; an item owned
 * with a full bag, and on the Item button when nothing is.
 */
function give(ctx: SimContext, contents: string): void {
  const dungeon = ctx.resource(Dungeon)
  const inventory = ctx.resource(Inventory)
  if (contents === 'small-key') dungeon.smallKeys += 1
  else if (contents === 'boss-key') dungeon.bossKey = true
  else if (contents === 'map') dungeon.map = true
  else if (contents === 'compass') dungeon.compass = true
  else if (contents.startsWith('embers:'))
    ctx.resource(Progress).embers += Number.parseInt(contents.slice('embers:'.length), 10)
  else if (contents === 'sling' || contents === 'bombs' || contents === 'hookchain') {
    inventory[contents] = true
    if (contents === 'sling') inventory.pellets = SLING.maxPellets
    if (contents === 'bombs') inventory.bombAmmo = BOMBS.max
    if (inventory.equipped === 0) inventory.equipped = ItemCode[contents]
  }
}

/**
 * The pieces a press or the save answers (DESIGN.md §10): a cracked wall the save has broken goes; a chest shows once
 * it has no `hidden` ref or its ref holds, opens from the save, or opens with a pick-up press beside it, giving its
 * contents once (saved, announced with what it held). Runs after the doors and switches, so a chest they reveal shows on the same tick.
 */
export const dungeonPieces: SystemDef = defineSystem({
  name: 'dungeon.pieces',
  phase: 'prePhysics',
  after: ['dungeon.doors'],
  run(ctx) {
    if (ctx.resource(Freeze).active) return
    const area = areaIn(ctx.content, ctx.resource(Location))
    const dungeon = ctx.resource(Dungeon)
    const wick = ctx.query(Hero, HeroControl)[0]
    const pressed = wick !== undefined && (wick.get(HeroControl).actPressed & ACTION_BITS.pickup) !== 0
    const { x, z } = wick?.get(Hero) ?? { x: 0, z: 0 }
    for (const entity of ctx.query(Breakable)) {
      const def = area.entities[entity.get(Breakable).piece - 1]
      if (def?.def === 'cracked' && dungeon.flags.includes(flagOf(area, def))) ctx.despawn(entity.sid)
    }
    for (const entity of ctx.query(Chest)) {
      const chest = entity.get(Chest)
      const def = area.entities[chest.piece - 1]
      if (def === undefined) continue
      const flag = flagOf(area, def)
      let open = chest.open || dungeon.flags.includes(flag)
      const shown = chest.shown || open || def.hidden === undefined || holds(ctx, area, def.hidden as string)
      if (shown && !open && pressed && inReach(chest, x, z)) {
        open = true
        addFlag(dungeon.flags, flag)
        give(ctx, def.contents as string)
        ctx.emit(ChestOpened, { piece: chest.piece, contents: def.contents as string })
      }
      if (shown !== chest.shown || open !== chest.open) entity.set(Chest, { shown, open })
    }
  },
})

/**
 * A hit on a pot or a cracked wall (combat's rule, §10): a pot breaks on any hit and rolls the drop table where it
 * stood; a cracked wall breaks only on a bomb's blast, for good (saved). Whatever breaks is announced and goes.
 */
export function breakableHit(
  ctx: SimContext,
  sid: number,
  piece: number,
  at: { readonly x: number; readonly z: number },
  blast: boolean,
): void {
  const area = areaIn(ctx.content, ctx.resource(Location))
  const def = area.entities[piece - 1]
  if (def === undefined || (def.def === 'cracked' && !blast)) return
  ctx.despawn(sid)
  ctx.emit(PieceBroke, { piece })
  if (def.def === 'cracked') {
    addFlag(ctx.resource(Dungeon).flags, flagOf(area, def))
    return
  }
  const drop = dropOf(ctx.rng.int(10), ctx.resource(Inventory))
  if (drop !== undefined) ctx.spawn([Drop, { x: at.x, z: at.z, ...drop }])
}

/** As Wick comes into `room` (§10), its broken pots stand again, except one that would stand on him. */
export function resetPots(ctx: SimContext, area: Area, room: PlanBox): void {
  const standing = ctx.query(Breakable).map((entity) => entity.get(Breakable).piece)
  const { x, z } = ctx.query(Hero)[0]?.get(Hero) ?? { x: 0, z: 0 }
  area.entities.forEach((entity, index) => {
    if (entity.def !== 'pot' || standing.includes(index + 1) || !inside(room, entity.x, entity.z)) return
    if (overlaps(heroBox(x, z), boxOf(entity))) return
    ctx.spawn(...breakableParts(entity, index))
  })
}
