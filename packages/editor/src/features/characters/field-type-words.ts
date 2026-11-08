import type { FieldType } from '../../shared/kit/fields'

// Each kind of setting in a player's words, never the file's format word (`int`, `enum`, `ref`): the Characters
// view's Settings tab shows these on its type chips (the copy rule, 12.5).
export const FIELD_TYPE_WORDS: Readonly<Record<FieldType, string>> = {
  int: 'Whole number',
  float: 'Number',
  bool: 'Yes or no',
  text: 'Words',
  enum: 'One of a list',
  color: 'Colour',
  angle: 'Angle',
  ref: 'Link to a thing',
  point: 'Spot',
}
