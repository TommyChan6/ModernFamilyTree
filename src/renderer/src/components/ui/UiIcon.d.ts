// Types for UiIcon.js (a plain-JS render-function component) so .ts modules can import it.
import type { DefineComponent } from 'vue'

declare const UiIcon: DefineComponent<{
  name?: string
  size?: number | string
  stroke?: number | string
  label?: string
}>
export default UiIcon
export { ICON_NAMES, resolveIcon, hasIcon } from './icons.js'
