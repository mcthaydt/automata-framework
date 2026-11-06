// The editor list's globs. Extracted from The Last Light editor/src/shared/manifest.ts `globToRegExp` (92e6704), the
// rules its guard uses: `*` and `?` stay within one path segment, `**` crosses segments, and `**/` also matches no
// folder at all. Added here: `{scene}` matches one non-empty segment and is captured as the file's scene, so one row
// covers every scene (spec §4.2). Paths are root-relative POSIX paths; the caller rejects anything else first.

const SCENE = '{scene}'

/** A glob as an anchored regular expression; `{scene}` is the named group `scene`. */
function globToRegExp(glob: string, ignoreCase: boolean): RegExp {
  let source = ''
  let index = 0
  while (index < glob.length) {
    if (glob.startsWith('**/', index)) {
      source += '(?:.*/)?'
      index += 3
    } else if (glob.startsWith('**', index)) {
      source += '.*'
      index += 2
    } else if (glob.startsWith(SCENE, index)) {
      source += '(?<scene>[^/]+)'
      index += SCENE.length
    } else {
      const character = glob.charAt(index)
      if (character === '*') source += '[^/]*'
      else if (character === '?') source += '[^/]'
      else source += character.replace(/[.+^${}()|[\]\\]/g, '\\$&')
      index += 1
    }
  }
  return new RegExp(`^${source}$`, ignoreCase ? 'i' : '')
}

/**
 * Whether `path` matches `glob`, and with which scene when the glob names `{scene}`; undefined when it does not.
 * `ignoreCase` is for refusals: on a case-insensitive disk `Content/Editors.toml` is the same file.
 */
export function globMatch(
  glob: string,
  path: string,
  options: { readonly ignoreCase?: boolean } = {},
): { readonly scene?: string } | undefined {
  const match = globToRegExp(glob, options.ignoreCase === true).exec(path)
  if (match === null) return undefined
  const scene = match.groups?.scene
  return scene === undefined ? {} : { scene }
}
