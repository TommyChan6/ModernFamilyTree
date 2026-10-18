// UI metadata for the trait system — display names, icon names (rendered via
// <UiIcon>) and micro-preview hints for each field type. Pure data; the logic lives in src/shared/fields.ts.
//
// `label` / `hint` are getters that translate on every read, so a template
// showing them re-renders when the UI language changes.
import { translate } from '../../i18n'

const typeEntry = (type, icon, key) => ({
  type,
  icon,
  get label() {
    return translate(`personForm.types.${key}`)
  },
  get hint() {
    return translate(`personForm.typeHints.${key}`)
  }
})

export const FIELD_TYPE_META = [
  typeEntry('text', 'type', 'text'),
  typeEntry('boolean', 'toggle-left', 'boolean'),
  typeEntry('number', 'hash', 'number'),
  typeEntry('number_range', 'move-horizontal', 'number_range'),
  typeEntry('select', 'list', 'select'),
  typeEntry('slider', 'sliders-horizontal', 'slider'),
  typeEntry('date', 'calendar', 'date'),
  typeEntry('date_range', 'calendar-range', 'date_range')
]

export const typeMeta = (type) =>
  FIELD_TYPE_META.find((m) => m.type === type) || {
    type,
    icon: 'circle-help',
    label: type,
    hint: ''
  }

const slotEntry = (slot, icon) => ({
  slot,
  icon,
  get label() {
    return translate(`personForm.slots.${slot}`)
  },
  get hint() {
    return translate(`personForm.slotHints.${slot}`)
  }
})

export const SLOT_META = [
  slotEntry('name', 'id-card'),
  slotEntry('gender', 'venus-and-mars'),
  slotEntry('birth', 'sunrise'),
  slotEntry('death', 'sunset'),
  slotEntry('highlight', 'circle-dot')
]
