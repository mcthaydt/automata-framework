// The material picker as the views reach it (ED3D.8b): the headless picker lives in `view/materials`, and `ui/` reaches the
// editor through `app/` (the architecture test), so this is the one door.

export type { MaterialScope, MaterialTarget } from '../model/material-edits'
export {
  createMaterialPicker,
  type MaterialPickerView,
} from '../view/materials/material-picker'
