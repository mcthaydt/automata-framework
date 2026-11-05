import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Skill-copy identity: the skills ship three ways (the plugin, the public mirror,
// generated games) from the one source, `agents/automata/skills/`. A copy is correct only when it is the same
// bytes, so the comparison is by content hash, file by file. `create-game` and the mirror call `diffSkillTrees` on their copies.

/** Every file under `dir` as `<slash path relative to dir>` → sha256 hex, sorted by path (code-unit order). */
export function listSkillTree(dir: string): Map<string, string> {
  const files: Array<[string, string]> = []
  const walk = (at: string, prefix: string) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const path = prefix === '' ? entry.name : `${prefix}/${entry.name}`
      if (entry.isDirectory()) walk(join(at, entry.name), path)
      else
        files.push([
          path,
          createHash('sha256')
            .update(readFileSync(join(at, entry.name)))
            .digest('hex'),
        ])
    }
  }
  walk(dir, '')
  files.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return new Map(files)
}

/** One line per path that differs between the trees (`differs`, `only in a`, `only in b`); empty when identical. */
export function diffSkillTrees(a: string, b: string): string[] {
  const left = listSkillTree(a)
  const right = listSkillTree(b)
  const paths = [...new Set([...left.keys(), ...right.keys()])].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0))
  const differences: string[] = []
  for (const path of paths) {
    const l = left.get(path)
    const r = right.get(path)
    if (r === undefined) differences.push(`${path}: only in a`)
    else if (l === undefined) differences.push(`${path}: only in b`)
    else if (l !== r) differences.push(`${path}: differs`)
  }
  return differences
}
