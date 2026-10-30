import { n as subtract, t as internalScale } from "./shared-DFI0g3v5.js";
declare namespace helpers_d_exports {
  export { help };
}
/** A helper, reached through `export * as helpers`. */
declare function help(): string;
//#endregion
//#region src/star.d.ts
/** Reached through `export *`. */
export declare function starred(): void;
//#endregion
//#region src/index.d.ts
/**
 * Adds two numbers.
 * @param a the first
 * @returns the sum
 */
export declare function add(a: number, b: number): number;
/** Adds two strings. */
export declare function add(a: string, b: string): string;
/**
 * A counter.
 * @deprecated use `add`
 */
export declare class Counter {
  readonly step: number;
  count: number;
  constructor(step: number);
  increment(): Counter;
}
/** A thing with a name. */
export interface Named {
  readonly name: string;
}
/** The sizes a box comes in. */
export type Size = "small" | "large";
/** Colors. */
export declare enum Color {
  Red = 0,
  Blue = 1
}
/** The default size. */
export declare const DEFAULT_SIZE: Size;
/** A count that changes. */
export declare let liveCount: number;
/** A name declared the old way. */
export declare var legacyName: string;
/** Geometry helpers. */
export declare namespace Geometry {
  const unit: number;
}
/** A point. */
export interface Point {
  readonly x: number;
  readonly y: number;
}
/** The origin, merged with the interface. */
export declare const Point: {
  readonly origin: Point;
};
/** Exported under another name. */
declare const hidden: number;
/** Greets: the module's default export, declared under its own name. */
export default function greet(): string;
//#endregion
export { helpers_d_exports as helpers, internalScale as scale, subtract, hidden as visible };