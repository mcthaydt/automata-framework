import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { diffSkillTrees, listSkillTree } from '#src/skill-tree.ts'

const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function tree(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), 'skill-tree-'))
  temps.push(root)
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  return root
}

const SOURCE = {
  'automata/SKILL.md': '---\nname: automata\n---\n',
  'automata-api/reference/api.md': '# API\n',
}

it('lists every file by its slash path, sorted, with a content hash', () => {
  const listed = listSkillTree(tree(SOURCE))
  expect([...listed.keys()]).toEqual(['automata-api/reference/api.md', 'automata/SKILL.md'])
  expect(listed.get('automata/SKILL.md')).toMatch(/^[0-9a-f]{64}$/)
})

it('finds no difference between a tree and its copy', () => {
  const a = tree(SOURCE)
  const b = mkdtempSync(join(tmpdir(), 'skill-tree-copy-'))
  temps.push(b)
  cpSync(a, b, { recursive: true })
  expect(diffSkillTrees(a, b)).toEqual([])
})

it('names a changed byte, a file only in a and a file only in b', () => {
  const a = tree({ ...SOURCE, 'automata/only-a.md': 'a' })
  const b = tree({
    'automata/SKILL.md': '---\nname: automata \n---\n',
    'automata-api/reference/api.md': '# API\n',
    'automata/only-b.md': 'b',
  })
  expect(diffSkillTrees(a, b)).toEqual([
    'automata/SKILL.md: differs',
    'automata/only-a.md: only in a',
    'automata/only-b.md: only in b',
  ])
})
