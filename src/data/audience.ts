export const AUDIENCE_FIT = [
  'You build with coding agents and want source files and tests you can inspect.',
  'You are making a 2D browser game and want phone-first interface foundations.',
  'You want people to own the art, rooms, rules and creative direction.',
  'You are willing to work in TypeScript, review changes and keep tests with the game.',
]
export const AUDIENCE_NOT_FIT = [
  'You need a visual scene editor or drag-and-drop game-making workflow.',
  'You need a complete 3D engine, editor tooling or Unreal-style rendering pipeline today.',
  'You need production-ready multiplayer networking and server packages out of the box.',
  'You expect a finished game from one prompt without reviewing code or testing the result.',
]
export const FAQ_ITEMS = [
  { question: 'Do I need to know how to code?', answer: 'You should be willing to read and change TypeScript, or learn it alongside your agent. Automata makes ownership explicit, but it does not turn game development into a no-code workflow.' },
  { question: 'Do I have to use AI?', answer: 'No. The framework is ordinary source code that you can edit and test yourself. The guided workflow is designed for coding agents, with human review and creative control.' },
  { question: 'Which skills should my agent have?', answer: 'Install Superpowers and the official PixiJS v8 skill collection for the agent you are actually using. Then ask it to report the available skills and load the relevant guidance. These are requirements for the recommended AI workflow, not runtime dependencies of your game.' },
  { question: 'Which coding agents can I use?', answer: 'Use an agent that can read the checkout, edit files and run tests. Installation differs between Codex, Claude Code, Cursor and other tools; the agent setup guide links the current upstream instructions.' },
  { question: 'Can I sell a game built with Automata?', answer: 'The framework code is MIT licensed, which permits commercial use under the license terms without requiring publication of your game source. Keep required notices and check separate asset, dependency, extension and tool terms.' },
  { question: 'Can I make the content myself?', answer: 'Yes. Edit room data, art, rules and narrative directly. The worked example lets you choose a starting position while reusing the existing simulation and renderer. You can also edit any of the code yourself.' },
  { question: 'Does it run in browsers and on phones?', answer: 'Browser delivery and phone-first UI foundations are available, with keyboard and touch examples. Test your own game on the devices, orientations and browsers you intend to support.' },
  { question: 'Is multiplayer ready?', answer: 'Networking and server packages are planned. Deterministic state, snapshots and replays provide foundations for that work; they are not a complete multiplayer service.' },
  { question: 'Does it support full 3D today?', answer: 'The current public starting point is 2D. Further rendering and full 3D work are on the roadmap. Choose based on current capability status rather than planned features.' },
  { question: 'Can I import an existing engine project?', answer: 'There is no automatic Unity, Godot, Unreal or GameMaker project converter. The migration guides map familiar concepts and recommend rebuilding one small mechanic first.' },
  { question: 'How does it help a game grow beyond a prototype?', answer: 'Explicit state ownership, separate systems and packages, and repeatable tests help keep changes bounded as the project grows. They do not promise a particular player count or performance level; measure your own game.' },
  { question: 'What is Ruken?', answer: 'Ruken is the reference gaming host integrated by the framework. The starter can also run standalone in a browser; see hosting guidance when adding platform services.' },
  { question: 'How do I get my game into the showcase?', answer: 'Use the community showcase submission link. Include a public playable URL, your creator name, a short description, the Automata version and screenshots you have permission to share. Submissions are reviewed before publication.' },
]
