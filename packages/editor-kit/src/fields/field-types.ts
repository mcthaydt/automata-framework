// Typed fields and entity definitions (editor kit spec §4.8, EDK-D8).
//
// A definition says what a thing is and which typed fields it carries; an instance holds the values. Both
// editors store their own definitions and instances in their own formats and extend `EntityDef` by
// intersection (`EntityDef2D = EntityDef & { shape, size, pivot, … }`), so the kit never learns those facts.
//
// Optional properties accept an explicit `undefined` (`exactOptionalPropertyTypes` is on in this repo) so the zod
// schemas, whose output types say `T | undefined`, are assignable to these interfaces.

export type FieldType = 'int' | 'float' | 'bool' | 'text' | 'enum' | 'color' | 'angle' | 'ref' | 'point'

export const FIELD_TYPES: readonly FieldType[] = [
  'int',
  'float',
  'bool',
  'text',
  'enum',
  'color',
  'angle',
  'ref',
  'point',
]

/** A field id as an inspector shows it and a file stores it. */
export const FIELD_ID: RegExp = /^[A-Za-z][A-Za-z0-9_]*$/
/** An entity definition id. */
export const ENTITY_ID: RegExp = /^[a-z][a-z0-9-]*$/
/** A field's color value: `#rrggbb`, either case. */
export const HEX_COLOR: RegExp = /^#[0-9a-fA-F]{6}$/

export interface Point {
  readonly x: number
  readonly y: number
}

/** `target` and `container` are opaque to the kit: whether they resolve is the editor's check. */
export interface RefValue {
  readonly target: string
  /** The level or sector that holds the target. */
  readonly container?: string | undefined
}

export type FieldValue = number | boolean | string | Point | RefValue | readonly FieldValue[]

export type FieldValues = Readonly<Record<string, FieldValue>>

export interface FieldDef {
  readonly id: string
  readonly type: FieldType
  readonly label?: string | undefined
  /** An ordered array of this type (a patrol path is a list of points). */
  readonly list?: boolean | undefined
  /** No default stands in: an instance without a value is a `fieldMissing` problem. */
  readonly required?: boolean | undefined
  readonly default?: FieldValue | undefined
  /** `int` and `float`: inclusive bounds. */
  readonly min?: number | undefined
  readonly max?: number | undefined
  /** `int` and `float`: the stepper's increment (1 for an `int` without one). */
  readonly step?: number | undefined
  /** `enum`: non-empty and unique. */
  readonly options?: readonly string[] | undefined
  /** `text`: an editor shows a multi-line box. */
  readonly multiline?: boolean | undefined
  /** `ref`: what it may point at, as names the editor defines (entity definition ids, `$level`, `$sector`); empty or absent means any. */
  readonly to?: readonly string[] | undefined
}

export interface EntityDef {
  readonly id: string
  readonly label?: string | undefined
  /** A token name or `#rrggbb`. */
  readonly color?: string | undefined
  /** At most one instance per scope the editor names (2D: per level; 3D: per map). */
  readonly single?: boolean | undefined
  readonly fields: readonly FieldDef[]
}

export interface FieldProblem<Code extends string = string> {
  readonly code: Code
  readonly message: string
}

export type FieldValueCode =
  | 'wrongType'
  | 'notInteger'
  | 'belowMin'
  | 'aboveMax'
  | 'notAnOption'
  | 'badColor'
  | 'badRef'
  | 'badPoint'
  | 'badListItem'

/** `badListItem` carries the index of the first bad item and that item's own problem as `cause`. */
export interface FieldValueProblem extends FieldProblem<FieldValueCode> {
  readonly index?: number
  readonly cause?: FieldValueProblem
}

export type FieldDefCode =
  | 'badId'
  | 'badBounds'
  | 'badStep'
  | 'noOptions'
  | 'duplicateOption'
  | 'badDefault'
  | 'wrongTypeProperty'

export type EntityDefCode = FieldDefCode | 'badEntityId' | 'badEntityColor' | 'duplicateFieldId'

/** A problem with a definition; `fieldId` and `fieldIndex` (its place in `fields`) say which field when the problem is in one. */
export interface EntityDefProblem extends FieldProblem<EntityDefCode> {
  readonly fieldId?: string
  readonly fieldIndex?: number
}

export type InstanceCode = FieldValueCode | 'fieldMissing' | 'unknownField'

/** A problem with one value of an instance, found by `checkValues`. */
export interface InstanceProblem extends FieldProblem<InstanceCode> {
  readonly fieldId: string
  readonly index?: number
  readonly cause?: FieldValueProblem
}
