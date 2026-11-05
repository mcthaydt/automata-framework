// Replaces Effect's tagged failures. A host that says no is an ordinary answer, so it comes back as a value the
// caller must look at (`if (!result.ok)`); a bug in our own code throws an `Error` with a plain message.

export type Result<T, R = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: R }

export function ok<T>(value: T): { readonly ok: true; readonly value: T } {
  return { ok: true, value }
}

export function refused<R>(reason: R): { readonly ok: false; readonly reason: R } {
  return { ok: false, reason }
}
