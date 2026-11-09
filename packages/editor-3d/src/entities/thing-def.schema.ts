// What a thing is in a level (ED3D spec §4.7): the kit's entity definition (`id`, `label`, `color`, `single`, typed
// `fields`) plus the facts the 3D editor adds, which are where it is drawn (`shape`), how big a box is (`size`), what
// it stands on (`sit`) and the rectangle it bounds (`area`). The kit's keys come from its `entityDefShape` and its rules
// from `entityDefIssues`, so nothing here copies them; the rules below are the 3D editor's own. Like the rest of the
// format the schema keeps a member it does not know.
import {
  type EntityDef,
  entityDefIssues,
  entityDefShape,
} from '@automataframework/automata-editor/kit/fields'
import { z } from 'zod'

export const THING_SHAPES: readonly ['point', 'box'] = ['point', 'box']
export type ThingShape = (typeof THING_SHAPES)[number]

/** `floor`: the thing rests on its sector's floor. `free`: it floats at its own `y`. */
export const THING_SITS: readonly ['floor', 'free'] = ['floor', 'free']
export type ThingSit = (typeof THING_SITS)[number]

/** An instance stores its field values beside its place, so a field may not take one of these names. */
export const RESERVED_FIELD_IDS: readonly ['def', 'id', 'x', 'y', 'z'] = ['def', 'id', 'x', 'y', 'z']

export interface ThingDef extends EntityDef {
  readonly shape: ThingShape
  /** A box's width, height and depth in metres; a box without one is sized by each instance's `w`, `h` and `d`. */
  readonly size?: readonly [number, number, number] | undefined
  /** Default `floor`. */
  readonly sit?: ThingSit | undefined
  /**
   * Four float fields that bound a rectangle of the plan, as its `x0`, `z0`, `x1` and `z1` (ED3D.7c: Last Light's camera
   * zone): a drag on the plan sets them, and a side without a value is open.
   */
  readonly area?: readonly [string, string, string, string] | undefined
}

interface DefIssue {
  readonly message: string
  readonly path: (string | number)[]
}

/** The size fields a box without a `size` is measured by. */
const BOX_FIELDS = ['w', 'h', 'd']

function thingDefIssues(def: ThingDef): DefIssue[] {
  const issues: DefIssue[] = []
  if (def.size !== undefined) {
    if (def.shape === 'point') issues.push({ message: `a point has no size`, path: ['size'] })
    else if (def.size.some((side) => !(side > 0)))
      issues.push({
        message: `size is three numbers above zero (width, height, depth)`,
        path: ['size'],
      })
  }
  const sized = BOX_FIELDS.every((id) =>
    def.fields.some((field) => field.id === id && field.type === 'float'),
  )
  if (def.shape === 'box' && def.size === undefined && !sized)
    issues.push({
      message: `a box has a size, or float fields w, h and d that give each box its own`,
      path: ['shape'],
    })
  if (def.area !== undefined) {
    const floats = new Set(def.fields.filter((field) => field.type === 'float').map((field) => field.id))
    if (new Set(def.area).size !== 4 || !def.area.every((id) => floats.has(id)))
      issues.push({
        message: `area names four different float fields of the definition: the x0, z0, x1 and z1 of a rectangle`,
        path: ['area'],
      })
  }
  for (const [index, field] of def.fields.entries()) {
    if ((RESERVED_FIELD_IDS as readonly string[]).includes(field.id))
      issues.push({
        message: `field ${field.id} is taken: a thing keeps def, id, x, y and z for itself`,
        path: ['fields', index, 'id'],
      })
    if (field.type === 'point')
      issues.push({
        message: `field ${field.id} is a point, and the plan has x and z: use two float fields`,
        path: ['fields', index, 'type'],
      })
  }
  return issues
}

export const thingDefSchema: z.ZodType<ThingDef> = z
  .looseObject({
    ...entityDefShape,
    shape: z.enum(THING_SHAPES),
    size: z.tuple([z.number(), z.number(), z.number()]).optional(),
    sit: z.enum(THING_SITS).optional(),
    area: z.tuple([z.string(), z.string(), z.string(), z.string()]).optional(),
  })
  .superRefine((def, context) => {
    for (const issue of [...entityDefIssues(def), ...thingDefIssues(def)])
      context.addIssue({ code: 'custom', ...issue })
  })
