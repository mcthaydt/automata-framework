// The old `automata-ship` name, kept for one release: it says so on stderr, then runs `automata ship` unchanged, so
// a script that still calls it keeps working (spec 3.2).
export const ALIAS_NOTICE = 'automata-ship is now "automata ship". This name goes away in the next release.'

export async function runShipAlias(
  args: readonly string[],
  stderr: (message: string) => void,
  ship: (args: readonly string[]) => Promise<number>,
): Promise<number> {
  stderr(`${ALIAS_NOTICE}\n`)
  return ship(args)
}
