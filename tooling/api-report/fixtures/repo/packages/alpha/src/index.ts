export { type Shape, shapeArea } from '@fx/beta'
export { default as Widget } from './widget.svelte'

/** Adds two numbers. */
export function add(a: number, b: number): number {
  return a + b
}

export interface Counter {
  readonly count: number
}

export const Counter: { readonly zero: Counter } = { zero: { count: 0 } }

export class Box {
  constructor(readonly size: number) {}

  grow(by: number): Box {
    return new Box(this.size + by)
  }
}

export type Id = string
