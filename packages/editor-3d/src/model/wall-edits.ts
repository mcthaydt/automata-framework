// The wall edits (ED3D spec §5.4, ED3D.3 step 7): `wall.setKind`, `wall.setDoor`, `wall.setWindow`, `wall.setMaterial`,
// `wall.setOcclude` (ED3D.4b) and `wall.setFlags` (which also holds `wall.setHeight`: a door's height, a window's bottom and top, a handrail's and
// a mask's are members of those). A wall is the third member of the corner that starts it, so an edit rewrites one
// corner: `[x, z]` gets a third member only when the wall has something to say, and loses it when it has not.
// Solid, door and window change this side of a wall only; a portal is made on both (the reverse wall of the sector it
// leads into), and what the other side of a portal turned solid still says is the `openings` check's to name (ED3-e).
import { type DoorDef, OCCLUDES, type Occlude, type WindowDef } from '../format/sector.schema'
import type { LevelProfile } from '../profile/level-profile'
import type { EditCorner, EditSector, EditWall } from '../profile/sector-access'
import { type Edit, type EditResult, ok, refuse } from './edit'
import {
  isEmptyName,
  noSector,
  numberProblem,
  placed,
  positiveProblem,
  replaceSector,
  replaceSectors,
  round4,
  sectorOf,
} from './sector-edit-support'
import { cornerAt, loopOf, membersOf, PORTAL_MEMBERS, wallLength, wallOver } from './wall-geometry'

export interface WallRef {
  readonly sector: string
  /** The index of the corner that starts the wall, in the sector's outline. */
  readonly corner: number
}

/** A feature may reach this far past the end of a wall and still fit it (float noise in a length). */
const FIT_EPSILON = 1e-6

/** A patch that takes every member of a portal off a wall. */
const WITHOUT_PORTAL = Object.fromEntries(PORTAL_MEMBERS.map((member) => [member, null]))

/**
 * `target` with the members of `patch` set (a value), cleared (`null`) or left alone (`undefined`). A member is
 * changed when it is not strictly equal to the value; it is `target` itself when nothing changes, so that an edit
 * that changes nothing can tell. A member that is not written is never
 * written as `undefined`: the document has no such thing.
 */
function patchMembers<T extends object>(target: T, patch: Readonly<Record<string, unknown>>): T {
  const members = target as Readonly<Record<string, unknown>>
  let next: Record<string, unknown> | undefined
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    if (value === null ? !(key in members) : members[key] === value) continue
    next ??= { ...members }
    if (value === null) delete next[key]
    else next[key] = value
  }
  return (next ?? target) as T
}

/** What an edit knows of the wall it is about. */
interface Here<D> {
  readonly profile: LevelProfile<D>
  readonly level: D
  readonly sector: EditSector
  readonly corner: number
  /** The wall as written: nothing, a cutaway name (Last Light), or an object. */
  readonly wall: string | EditWall | undefined
  /** The wall's members: a name is the cutaway group it names. */
  readonly members: EditWall
  /** Its length in metres. */
  readonly length: number
}

/** Runs `change` on the wall `ref` names, or refuses when the sector or the wall is not there. */
function onWall<D>(ref: WallRef, change: (here: Here<D>) => EditResult<D>): Edit<D>['run'] {
  return (profile, level) => {
    const sector = sectorOf(profile, level, ref.sector)
    if (sector === undefined) return noSector(ref.sector)
    if (!Number.isInteger(ref.corner) || ref.corner < 0 || ref.corner >= sector.corners.length)
      return refuse(`sector ${ref.sector} has no wall ${ref.corner}`)
    const wall = cornerAt(sector.corners, ref.corner)[2]
    return change({
      profile,
      level,
      sector,
      corner: ref.corner,
      wall,
      members: membersOf(wall),
      length: wallLength(sector.corners, ref.corner),
    })
  }
}

/** The sector with the wall that starts at a corner of one of its loops written as `members`. */
function withWall(sector: EditSector, loop: number, corner: number, members: EditWall): EditSector {
  const wall = Object.keys(members).length === 0 ? undefined : members
  const write = (corners: readonly EditCorner[]): EditCorner[] =>
    corners.map((each, i) => (i === corner ? placed(each[0], each[1], wall) : each))
  if (loop === 0) return { ...sector, corners: write(sector.corners) }
  return { ...sector, holes: (sector.holes ?? []).map((hole, i) => (i === loop - 1 ? write(hole) : hole)) }
}

/** The level with this wall written as `next`, which is `here.members` itself for an edit that changed nothing. */
function writeWall<D>(here: Here<D>, next: EditWall): EditResult<D> {
  if (next === here.members) return ok(here.level)
  return replaceSector(here.profile, here.level, here.sector.id, withWall(here.sector, 0, here.corner, next))
}

/** The sector the wall's preset leads into, if it has one that does: taking `next` off the wall would not end that. */
const presetPortal = <D>(here: Here<D>): string | undefined =>
  here.profile.sectors.portalOf(here.level, { preset: here.members.preset })

export type WallKindArgs = WallRef &
  ({ readonly kind: 'solid' | 'door' | 'window' } | { readonly kind: 'portal'; readonly to: string })

const KIND_LABEL = { solid: 'solid', door: 'a door', window: 'a window' } as const

/** A door for a wall: centred, as wide as fits a short wall, and as tall as the room allows. */
function defaultDoor<D>(here: Here<D>): DoorDef {
  const height = here.sector.ceiling - here.sector.floor
  return {
    at: round4(here.length / 2),
    width: round4(Math.min(1.2, here.length / 2)),
    height: round4(Math.min(2.2, height - 0.3)),
  }
}

/** A window for a wall: centred, as wide as fits a short wall, from a quarter to two thirds up the room. */
function defaultWindow<D>(here: Here<D>): WindowDef {
  const height = here.sector.ceiling - here.sector.floor
  return {
    at: round4(here.length / 2),
    width: round4(Math.min(1.6, here.length / 2)),
    y0: round4(Math.min(1, height * 0.25)),
    y1: round4(Math.min(2.6, height * 0.65)),
  }
}

/** The portal on both sides: this wall, and the wall of `to` that runs back over the same segment. */
function makePortal<D>(here: Here<D>, to: string): EditResult<D> {
  const { profile, level, sector } = here
  if (to === sector.id) return refuse('a portal cannot lead into its own sector')
  const target = sectorOf(profile, level, to)
  if (target === undefined) return noSector(to)
  const over = wallOver(
    target,
    cornerAt(sector.corners, here.corner),
    cornerAt(sector.corners, here.corner + 1),
  )
  if (over === undefined) return refuse(`sector ${to} has no wall over the same segment`)
  const back = cornerAt(loopOf(target, over.loop), over.corner)
  const backTo = profile.sectors.portalOf(level, back[2])
  if (backTo !== undefined && backTo !== sector.id)
    return refuse(`the wall of ${to} over it already leads into ${backTo}`)
  // A door or a window is set into a solid wall, so a wall that becomes a portal loses it, on both sides.
  const ours = patchMembers(here.members, { next: to, door: null, window: null })
  const backMembers = membersOf(back[2])
  const theirs = patchMembers(backMembers, { next: sector.id, door: null, window: null })
  const changes = new Map<string, EditSector>()
  if (ours !== here.members) changes.set(sector.id, withWall(sector, 0, here.corner, ours))
  if (theirs !== backMembers) changes.set(to, withWall(target, over.loop, over.corner, theirs))
  return replaceSectors(profile, level, changes)
}

export function setWallKind<D>(args: WallKindArgs): Edit<D> {
  const label = args.kind === 'portal' ? `a portal into ${args.to}` : KIND_LABEL[args.kind]
  return {
    id: 'wall.setKind',
    label: `Make wall ${args.corner} of ${args.sector} ${label}`,
    run: onWall(args, (here) => {
      if (args.kind === 'portal') return makePortal(here, args.to)
      const preset = presetPortal(here)
      if (preset !== undefined)
        return refuse(
          `the wall takes its portal from the wall preset ${here.members.preset}, which this edit cannot take off`,
        )
      const feature =
        args.kind === 'door'
          ? { door: here.members.door ?? defaultDoor(here), window: null }
          : args.kind === 'window'
            ? { window: here.members.window ?? defaultWindow(here), door: null }
            : { door: null, window: null }
      return writeWall(here, patchMembers(here.members, { ...WITHOUT_PORTAL, ...feature }))
    }),
  }
}

/** Whether a feature of this width centred at `at` lies along a wall of this length. */
function fitProblem(what: string, at: number, width: number, length: number): string | undefined {
  const [start, end] = [at - width / 2, at + width / 2]
  return start >= -FIT_EPSILON && end <= length + FIT_EPSILON
    ? undefined
    : `the ${what} does not fit the wall: it must lie between 0 and ${round4(length)} m along it`
}

export interface DoorArgs extends WallRef {
  /** Where the door's centre is, in metres from the start of the wall. */
  readonly at?: number | undefined
  readonly width?: number | undefined
  readonly height?: number | undefined
  /** A name for the door: Last Light's door boxes and scripts point at it. `null` takes it off. */
  readonly id?: string | null | undefined
}

export function setDoor<D>(args: DoorArgs): Edit<D> {
  return {
    id: 'wall.setDoor',
    label: `Set the door of wall ${args.corner} of ${args.sector}`,
    coalesce: `door:${args.sector}/${args.corner}`,
    run: onWall(args, (here) => {
      if ([args.at, args.width, args.height, args.id].every((given) => given === undefined))
        return refuse('give a position, a width, a height or an id')
      const door = here.members.door
      if (door === undefined) return refuse('that wall has no door')
      const at = args.at === undefined ? door.at : round4(args.at)
      const width = args.width === undefined ? door.width : round4(args.width)
      const height = args.height === undefined ? door.height : round4(args.height)
      const problem =
        numberProblem('door position', at) ??
        positiveProblem('door width', width) ??
        positiveProblem('door height', height) ??
        (isEmptyName(args.id) ? 'a door id is a name, not empty' : undefined) ??
        fitProblem('door', at, width, here.length)
      if (problem !== undefined) return refuse(problem)
      const next = patchMembers(door, { at, width, height, id: args.id })
      return writeWall(here, patchMembers(here.members, { door: next }))
    }),
  }
}

export interface WindowArgs extends WallRef {
  /** Where the window's centre is, in metres from the start of the wall. */
  readonly at?: number | undefined
  readonly width?: number | undefined
  /** The bottom and the top of the window, in metres above the sector's floor. */
  readonly y0?: number | undefined
  readonly y1?: number | undefined
  /** How many bars; `null` takes them off. */
  readonly bars?: number | null | undefined
  /** Whether the moon shows in it; `null` takes the member off. */
  readonly moon?: boolean | null | undefined
}

export function setWindow<D>(args: WindowArgs): Edit<D> {
  return {
    id: 'wall.setWindow',
    label: `Set the window of wall ${args.corner} of ${args.sector}`,
    coalesce: `window:${args.sector}/${args.corner}`,
    run: onWall(args, (here) => {
      if ([args.at, args.width, args.y0, args.y1, args.bars, args.moon].every((given) => given === undefined))
        return refuse('give a position, a width, a bottom, a top, bars or the moon')
      const pane = here.members.window
      if (pane === undefined) return refuse('that wall has no window')
      const at = args.at === undefined ? pane.at : round4(args.at)
      const width = args.width === undefined ? pane.width : round4(args.width)
      const y0 = args.y0 === undefined ? pane.y0 : round4(args.y0)
      const y1 = args.y1 === undefined ? pane.y1 : round4(args.y1)
      const problem =
        numberProblem('window position', at) ??
        positiveProblem('window width', width) ??
        numberProblem('window bottom', y0) ??
        numberProblem('window top', y1) ??
        (typeof args.bars === 'number' ? positiveProblem('window bars', args.bars) : undefined) ??
        (y0 < y1 ? undefined : "the window's bottom must be under its top") ??
        fitProblem('window', at, width, here.length)
      if (problem !== undefined) return refuse(problem)
      const next = patchMembers(pane, { at, width, y0, y1, bars: args.bars, moon: args.moon })
      return writeWall(here, patchMembers(here.members, { window: next }))
    }),
  }
}

export function setWallMaterial<D>(args: WallRef & { readonly texture: string | null }): Edit<D> {
  return {
    id: 'wall.setMaterial',
    label: `Set the texture of wall ${args.corner} of ${args.sector}`,
    run: onWall(args, (here) => {
      if (isEmptyName(args.texture)) return refuse('a texture is a name, not empty')
      return writeWall(here, patchMembers(here.members, { texture: args.texture }))
    }),
  }
}

/**
 * What the angled camera does to the wall where it would cut it away (the 3D direction spec §4.2): `cut` takes it away,
 * `fade` draws it faintly and `never` keeps it; `null` takes the member off, which reads as `cut` for a wall. A Last Light
 * wall holds none of these, and the profile says so when the wall is written.
 */
export function setWallOcclude<D>(args: WallRef & { readonly occlude: Occlude | null }): Edit<D> {
  return {
    id: 'wall.setOcclude',
    label: `Set how wall ${args.corner} of ${args.sector} is cut away`,
    coalesce: `occlude:${args.sector}/${args.corner}`,
    run: onWall(args, (here) => {
      if (args.occlude !== null && !OCCLUDES.includes(args.occlude))
        return refuse('occlude is cut, fade or never')
      return writeWall(here, patchMembers(here.members, { occlude: args.occlude }))
    }),
  }
}

export interface WallFlagsArgs extends WallRef {
  /** The height of a handrail along the wall, in metres; `null` takes it off. */
  readonly handrail?: number | null | undefined
  /** Portal walls only: a door casing round the opening on this side. */
  readonly frame?: boolean | null | undefined
  /** Portal walls only: a masked wall in the opening, of glass or of bars. */
  readonly mask?: 'glass' | 'bars' | null | undefined
  /** Portal walls only: whether the mask blocks walking. */
  readonly block?: boolean | null | undefined
  /** Portal walls only: the top of the masked wall above the floor, in metres. */
  readonly maskTop?: number | null | undefined
}

/** Each member that belongs to a portal, with the sentence for setting it on a wall that is not one. */
const PORTAL_FLAGS = [
  ['frame', 'a frame is for a portal wall'],
  ['mask', 'a mask is for a portal wall'],
  ['block', 'blocking is for a portal wall'],
  ['maskTop', 'a mask height is for a portal wall'],
] as const

export function setWallFlags<D>(args: WallFlagsArgs): Edit<D> {
  return {
    id: 'wall.setFlags',
    label: `Set the flags of wall ${args.corner} of ${args.sector}`,
    coalesce: `flags:${args.sector}/${args.corner}`,
    run: onWall(args, (here) => {
      const { handrail, frame, mask, block, maskTop } = args
      if ([handrail, frame, mask, block, maskTop].every((given) => given === undefined))
        return refuse('give a flag to set')
      const problem =
        (typeof handrail === 'number' ? positiveProblem('handrail height', handrail) : undefined) ??
        (typeof maskTop === 'number' ? positiveProblem('mask height', maskTop) : undefined) ??
        (mask === undefined || mask === null || mask === 'glass' || mask === 'bars'
          ? undefined
          : 'a mask is glass or bars')
      if (problem !== undefined) return refuse(problem)
      const isPortal = here.profile.sectors.portalOf(here.level, here.wall) !== undefined
      for (const [member, sentence] of PORTAL_FLAGS)
        if (!isPortal && args[member] !== undefined && args[member] !== null) return refuse(sentence)
      const patch = {
        handrail: handrail === undefined || handrail === null ? handrail : round4(handrail),
        frame,
        mask,
        block,
        maskTop: maskTop === undefined || maskTop === null ? maskTop : round4(maskTop),
      }
      return writeWall(here, patchMembers(here.members, patch))
    }),
  }
}
