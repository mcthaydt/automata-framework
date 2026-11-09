// A file's identity in git: the SHA-1 of `blob <length>\0` followed by its bytes. GitHub names every file of a tree this
// way, so the page can tell what changed on either side without downloading anything.
export async function blobId(bytes: Uint8Array): Promise<string> {
  const header = new TextEncoder().encode(`blob ${String(bytes.length)}\0`)
  const whole = new Uint8Array(header.length + bytes.length)
  whole.set(header)
  whole.set(bytes, header.length)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', whole))
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')
}
