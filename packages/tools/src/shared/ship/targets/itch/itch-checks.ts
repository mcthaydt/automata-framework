import { readFileSync, statSync } from 'node:fs'
import { join, posix } from 'node:path'
import { ITCH_LIMITS } from './itch-limits.ts'

// The checks `automata ship prepare --target itch` runs on a built folder (PUB spec §4). Each takes the build's
// file listing (`buildFiles`: `/`-separated, relative, sorted) and returns one line per problem, naming the file
// and the limit; an empty list passes. prepare-itch.ts runs them in the spec's order.

const ENTRY = 'index.html'

/** itch.io opens `index.html` at the root of the upload, by that exact name. */
export function checkItchEntry(files: readonly string[], entry: string): string[] {
  if (entry !== ENTRY) {
    return [
      `game.entry is ${entry}, but itch.io opens ${ENTRY}; name the entry page ${ENTRY} for an itch build`,
    ]
  }
  return files.includes(ENTRY) ? [] : [`${ENTRY}: not at the root of the build; itch.io opens ${ENTRY}`]
}

export function checkFileCount(files: readonly string[]): string[] {
  if (files.length <= ITCH_LIMITS.maxFiles) return []
  return [`the build has ${files.length} files; itch.io allows at most ${ITCH_LIMITS.maxFiles}`]
}

/** The limit is on the name including its path, counted in characters (code points). */
export function checkPathLengths(files: readonly string[]): string[] {
  return files.flatMap((file) => {
    const length = [...file].length
    return length > ITCH_LIMITS.maxPathLength
      ? [`${file}: ${length} characters; itch.io allows paths of at most ${ITCH_LIMITS.maxPathLength}`]
      : []
  })
}

const megabytes = (bytes: number): string => `${bytes / 1_000_000} MB`

/** Each file against the per-file limit, then the whole build against the total. */
export function checkFileSizes(distDir: string, files: readonly string[]): string[] {
  const problems: string[] = []
  let total = 0
  for (const file of files) {
    const size = statSync(join(distDir, file)).size
    total += size
    if (size > ITCH_LIMITS.maxFileBytes) {
      problems.push(
        `${file}: ${size} bytes; itch.io allows at most ${ITCH_LIMITS.maxFileBytes} bytes (${megabytes(ITCH_LIMITS.maxFileBytes)}) per file`,
      )
    }
  }
  if (total > ITCH_LIMITS.maxTotalBytes) {
    problems.push(
      `the build is ${total} bytes; itch.io allows at most ${ITCH_LIMITS.maxTotalBytes} bytes (${megabytes(ITCH_LIMITS.maxTotalBytes)}) in total`,
    )
  }
  return problems
}

// Files whose text can name another file: pages, stylesheets, scripts and JSON (spritesheets, manifests).
const TEXT = /\.(?:html|htm|svg|css|js|mjs|cjs|json|webmanifest)$/i
// A run of URL path characters: `./assets/Hero.png` in `src="./assets/Hero.png?v=2"`. It stops at quotes,
// brackets, whitespace, `?`, `#` and `:`, so a query, a fragment and a scheme are not part of it.
const PATH_LIKE = /[\w.~%@+-]+(?:\/[\w.~%@+-]+)*/g

const decode = (text: string): string => {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

/**
 * References whose case differs from the file they name (itch.io serves files case-sensitively; a Mac's disk
 * usually is not, so the game works locally and 403s on itch.io).
 *
 * It reads the text of every page, stylesheet, script and JSON file instead of parsing them: a reference is any
 * path-like run of characters that names no file exactly but names one when case is ignored. Resolved both
 * from the referencing file's folder (HTML, CSS, `new URL(x, import.meta.url)`) and from the build root (a
 * page-relative `fetch` in a bundled script). A name that matches no file in any case is not a reference to the
 * build and is ignored, so prose, identifiers and server paths cannot fail the check; root-absolute paths are
 * the earlier check's.
 */
export function findCaseMismatches(distDir: string, files: readonly string[]): string[] {
  const exact = new Set(files)
  const byLowerCase = new Map(files.map((file) => [file.toLowerCase(), file]))
  const lowerBaseNames = new Set(files.map((file) => posix.basename(file).toLowerCase()))

  const problems: string[] = []
  for (const file of files) {
    if (!TEXT.test(file)) continue
    const folder = posix.dirname(file)
    const reported = new Set<string>()
    for (const [token] of readFileSync(join(distDir, file), 'utf8').matchAll(PATH_LIKE)) {
      const reference = decode(token)
      // Cheap filter first: most tokens in a bundle are identifiers that name no file at all.
      if (!lowerBaseNames.has(posix.basename(reference).toLowerCase())) continue
      const candidates = [posix.join(folder, reference), posix.normalize(reference)].filter(
        (candidate) => !candidate.startsWith('..'),
      )
      if (candidates.some((candidate) => exact.has(candidate))) continue
      const onDisk = candidates.map((candidate) => byLowerCase.get(candidate.toLowerCase())).find(Boolean)
      if (onDisk === undefined || reported.has(token)) continue
      reported.add(token)
      problems.push(`${file}: "${token}" is ${onDisk} on disk; itch.io matches file names case-sensitively`)
    }
  }
  return problems
}

/** A `ruken.toml` left by a Ruken prepare is Ruken's manifest, not part of an itch.io game. */
export function checkNoRukenToml(files: readonly string[]): string[] {
  return files
    .filter((file) => posix.basename(file) === 'ruken.toml')
    .map(
      (file) =>
        `${file}: a Ruken manifest is in the build (left by \`automata ship prepare\`); remove it or rebuild for itch.io`,
    )
}
