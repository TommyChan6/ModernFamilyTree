import { shallowRef } from 'vue'

// Views whose style lives on a document they own (not in the store) lend the
// Style Studio a small handle while they're mounted, so the studio edits
// through the view's own undo + autosave path instead of around it.
//
// mapStyleBridge (set by MapView): {
//   meta: ComputedRef<{ style, base }>,  thumbDoc: ComputedRef<MapDoc|null>,
//   thumbH: ComputedRef<number>, setStyle(id), setBase('sea'|'land')
// }
export const mapStyleBridge = shallowRef(null)
