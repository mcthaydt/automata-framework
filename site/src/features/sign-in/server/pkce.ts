// PKCE (RFC 7636) for GitHub's web flow: a verifier only this function knows until the code is exchanged, and its S256
// challenge, which is all GitHub sees when the person is sent over.
import { base64url } from './seal'

/** 32 random bytes make a 43-character verifier. */
export async function pkcePair(
  random: (bytes: number) => Uint8Array,
): Promise<{ readonly verifier: string; readonly challenge: string }> {
  const verifier = base64url(random(32))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return { verifier, challenge: base64url(new Uint8Array(digest)) }
}
