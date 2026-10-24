// The text a stage that was never loaded is printed against (EDFF.1d). `printStage(base, document)` patches a base text,
// and a document made from a template has none, so the profile prints it against this smallest stage the schema
// accepts: the template's layers are new tables, this one's single layer goes, and the file comes out in the style of
// the shipped stages.

export const NEW_STAGE_TEXT: string = [
  'id = "new-stage"',
  'displayName = "New stage"',
  'platformAlias = "world.platform"',
  '',
  '[courseTuning]',
  '',
  '[theme]',
  'backdropAlias = "world.rooftopsSky"',
  '',
  '[[theme.layers]]',
  'alias = "world.rooftopsSky"',
  'plate = "sky"',
  'depth = 0.06',
  'sink = 200',
  'extend = "plate"',
  '',
].join('\n')
