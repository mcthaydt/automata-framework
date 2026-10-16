import { n as area, t as ShapeKind } from './chunk-a1.js';
/**
 * Adds two numbers.
 * @param a the first
 * @returns the sum
 */
export declare function add(a: number, b: number): number;
/** Adds two strings. */
export declare function add(a: string, b: string): string;
/** A thing with a name. */
export interface Named {
    readonly name: string;
}
/** The sizes a box comes in. */
export type Size = 'small' | 'large';
/** The default size. */
export declare const DEFAULT_SIZE: Size;
/**
 * A counter.
 * @deprecated use `add`
 */
export declare class Counter {
    count: number;
}
/** Colors. */
export declare enum Color {
    Red = 0,
    Blue = 1
}
export declare const undocumented: number;
export { area, ShapeKind };
