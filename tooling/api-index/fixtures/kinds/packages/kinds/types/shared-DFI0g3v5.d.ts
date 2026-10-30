//#region src/shared.d.ts
/** Subtracts `b` from `a`. */
declare function subtract(a: number, b: number): number;
/** Doubles `by`; `.` exports it as `scale`. */
declare function internalScale(by: number): number;
//#endregion
export { subtract as n, internalScale as t };