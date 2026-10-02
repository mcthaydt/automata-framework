export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Little-endian Float64 bytes, written explicitly so platform endianness can never matter. */
export function f64Bytes(values: ArrayLike<number>): Uint8Array {
  const view = new DataView(new ArrayBuffer(values.length * 8))
  for (let i = 0; i < values.length; i++) view.setFloat64(i * 8, values[i] as number, true)
  return new Uint8Array(view.buffer)
}
