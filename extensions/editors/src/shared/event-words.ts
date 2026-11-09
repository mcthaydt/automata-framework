// A game event's id in words, as every editor that answers events shows it: `player.hit` is "player hit", `door.*` is
// "any door event", `*` is "anything". The ids are the game's code; the words are only how they read on screen.

// The events the extensions send, said as a person would: "When a character changes mode", not "When systems mode". Each
// reads after "When" and after "Play … when".
const SAID: Readonly<Record<string, string>> = {
  'systems.mode': 'a character changes mode',
  'systems.caught': 'a character catches the player',
  'systems.line': 'a character says a line',
  'narrative.line': 'a conversation shows a line',
  'narrative.choices': 'a conversation offers choices',
  'narrative.ended': 'a conversation ends',
  'cutscene.started': 'a cutscene starts',
  'cutscene.ended': 'a cutscene ends',
  'puzzle.said': 'a puzzle hears a word',
  'puzzle.gave': 'a puzzle gives something',
  'puzzle.goal': 'a puzzle is solved',
  'puzzle.noise': 'a puzzle makes a noise',
  'puzzle.cutscene': 'a puzzle starts a cutscene',
  'puzzle.dialogue': 'a puzzle starts a conversation',
  'puzzle.exit': 'a puzzle opens an exit',
  'puzzle.checkpoint': 'a puzzle saves the game',
  'puzzle.keypad': 'a keypad is used',
}

// What each kind of extension event is called when all of them are meant: "any conversation event".
const KIND: Readonly<Record<string, string>> = {
  systems: 'character',
  narrative: 'conversation',
}

export function eventWords(on: string): string {
  const words = (part: string): string => part.replace(/[._-]+/g, ' ').trim()
  if (on.trim() === '*') return 'anything'
  if (on.endsWith('*')) {
    const kind = on.slice(0, -1).replace(/\.$/, '')
    return `any ${KIND[kind] ?? words(kind)} event`
  }
  return SAID[on] ?? words(on)
}
