// A game event's id in words, as every editor that answers events shows it: `player.hit` is "player hit", `door.*` is
// "any door event", `*` is "anything". The ids are the game's code; the words are only how they read on screen.
export function eventWords(on: string): string {
  const words = (part: string): string => part.replace(/[._-]+/g, ' ').trim()
  if (on.trim() === '*') return 'anything'
  if (on.endsWith('*')) return `any ${words(on.slice(0, -1))} event`
  return words(on)
}
