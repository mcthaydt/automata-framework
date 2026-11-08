// Every declaration kind both API tools read. tooling/api-index/fixtures/kinds holds the .d.ts
// tsdown emits for `.` and `./extra`, so the two pinned outputs describe one API.
export * as helpers from './helpers.ts'
export { internalScale as scale, subtract } from './shared.ts'
export * from './star.ts'

/**
 * Adds two numbers.
 * @param a the first
 * @returns the sum
 */
export function add(a: number, b: number): number
/** Adds two strings. */
export function add(a: string, b: string): string
export function add(a: number | string, b: number | string): number | string {
  return typeof a === 'number' && typeof b === 'number' ? a + b : `${a}${b}`
}

/**
 * A counter.
 * @deprecated use `add`
 */
export class Counter {
  count: number = 0

  constructor(readonly step: number) {}

  increment(): Counter {
    this.count += this.step
    return this
  }
}

/** A thing with a name. */
export interface Named {
  readonly name: string
}

/** The sizes a box comes in. */
export type Size = 'small' | 'large'

/** Colors. */
export enum Color {
  Red = 0,
  Blue = 1,
}

/** The default size. */
export const DEFAULT_SIZE: Size = 'small'

/** A count that changes. */
// biome-ignore lint/style/useConst: the fixture pins how a `let` export reads
export let liveCount: number = 0

/** A name declared the old way. */
export var legacyName: string = 'kinds'

/** Geometry helpers. */
export namespace Geometry {
  /** The unit length. */
  export const unit: number = 1
}

/** A point. */
export interface Point {
  readonly x: number
  readonly y: number
}

/** The origin, merged with the interface. */
export const Point: { readonly origin: Point } = { origin: { x: 0, y: 0 } }

/** Exported under another name. */
const hidden: number = 3

export { hidden as visible }

/** Greets: the module's default export, declared under its own name. */
export default function greet(): string {
  return 'hello'
}
