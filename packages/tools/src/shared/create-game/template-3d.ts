import { CONTENT_3D_FILES } from './template-3d-content.ts'
import { GAME_3D_FILES } from './template-3d-game.ts'
import { CI_FILES } from './template-ci.ts'
import { feelAudioFile } from './template-feel-audio.ts'
import { frameworkSpec, type TemplateFile } from './template-file.ts'
import {
  packageFile,
  readmeFile,
  SHARED_PROJECT_FILES,
  shipConfigFile,
  viteConfigFile,
} from './template-project.ts'

// The 3D game `create-game --template 3d` writes: Wick walking around one room under the angled camera. It has the same
// shape as the 2D game (features by name, shared numbers, the app that wires them, tests of the sim) and the same
// project files; what differs is the 3D package, the content kinds its folders hold and the game itself.

/** The pinned release of Pixi 3D every 3D game installs beside @automata/3d (the closed beta, until the npm release). */
export const PIXI_3D_SPEC = '0.1.0-beta.2'

/** The lines of a 3D game's README that say where its code and content are. */
const WHERE = `- \`src/features/wick/\`: Wick and how he walks. One folder for each thing in your game.
- \`src/features/room/\`: how the game reads its room: the floor Wick stands on, the props he cannot walk through, and
  where he starts.
- \`content/levels/room.af-sector.json\`: the room. \`pnpm exec automata editor\` opens it in the 3D level editor; press
  Save and the game plays the new room.
- \`content/figures/wick.toml\`: Wick himself, in the character editor.
- \`content/tuning.toml\`: how fast Wick walks, in the Tuner.
- \`content/feel/feel.toml\` and \`content/audio/audio.toml\`: what the player feels and hears when Wick bumps a wall,
  in the Feel and Audio editors. \`src/app/feel-audio.ts\` plays them.
- \`src/shared/constants.ts\`: numbers the game uses in more than one place.
- \`src/app/game.ts\`: where the game is put together (the controls, the screen size, the camera).
- \`tests/\`: tests. \`pnpm test\` runs them, and \`pnpm check\` runs every check a game has to pass before it is published.`

/** Every file of a new 3D game, in the order they are written. */
export const TEMPLATE_3D_FILES: readonly TemplateFile[] = [
  readmeFile(WHERE),
  packageFile((options) => ({
    '@automata/3d': frameworkSpec(options),
    '@pixi/3d':
      options.linkWorkspace === true ? 'file:../../vendor/pixi-3d/pixi-3d-0.1.0-beta.2.tgz' : PIXI_3D_SPEC,
    // Feel and Audio play what their editors make, so the game asks for the packages that play it.
    '@automata/audio-synth': frameworkSpec(options),
    '@automata/feel': frameworkSpec(options),
  })),
  shipConfigFile('landscape'),
  viteConfigFile({
    imports: `import { figuresExtension } from '@automata/3d/figures'
import { worldPropContent, worldSwatchContent } from '@automata/3d/world-content'
import { audioContent } from '@automata/audio-synth'
import { feelContent } from '@automata/feel'`,
    schemas:
      '[...(figuresExtension.content ?? []), worldSwatchContent, worldPropContent, feelContent, audioContent]',
    compiles: "Wick's figure, the room's swatches and props, the tuning, and what Feel and Audio write",
  }),
  ...SHARED_PROJECT_FILES,
  ...GAME_3D_FILES,
  feelAudioFile({ import: "import { SIZE } from '../shared/screen.ts'", expr: 'SIZE' }),
  ...CONTENT_3D_FILES,
  ...CI_FILES,
]
