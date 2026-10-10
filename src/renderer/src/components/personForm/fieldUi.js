// UI metadata for the trait system — display names, icon names (rendered via
// <UiIcon>) and micro-preview hints for each field type. Pure data; the logic lives in src/shared/fields.ts.

export const FIELD_TYPE_META = [
  { type: 'text', icon: 'type', label: 'Text', hint: 'Free text' },
  { type: 'boolean', icon: 'toggle-left', label: 'Yes / No', hint: 'A true/false switch' },
  { type: 'number', icon: 'hash', label: 'Number', hint: 'One number, optional unit' },
  {
    type: 'number_range',
    icon: 'move-horizontal',
    label: 'Number range',
    hint: 'Uncertain span (a–b)'
  },
  { type: 'select', icon: 'list', label: 'Selection', hint: 'Pick one option' },
  { type: 'slider', icon: 'sliders-horizontal', label: 'Slider', hint: 'A value between two ends' },
  { type: 'date', icon: 'calendar', label: 'Date', hint: 'A point in time' },
  { type: 'date_range', icon: 'calendar-range', label: 'Date range', hint: 'Uncertain time span' }
]

export const typeMeta = (type) =>
  FIELD_TYPE_META.find((m) => m.type === type) || {
    type,
    icon: 'circle-help',
    label: type,
    hint: ''
  }

export const SLOT_META = [
  { slot: 'name', icon: 'id-card', label: 'Name', hint: 'Text traits · order = word order' },
  { slot: 'gender', icon: 'venus-and-mars', label: 'Gender', hint: 'Maps onto the color gradient' },
  { slot: 'birth', icon: 'sunrise', label: 'Birth', hint: 'Dates, years or ranges' },
  { slot: 'death', icon: 'sunset', label: 'Death', hint: 'Dates, years or ranges' },
  { slot: 'highlight', icon: 'circle-dot', label: 'Highlight', hint: 'Any value rings the node' }
]
