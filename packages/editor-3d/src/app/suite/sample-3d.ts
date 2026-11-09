import { SAMPLE_TUNING } from '@automata/editor/suite'
import list from './sample-3d/editors.toml?raw'
import hall from './sample-3d/hall.af-sector.json?raw'

// The sample game the full suite opens when no editor server answers (the site's try-it page): a room of two spaces
// joined by a doorway, Wick with the poses, clips and swatches he uses, and a tuning file, all held in memory. It is a small copy of what a real 3D game holds, so the editors
// show what they do without a checkout.
const figures = import.meta.glob('./sample-3d/content/**/*.toml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export const SAMPLE_3D: Readonly<Record<string, string>> = {
  'content/editors.toml': list,
  'content/tuning.toml': SAMPLE_TUNING,
  'content/levels/hall.af-sector.json': hall,
  ...Object.fromEntries(
    Object.entries(figures).map(([path, text]) => [path.replace('./sample-3d/', ''), text]),
  ),
}
