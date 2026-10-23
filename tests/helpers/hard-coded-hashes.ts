import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

// DX spec §3.10: "A hard-coded hash on the site becomes a website test failure." A sim hash is XXH64, 16 hex digits.
// The only places a hash may appear in the site's sources are the evidence file CI wrote, and the framework source
// snapshots (projects.json: the framework's own files shown verbatim, which tests/api-contract.test.ts holds to the
// framework). Everything else is a hash someone typed.

export const SIM_HASH = /\b(?=[0-9]*[a-f])[0-9a-f]{16}\b/g

/** Files in src/ that may contain a hash, relative to the site root. */
export const MAY_CONTAIN_HASHES = ['src/data/evidence.json', 'src/data/evidence.schema.json', 'src/data/projects.json']

const TEXT = /\.(svelte|ts|js|json|md|html|css|txt)$/

export function siteSourceFiles(root: string): { path: string; text: string }[] {
  const files: { path: string; text: string }[] = []
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (TEXT.test(name)) files.push({ path: relative(root, full).split(sep).join('/'), text: readFileSync(full, 'utf8') })
    }
  }
  walk(join(root, 'src'))
  return files
}

/** `path: hash` for every sim-hash-shaped token in a file that may not contain one. */
export function findHardCodedHashes(files: { path: string; text: string }[]): string[] {
  return files
    .filter(file => !MAY_CONTAIN_HASHES.includes(file.path))
    .flatMap(file => (file.text.match(SIM_HASH) ?? []).map(hash => `${file.path}: ${hash}`))
}
