// Editable regions of the 3D human: where the camera goes when you edit a
// category, what lights up under the cursor, and what a drag on the face
// sculpts (Black Desert-style direct manipulation: drag horizontally /
// vertically on a feature to drive its two main sliders).
//
// Anchors are points in the base mesh's reference frame (decimetres) riding a
// bone — HumanBody resolves them through the morphed cage and the live pose.

export interface RegionAnchor {
  bone: string
  /** Reference-space point (base mesh, dm). */
  ref: [number, number, number]
}

export interface Region {
  id: string
  label: string
  /** The editor category this region opens. */
  group: string
  anchor: RegionAnchor
  /** World offset (m) added to the anchor for camera targeting. */
  offset?: [number, number, number]
  /** Camera distance (m), azimuth / elevation (deg). */
  dist: number
  az?: number
  el?: number
  /** Hover/pick sphere radius (m); 0 = camera-only region. */
  pickRadius: number
  /** Skin highlight centre (dm, reference space) + radius. */
  ref?: [number, number, number]
  refRadius?: number
  /** Drag-to-sculpt: slider ids driven by horizontal / vertical drags. */
  sculptX?: string
  sculptY?: string
}

const H = 'head'

export const REGIONS: Region[] = [
  {
    id: 'portrait',
    label: 'Portrait',
    group: 'presets',
    anchor: { bone: H, ref: [0, 7.15, 1.0] },
    offset: [0, -0.04, 0],
    dist: 0.95,
    pickRadius: 0
  },
  {
    id: 'head',
    label: 'Head',
    group: 'head',
    anchor: { bone: H, ref: [0, 7.4, 0.6] },
    dist: 0.85,
    el: 6,
    pickRadius: 0.13,
    ref: [0, 7.6, 0.5],
    refRadius: 1.1,
    sculptX: 'head-scale-horiz-decr-incr',
    sculptY: 'head-scale-vert-decr-incr'
  },
  {
    id: 'forehead',
    label: 'Forehead & brows',
    group: 'forehead',
    anchor: { bone: H, ref: [0, 7.62, 1.35] },
    dist: 0.48,
    el: 6,
    pickRadius: 0.045,
    ref: [0, 7.65, 1.3],
    refRadius: 0.45,
    sculptX: 'eyebrows-angle-down-up',
    sculptY: 'eyebrows-trans-down-up'
  },
  {
    id: 'eyes',
    label: 'Eyes',
    group: 'eyes',
    anchor: { bone: H, ref: [0, 7.28, 1.3] },
    dist: 0.36,
    pickRadius: 0.04,
    ref: [0, 7.28, 1.25],
    refRadius: 0.62,
    sculptX: 'eye-trans-in-out',
    sculptY: 'eye-trans-down-up'
  },
  {
    id: 'nose',
    label: 'Nose',
    group: 'nose',
    anchor: { bone: H, ref: [0, 6.95, 1.6] },
    dist: 0.4,
    az: 28,
    pickRadius: 0.028,
    ref: [0, 6.98, 1.55],
    refRadius: 0.3,
    sculptX: 'nose-scale-horiz-decr-incr',
    sculptY: 'nose-trans-down-up'
  },
  {
    id: 'mouth',
    label: 'Mouth',
    group: 'mouth',
    anchor: { bone: H, ref: [0, 6.6, 1.55] },
    dist: 0.38,
    az: 12,
    pickRadius: 0.032,
    ref: [0, 6.6, 1.5],
    refRadius: 0.33,
    sculptX: 'mouth-scale-horiz-decr-incr',
    sculptY: 'mouth-trans-down-up'
  },
  {
    id: 'cheeks',
    label: 'Cheeks',
    group: 'cheeks',
    anchor: { bone: H, ref: [0.46, 6.98, 1.25] },
    offset: [-0.046, 0, 0],
    dist: 0.48,
    az: 22,
    pickRadius: 0.035,
    ref: [0.46, 6.98, 1.2],
    refRadius: 0.3,
    sculptX: 'cheek-bones-decr-incr',
    sculptY: 'cheek-trans-down-up'
  },
  {
    id: 'jaw',
    label: 'Jaw & chin',
    group: 'jaw',
    anchor: { bone: 'jaw', ref: [0, 6.25, 1.35] },
    dist: 0.5,
    az: 30,
    el: -4,
    pickRadius: 0.04,
    ref: [0, 6.3, 1.2],
    refRadius: 0.5,
    sculptX: 'chin-bones-decr-incr',
    sculptY: 'chin-height-decr-incr'
  },
  {
    id: 'ears',
    label: 'Ears',
    group: 'ears',
    anchor: { bone: H, ref: [0.82, 7.24, 0.33] },
    dist: 0.42,
    az: 75,
    pickRadius: 0.035,
    ref: [0.82, 7.24, 0.33],
    refRadius: 0.32,
    sculptX: 'ear-wing-decr-incr',
    sculptY: 'ear-trans-down-up'
  },
  {
    id: 'neck',
    label: 'Neck',
    group: 'neck',
    anchor: { bone: 'neck02', ref: [0, 6.0, 0.6] },
    dist: 0.75,
    az: 20,
    pickRadius: 0.05,
    ref: [0, 6.0, 0.4],
    refRadius: 0.55,
    sculptX: 'neck-scale-horiz-decr-incr',
    sculptY: 'neck-scale-vert-decr-incr'
  },
  {
    id: 'torso',
    label: 'Torso',
    group: 'torso',
    anchor: { bone: 'spine03', ref: [0, 3.6, 0.8] },
    dist: 1.6,
    az: 15,
    pickRadius: 0.16,
    ref: [0, 3.6, 0.6],
    refRadius: 1.8,
    sculptX: 'measure-shoulder-dist-decr-incr',
    sculptY: 'torso-scale-vert-decr-incr'
  },
  {
    id: 'hips',
    label: 'Hips',
    group: 'hips',
    anchor: { bone: 'spine05', ref: [0, 0.6, 0.6] },
    dist: 1.5,
    az: 25,
    pickRadius: 0.15,
    ref: [0, 0.6, 0.3],
    refRadius: 1.6,
    sculptX: 'measure-hips-circ-decr-incr',
    sculptY: 'hip-waist-down-up'
  },
  {
    id: 'arms',
    label: 'Arms',
    group: 'arms',
    anchor: { bone: 'lowerarm01.L', ref: [2.6, 2.8, 0.2] },
    dist: 1.6,
    az: 35,
    pickRadius: 0.1,
    sculptX: 'measure-upperarm-circ-decr-incr',
    sculptY: 'measure-upperarm-length-decr-incr'
  },
  {
    id: 'legs',
    label: 'Legs',
    group: 'legs',
    anchor: { bone: 'lowerleg01.L', ref: [0.6, -4.2, 0.4] },
    offset: [-0.06, 0, 0],
    dist: 2.0,
    az: 20,
    el: -2,
    pickRadius: 0.13,
    sculptX: 'measure-thigh-circ-decr-incr',
    sculptY: 'upperlegs-height-decr-incr'
  },
  {
    id: 'hair',
    label: 'Hair',
    group: 'hair',
    anchor: { bone: H, ref: [0, 7.9, 0.3] },
    dist: 1.0,
    az: 30,
    el: 8,
    pickRadius: 0
  }
]

export const REGION_BY_GROUP = new Map<string, Region>()
for (const r of REGIONS) if (!REGION_BY_GROUP.has(r.group)) REGION_BY_GROUP.set(r.group, r)
