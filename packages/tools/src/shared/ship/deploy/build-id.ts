/**
 * A build's ID on the dev host: the commit's UTC time to the minute, then its short sha, for example
 * `202610111205-abcdef0` (FloorFifty `deploy/bin/build-tag`). Time first, so IDs sort as commits do.
 * The host's `deploy` script accepts only IDs matching BUILD_ID_PATTERN.
 */
export const BUILD_ID_PATTERN: RegExp = /^[0-9]{12}-[0-9a-f]{7,40}$/

const pad = (value: number): string => String(value).padStart(2, '0')

/**
 * The build ID for a commit: its UTC time to the minute, a dash, then the first seven characters of its sha.
 * Throws for a `sha` that is not 7 to 40 lower-case hex digits.
 */
export function buildIdFor(commit: { readonly time: Date; readonly sha: string }): string {
  if (!/^[0-9a-f]{7,40}$/.test(commit.sha)) throw new Error(`not a git sha: ${commit.sha}`)
  const t = commit.time
  const stamp = `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}`
  return `${stamp}-${commit.sha.slice(0, 7)}`
}
