// Seals a short text into a cookie value: AES-GCM with Web Crypto, a fresh 12-byte iv for every seal, and the moment it
// stops being good inside what is sealed, so a copy of the cookie can't outlive it. The key is 32 random bytes in
// base64 that only the host holds; whoever has the cookie can't read it.
const IV_BYTES = 12

const bytesOf = (text: string): Uint8Array<ArrayBuffer> =>
  new TextEncoder().encode(text) as Uint8Array<ArrayBuffer>

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64url(text: string): Uint8Array<ArrayBuffer> | undefined {
  try {
    const padded = text
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(text.length / 4) * 4, '=')
    const binary = atob(padded)
    return Uint8Array.from(binary, (char) => char.charCodeAt(0))
  } catch {
    return undefined
  }
}

async function importKey(key: string): Promise<CryptoKey | undefined> {
  try {
    const raw = Uint8Array.from(atob(key), (char) => char.charCodeAt(0))
    if (raw.length !== 32) return undefined
    return await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
  } catch {
    return undefined
  }
}

/** `random` is injected so a test is exact; the host's own is `crypto.getRandomValues`. */
export async function seal(
  key: string,
  value: string,
  expiresAt: number,
  random: (bytes: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n)),
): Promise<string> {
  const imported = await importKey(key)
  if (imported === undefined) throw new Error('The cookie key is not 32 bytes of base64.')
  const iv = new Uint8Array(random(IV_BYTES)) as Uint8Array<ArrayBuffer>
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      imported,
      bytesOf(JSON.stringify({ v: value, e: expiresAt })),
    ),
  )
  const out = new Uint8Array(iv.length + sealed.length)
  out.set(iv)
  out.set(sealed, iv.length)
  return base64url(out)
}

/** The sealed value, or nothing: wrong key, changed by a byte, past its time, or never sealed. */
export async function unseal(key: string, sealed: string, now: number): Promise<string | undefined> {
  const imported = await importKey(key)
  const bytes = fromBase64url(sealed)
  if (imported === undefined || bytes === undefined || bytes.length <= IV_BYTES) return undefined
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes.slice(0, IV_BYTES) },
      imported,
      bytes.slice(IV_BYTES),
    )
    const { v, e } = JSON.parse(new TextDecoder().decode(plain)) as { v?: unknown; e?: unknown }
    return typeof v === 'string' && typeof e === 'number' && now < e ? v : undefined
  } catch {
    return undefined
  }
}

export { base64url }
