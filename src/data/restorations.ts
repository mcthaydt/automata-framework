// DX.10b to DX.10e: claims the site cut (docs/2026-10-14-cut-claims.md) that come back only with their proof. Each row names the
// proof it waits for. `proof` is null until that proof exists; then it is the link to it and `copy` must be on the site
// (tests/restorations.test.ts holds both directions: nothing from a row without proof, and the row's copy once it has proof).
// Nothing here is invented: when a row's input ships, the person doing that row fills in `proof` and `copy` together.

export interface Restoration {
  row: 'DX.10b' | 'DX.10c' | 'DX.10d' | 'DX.10e'
  /** The cut claim. */
  claim: string
  /** What must exist before the claim is published, and which framework row delivers it. */
  needs: string
  /** A pattern for the claim's wording, so a row without proof can be checked absent. */
  forbidden: RegExp
  /** The link to the proof (a release, a recorded run, a read-back), or null while there is none. */
  proof: string | null
  /** The wording to publish once there is proof. */
  copy: string | null
}

export const RESTORATIONS: readonly Restoration[] = [
  {
    row: 'DX.10b',
    claim: 'npm create @mcthaydt/automata, a measured clean-machine time, the generated project tree and the npm footer link',
    needs: 'DX.5 (create-game makes a real game) and DX.11d (a first public release, installed on a clean machine with no token)',
    forbidden: /npm create @mcthaydt|@mcthaydt\/create-automata|npmjs\.com\/package\/@mcthaydt/,
    proof: null,
    copy: null,
  },
  {
    row: 'DX.10c',
    claim: 'The skills install, the plugin marketplace commands, and Cursor and Windsurf through AGENTS.md',
    needs: 'DX.11c (the public skills mirror) with each command tested on a named agent version',
    forbidden: /npx skills add mcthaydt|plugin marketplace add mcthaydt|mcthaydt\/automata-skills/,
    proof: null,
    copy: null,
  },
  {
    row: 'DX.10d',
    claim: 'The Discord invite and the URL-based llms.txt instructions',
    needs: 'DX.13 (the Owner’s server, with a permanent invite read back) and DX.12 (the origin serving /llms.txt)',
    forbidden: /discord\.gg\/|discord\.com\/invite\//,
    proof: null,
    copy: null,
  },
  {
    row: 'DX.10e',
    claim: 'Core and Stable stability labels and a version badge',
    needs: 'DX.11d (a published release) and M8.1 (the compatibility rule), and the Owner’s stability policy (DX spec §2.3 gives it no default)',
    forbidden: /Core\s*\/\s*Stable|\bStability:\s*(Core|Stable)\b/,
    proof: null,
    copy: null,
  },
]

export const restoration = (row: Restoration['row']): Restoration => {
  const found = RESTORATIONS.find((r) => r.row === row)
  if (!found) throw new Error(`no restoration row ${row}`)
  return found
}
