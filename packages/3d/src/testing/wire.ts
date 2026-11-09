// A painter's input or output carried from Node to a browser page and compared there: typed arrays and sets survive the
// trip as JSON, and a cell is reduced to one hash, so a page and Node can say they made the same bytes without sending them
// back. Tests only.

import type { PaintedCell } from '../features/figures/paint/paint-cell.ts'

const ARRAYS = {
  Float32Array,
  Int32Array,
  Int16Array,
  Uint8Array,
  Uint8ClampedArray,
  Uint16Array,
} as const
type ArrayName = keyof typeof ARRAYS

/** `value` as JSON text, its typed arrays as base64 and its sets as lists. Node only (it reads bytes with `Buffer`). */
export function toWire(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v instanceof Set) return { $set: [...v] }
    if (ArrayBuffer.isView(v)) {
      const bytes = new Uint8Array(v.buffer, v.byteOffset, v.byteLength)
      return { $array: v.constructor.name, base64: Buffer.from(bytes).toString('base64') }
    }
    return v
  })
}

/** What `toWire` wrote, as it was. Runs in a page and in Node. */
export function fromWire<T>(text: string): T {
  return JSON.parse(text, (_key, v: unknown) => {
    if (typeof v !== 'object' || v === null) return v
    const o = v as { $set?: unknown[]; $array?: ArrayName; base64?: string }
    if (o.$set !== undefined) return new Set(o.$set)
    if (o.$array !== undefined && o.base64 !== undefined) {
      const raw = atob(o.base64)
      const bytes = new Uint8Array(raw.length)
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
      return new ARRAYS[o.$array](bytes.buffer)
    }
    return v
  }) as T
}

const bytesOf = (view: ArrayBufferView): Uint8Array =>
  new Uint8Array(view.buffer, view.byteOffset, view.byteLength)

/** The SHA-256 of some bytes, in hex. */
export async function hashBytes(parts: readonly ArrayBufferView[]): Promise<string> {
  const views = parts.map(bytesOf)
  const all = new Uint8Array(views.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of views) {
    all.set(p, at)
    at += p.length
  }
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', all))
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** The hash of a cell's texels, normals, depth and materials. */
export const cellHash = (cell: PaintedCell): Promise<string> =>
  hashBytes([cell.colours, cell.normals, cell.depth, cell.material])
