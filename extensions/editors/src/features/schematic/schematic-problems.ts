// What the game's content compiler would say about a scene's behaviour file, said in words at the field that is wrong.
// The editor runs the same checks the compiler does (`checkSystems`), so what Schematic calls fine is what the game plays.
// The checks name things the way the file does ("transition 0", "node", "hook"); each message here becomes a sentence a
// person can act on, and none shows a key name.
import { checkSystems, type SysEffect, type SystemsDef } from '@automata/systems/sim'
import type { Problem } from '../../shared/toml-session.ts'
import { modeWords, spaced } from './pieces/piece.ts'

/** Every hook the file names: the game's code answers for them, so the editor never calls one missing. */
export function everyHookNamed(def: SystemsDef): string[] {
  const names = new Set<string>()
  const effect = (e: SysEffect): void => {
    if ('call' in e) names.add(e.call)
  }
  for (const agent of def.agents) {
    for (const hook of agent.hooks ?? []) names.add(hook)
    for (const t of agent.transitions) for (const e of t.do ?? []) effect(e)
    for (const stop of agent.routine ?? []) for (const e of stop.do ?? []) effect(e)
  }
  for (const rule of def.rules) for (const e of rule.then) effect(e)
  return [...names]
}

const SENSE_VERB: Readonly<Record<string, string>> = {
  sight: 'see',
  sound: 'hear',
  warmth: 'feel warmth',
  touch: 'touch',
}

type Kind = 'agent' | 'rule' | 'scenario' | 'other'

const q = (name: string): string => `“${name}”`

/** The patterns of the checks' messages (after their `agent x:` prefix), each with its sentence. */
const SENTENCES: readonly [RegExp, (m: RegExpMatchArray, who: string, kind: Kind) => string][] = [
  [
    /^defined twice$/,
    (_m, who, kind) =>
      `Two ${kind === 'agent' ? 'characters' : kind === 'rule' ? 'rules' : 'checks'} are called ${q(who)}. Give one of them another name.`,
  ],
  [/^every must be positive$/, () => 'A rule must repeat after more than 0 seconds.'],
  [
    /^a rule that hears runs when the noise is made/,
    () => 'A rule that listens runs the moment a noise is made, so it cannot also repeat on a timer.',
  ],
  [
    /^only an agent waits$/,
    () =>
      'A world rule cannot ask whether a character has got where it was going or is stuck. Put that in the character’s own switches.',
  ],
  [
    /^sees needs an agent$/,
    () => 'Only a character can see, so a world rule cannot ask it. Put it in the character’s own switches.',
  ],
  [/^mode needs an agent ID/, () => 'A world rule must say whose mode it means.'],
  [/^self\.\S+ needs an agent$/, () => 'A world rule cannot use a character’s own note.'],
  [
    /^(?:goTo|flee|followThrough) needs an agent$/,
    () => 'A world rule cannot move a character. Use the character’s own switches.',
  ],
  [/^setMode needs an agent ID/, () => 'A world rule must say which character to switch.'],
  [/^set self\.\S+ needs an agent$/, () => 'A world rule cannot change a character’s own note.'],
  [/^hook (\S+) is not implemented$/, (m) => `The game’s code does not do ${q(m[1] ?? '')} yet.`],
  [
    /^matrix .*: undecided/,
    () => 'This design note has nothing decided yet: give it a rule, how it shows, or a reason it is cut.',
  ],
  [
    /^matrix .*: names unknown rule (\S+)$/,
    (m) => `This design note names the rule ${q(m[1] ?? '')}, which does not exist.`,
  ],
  [
    /^tunable (\S+): min (\S+) is above max (\S+)$/,
    (m) => `${q(m[1] ?? '')} has its lowest (${m[2]}) above its highest (${m[3]}).`,
  ],
  [
    /^tunable (\S+): (\S+) is outside (\S+)–(\S+)$/,
    (m) => `${q(m[1] ?? '')} is ${m[2]}, which is not between ${m[3]} and ${m[4]}.`,
  ],
  [
    /^initial mode (\S+) is not one of its modes$/,
    (m) => `It starts in ${q(m[1] ?? '')}, which is not one of its modes.`,
  ],
  [
    /^speed for unknown mode (\S+)$/,
    (m) => `It has a speed for ${q(m[1] ?? '')}, which is not one of its modes.`,
  ],
  [
    /^no speed for mode (\S+)$/,
    (m) => `${modeWords(m[1] ?? '')} has no speed. Give it one (0 to stand still).`,
  ],
  [
    /^transition \d+ \(.*\) needs a (\w+) sense$/,
    (m) => `A condition needs it to ${SENSE_VERB[m[1] ?? ''] ?? 'notice'}, but this character has no way to.`,
  ],
  [
    /^(?:transition .*|setMode) names unknown agent (\S+)$/,
    (m) => `This names ${q(m[1] ?? '')}, who is not in this scene.`,
  ],
  [
    /^transition .* names unknown mode (\S+)$/,
    (m) => `A condition names the mode ${q(m[1] ?? '')}, which that character does not have.`,
  ],
  [
    /^transition .* names unknown node (\S+)$/,
    (m) => `A condition names the place ${q(m[1] ?? '')}, which is not one of the scene’s places.`,
  ],
  [
    /^transition \d+ \(.*\) is from unknown mode (\S+)$/,
    (m) => `This character switches from ${q(m[1] ?? '')}, which is not one of its modes.`,
  ],
  [
    /^transition \d+ \(.*\) is to unknown mode (\S+)$/,
    (m) => `This character switches to ${q(m[1] ?? '')}, which is not one of its modes.`,
  ],
  [
    /^transition .* asks both about sound/,
    () => 'A switch cannot ask both about a noise and about getting where it was going or being stuck.',
  ],
  [
    /^setMode to unknown mode (\S+)$/,
    (m) => `It switches to ${q(m[1] ?? '')}, which is not one of its modes.`,
  ],
  [
    /^calls hook (\S+), which it does not declare$/,
    (m) => `It uses ${q(m[1] ?? '')} from the game’s code, but this character does not list it.`,
  ],
  [
    /^goTo unknown node (\S+)$/,
    (m) => `It goes to ${q(m[1] ?? '')}, which is not one of the scene’s places.`,
  ],
  [
    /^has a routine but no .* mode to run it in$/,
    () => 'It has a patrol but no mode called Patrol to walk it in.',
  ],
  [
    /^routine stop at unknown node (\S+)$/,
    (m) => `A patrol stop is at ${q(m[1] ?? '')}, which is not one of the scene’s places.`,
  ],
  [
    /^followThrough to unknown mode (\S+)$/,
    (m) => `It follows the player and then switches to ${q(m[1] ?? '')}, which is not one of its modes.`,
  ],
  [/^followThrough delay must be ≥ 0$/, () => 'The wait before following must be 0 or more seconds.'],
  [
    /^followThrough portal (\S+) is not/,
    (m) => `It follows through ${q(m[1] ?? '')}, which is not a doorway the player can use.`,
  ],
  [
    /^ambush (\S+) names unknown agent (\S+)$/,
    (m) => `This ambush uses ${q(m[2] ?? '')}, who is not in this scene.`,
  ],
  [
    /^ambush (\S+): no mode (\S+) on agent (\S+)$/,
    (m) => `There is no mode ${q(m[2] ?? '')} on ${spaced(m[3] ?? '')}, for this ambush.`,
  ],
  [
    /^ambush (\S+): sting and grace must be ≥ 0$/,
    () => 'The times for this ambush must each be 0 or more seconds.',
  ],
  [/^no mode (\S+) on agent (\S+)$/, (m) => `There is no mode ${q(m[1] ?? '')} on ${spaced(m[2] ?? '')}.`],
  [
    /^unknown policy (\S+)$/,
    (m) => `This check plays as ${q(m[1] ?? '')}, which is not a kind of player the checks know.`,
  ],
  [/^within must be positive$/, () => 'The time allowed must be more than 0 seconds.'],
  [/^probability must be within 0–1$/, () => 'The chance must be between 0 and 100 %.'],
  [/^seeds must be a whole number ≥ 1$/, () => 'The number of tries must be a whole number, 1 or more.'],
  [/^places unknown agent (\S+)$/, (m) => `This check places ${q(m[1] ?? '')}, who is not in this scene.`],
]

/** One of the checks' messages as a sentence. A message nothing above knows is still said, never dropped. */
export function checkSentence(message: string): string {
  const prefixed = /^(agent|rule|scenario) ([^:]+): (.*)$/s.exec(message)
  const kind: Kind = (prefixed?.[1] as Kind | undefined) ?? 'other'
  const who = prefixed?.[2] ?? ''
  const rest = prefixed?.[3] ?? message
  for (const [pattern, say] of SENTENCES) {
    const match = pattern.exec(rest)
    if (match) return say(match, who, kind)
  }
  const raised = rest.charAt(0).toUpperCase() + rest.slice(1)
  return /[.!?]$/.test(raised) ? raised : `${raised}.`
}

/**
 * The scene's problems beyond its shape, each at its field. `nodes` are the scene's places when known; without them the
 * place names are not checked (the compiler checks them against the loaded graph).
 */
export function schematicProblems(def: SystemsDef, nodes: readonly string[] | undefined): Problem[] {
  const found: Problem[] = []
  checkSystems(
    def,
    { hooks: everyHookNamed(def), ...(nodes === undefined ? {} : { nodes }) },
    (keyPath, message) => {
      found.push({ keyPath, message: checkSentence(message) })
    },
  )
  return found
}
