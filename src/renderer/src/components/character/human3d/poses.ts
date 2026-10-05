// Body poses + facial expressions for the 3D human.
//
// Poses are FK rotations on the MakeHuman default skeleton. Every bone's rest
// frame is world-aligned (HumanBody fits bones with identity rotations), so a
// rotation is an axis + angle in that frame, applied in the parent's space —
// the elbow's axis turns with the upper arm, as FK should. Axes:
//   'x' | 'y' | 'z'  world rest axes (x = character's left, y up, z forward)
//   'twist'          the bone's REST head→tail axis, applied in listed order
//   'roll'           the same axis but intrinsic (applied before any swing)
//   'flex'           bone × forward: positive swings the bone toward the front
// Poses list left-side bones (.L) and centre bones; `.L` entries are mirrored
// onto `.R` unless the pose lists the .R bone itself.
//
// Expressions are weights on the MakeHuman expression-unit targets (applied
// on the CPU cage like any shape morph).

import * as THREE from 'three'

export type PoseAxis = 'x' | 'y' | 'z' | 'twist' | 'roll' | 'flex'
export type PoseOp = [bone: string, axis: PoseAxis, degrees: number]

export interface PoseDef {
  id: string
  icon: string
  label: string
  ops: PoseOp[]
  /** true = don't mirror .L ops (asymmetric poses list both sides). */
  noMirror?: boolean
}

// The rest pose is MakeHuman's A-pose (arms ~45 deg down). Calibrated
// against renders: for the LEFT arm z- lowers / z+ raises, flex+ swings
// forward, twist+ turns the palm toward the thigh.
const ARMS_DOWN: PoseOp[] = [
  ['clavicle.L', 'z', -3],
  ['upperarm01.L', 'z', -40],
  ['upperarm01.L', 'flex', 4],
  ['lowerarm01.L', 'flex', 0],
  ['lowerarm01.L', 'z', 5],
  ['lowerarm01.L', 'twist', 20],
  ['wrist.L', 'flex', 4]
]

/** Relaxed fingers: a soft natural curl. */
const SOFT_HAND: PoseOp[] = [
  ['finger1-1.L', 'flex', 8],
  ['finger1-2.L', 'flex', 10],
  ['finger2-1.L', 'flex', 8],
  ['finger2-2.L', 'flex', 14],
  ['finger2-3.L', 'flex', 10],
  ['finger3-1.L', 'flex', 12],
  ['finger3-2.L', 'flex', 18],
  ['finger3-3.L', 'flex', 12],
  ['finger4-1.L', 'flex', 16],
  ['finger4-2.L', 'flex', 22],
  ['finger4-3.L', 'flex', 14],
  ['finger5-1.L', 'flex', 20],
  ['finger5-2.L', 'flex', 26],
  ['finger5-3.L', 'flex', 16]
]

const FIST: PoseOp[] = [
  ['finger1-2.L', 'flex', 35],
  ['finger1-3.L', 'flex', 30],
  ['finger2-1.L', 'flex', 70],
  ['finger2-2.L', 'flex', 85],
  ['finger2-3.L', 'flex', 50],
  ['finger3-1.L', 'flex', 72],
  ['finger3-2.L', 'flex', 88],
  ['finger3-3.L', 'flex', 50],
  ['finger4-1.L', 'flex', 75],
  ['finger4-2.L', 'flex', 90],
  ['finger4-3.L', 'flex', 50],
  ['finger5-1.L', 'flex', 78],
  ['finger5-2.L', 'flex', 90],
  ['finger5-3.L', 'flex', 50]
]

const R = (ops: PoseOp[]) => mirrorOps(ops)

export const POSES: PoseDef[] = [
  { id: 'apose', icon: '🧍', label: 'A-pose', ops: [] },
  { id: 'relaxed', icon: '🙂', label: 'Relaxed', ops: [...ARMS_DOWN, ...SOFT_HAND] },
  {
    id: 'contrapposto',
    icon: '🗽',
    label: 'Contrapposto',
    noMirror: true,
    ops: [
      ...ARMS_DOWN,
      ...SOFT_HAND,
      ...R([...ARMS_DOWN, ...SOFT_HAND]),
      ['root', 'z', 3],
      ['spine04', 'z', -3],
      ['spine02', 'z', -2],
      ['neck02', 'z', 2],
      ['head', 'z', 3],
      ['head', 'y', -6],
      ['upperleg01.R', 'flex', 8],
      ['upperleg01.R', 'z', -3],
      ['lowerleg01.R', 'flex', -14],
      ['foot.R', 'flex', 4],
      ['upperleg01.L', 'z', 2]
    ]
  },
  {
    id: 'wave',
    icon: '👋',
    label: 'Wave',
    noMirror: true,
    ops: [
      ...ARMS_DOWN,
      ...SOFT_HAND,
      ['upperarm01.R', 'z', -35],
      ['upperarm01.R', 'flex', 12],
      ['lowerarm01.R', 'roll', -70],
      ['lowerarm01.R', 'z', -80],
      ['wrist.R', 'z', -8],
      ['head', 'z', 4],
      ['head', 'y', -5],
      ['spine04', 'z', 2]
    ]
  },
  {
    id: 'thinking',
    icon: '🤔',
    label: 'Thinking',
    noMirror: true,
    ops: [
      ...ARMS_DOWN,
      ...SOFT_HAND,
      ['upperarm01.R', 'z', 30],
      ['upperarm01.R', 'flex', 38],
      ['lowerarm01.R', 'roll', -60],
      ['lowerarm01.R', 'flex', 125],
      ['wrist.R', 'flex', -20],
      ...R(FIST),
      ['head', 'x', 6],
      ['head', 'z', -6],
      ['neck02', 'y', 4]
    ]
  },
  {
    id: 'heroic',
    icon: '🏆',
    label: 'Heroic',
    ops: [
      ['clavicle.L', 'z', 3],
      ['upperarm01.L', 'z', -42],
      ['upperarm01.L', 'flex', -6],
      ['lowerarm01.L', 'roll', 35],
      ['lowerarm01.L', 'flex', -8],
      ...FIST,
      ['upperleg01.L', 'z', 7],
      ['foot.L', 'z', -5],
      ['spine04', 'x', -5],
      ['head', 'x', -7]
    ]
  },
  {
    id: 'shy',
    icon: '🫣',
    label: 'Shy',
    ops: [
      ['clavicle.L', 'z', -6],
      ['upperarm01.L', 'z', -50],
      ['upperarm01.L', 'flex', 8],
      ['lowerarm01.L', 'roll', 40],
      ['lowerarm01.L', 'flex', 22],
      ['lowerarm01.L', 'z', -22],
      ...SOFT_HAND,
      ['upperleg01.L', 'z', -3],
      ['lowerleg01.L', 'flex', -4],
      ['head', 'x', 10],
      ['head', 'z', 7],
      ['spine04', 'x', 3]
    ]
  },
  {
    id: 'clasped',
    icon: '🤲',
    label: 'Hands clasped',
    ops: [
      ['clavicle.L', 'z', -4],
      ['upperarm01.L', 'z', -50],
      ['upperarm01.L', 'flex', 8],
      ['lowerarm01.L', 'roll', 40],
      ['lowerarm01.L', 'flex', 22],
      ['lowerarm01.L', 'z', -22],
      ...SOFT_HAND,
      ['head', 'x', 2]
    ]
  }
]

export const POSE_BY_ID = new Map(POSES.map((p) => [p.id, p]))

/** Mirror left-side ops onto the right (`.L` → `.R`, axes reflected). */
export function mirrorOps(ops: PoseOp[]): PoseOp[] {
  return ops
    .filter(([b]) => b.endsWith('.L'))
    .map(([b, axis, deg]) => {
      const flip = axis === 'y' || axis === 'z' || axis === 'twist' || axis === 'roll'
      return [b.slice(0, -2) + '.R', axis, flip ? -deg : deg] as PoseOp
    })
}

/** The full op list for a pose (with mirroring applied). */
export function poseOps(def: PoseDef): PoseOp[] {
  if (def.noMirror) return def.ops
  const listedR = new Set(def.ops.filter(([b]) => b.endsWith('.R')).map(([b]) => b))
  return [...def.ops, ...mirrorOps(def.ops).filter(([b]) => !listedR.has(b))]
}

const AXES: Record<'x' | 'y' | 'z', THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1)
}

/**
 * Quaternions per bone for a pose. `boneDir(name)` gives the rest head→tail
 * unit direction (needed for 'roll' / 'flex').
 */
export function poseQuaternions(
  ops: PoseOp[],
  boneDir: (name: string) => THREE.Vector3 | null
): Map<string, THREE.Quaternion> {
  // Per bone: 'roll' (about the bone's own rest axis) applies FIRST
  // (intrinsic), then every other op in listed order about rest-frame axes.
  const swing = new Map<string, THREE.Quaternion>()
  const twist = new Map<string, THREE.Quaternion>()
  const fwd = new THREE.Vector3(0, 0, 1)
  const axis = new THREE.Vector3()
  const q = new THREE.Quaternion()
  for (const [bone, kind, deg] of ops) {
    if (kind === 'x' || kind === 'y' || kind === 'z') axis.copy(AXES[kind])
    else {
      const dir = boneDir(bone)
      if (!dir) continue
      if (kind === 'twist' || kind === 'roll') axis.copy(dir)
      else {
        axis.crossVectors(dir, fwd)
        if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0)
        axis.normalize()
      }
    }
    q.setFromAxisAngle(axis, THREE.MathUtils.degToRad(deg))
    const into = kind === 'roll' ? twist : swing
    const cur = into.get(bone) || new THREE.Quaternion()
    cur.premultiply(q)
    into.set(bone, cur)
  }
  const out = new Map<string, THREE.Quaternion>()
  for (const name of new Set([...swing.keys(), ...twist.keys()])) {
    const sw = swing.get(name) || new THREE.Quaternion()
    const tw = twist.get(name)
    out.set(name, tw ? sw.clone().multiply(tw) : sw.clone())
  }
  return out
}

// ── Expressions ──────────────────────────────────────────────────────────────
export interface ExpressionDef {
  id: string
  icon: string
  label: string
  units: Record<string, number>
}

const E = 'expr/'
export const EXPRESSIONS: ExpressionDef[] = [
  { id: 'neutral', icon: '😐', label: 'Neutral', units: {} },
  {
    id: 'smile',
    icon: '🙂',
    label: 'Smile',
    units: {
      'mouth-corner-puller': 0.55,
      'mouth-elevation': 0.1,
      'eye-left-slit': 0.15,
      'eye-right-slit': 0.15
    }
  },
  {
    id: 'grin',
    icon: '😁',
    label: 'Big grin',
    units: {
      'mouth-corner-puller': 1,
      'mouth-parling': 0.55,
      'mouth-upward-retraction': 0.25,
      'eye-left-slit': 0.35,
      'eye-right-slit': 0.35,
      'nose-left-elevation': 0.2,
      'nose-right-elevation': 0.2
    }
  },
  {
    id: 'laugh',
    icon: '😆',
    label: 'Laugh',
    units: {
      'mouth-corner-puller': 1,
      'mouth-open': 0.5,
      'mouth-parling': 0.4,
      'eye-left-slit': 0.6,
      'eye-right-slit': 0.6,
      'eyebrows-left-inner-up': 0.2,
      'eyebrows-right-inner-up': 0.2
    }
  },
  {
    id: 'sad',
    icon: '😢',
    label: 'Sad',
    units: {
      'mouth-depression': 0.7,
      'eyebrows-left-inner-up': 0.9,
      'eyebrows-right-inner-up': 0.9,
      'eye-left-slit': 0.15,
      'eye-right-slit': 0.15,
      'mouth-compression': 0.2
    }
  },
  {
    id: 'angry',
    icon: '😠',
    label: 'Angry',
    units: {
      'eyebrows-left-down': 1,
      'eyebrows-right-down': 1,
      'eye-left-slit': 0.35,
      'eye-right-slit': 0.35,
      'mouth-compression': 0.6,
      'nose-left-dilatation': 0.6,
      'nose-right-dilatation': 0.6,
      'nose-compression': 0.3
    }
  },
  {
    id: 'surprised',
    icon: '😮',
    label: 'Surprised',
    units: {
      'eyebrows-left-up': 1,
      'eyebrows-right-up': 1,
      'eye-left-opened-up': 0.8,
      'eye-right-opened-up': 0.8,
      'mouth-open': 0.55,
      'mouth-pursing': 0.2
    }
  },
  {
    id: 'fear',
    icon: '😨',
    label: 'Afraid',
    units: {
      'eyebrows-left-inner-up': 1,
      'eyebrows-right-inner-up': 1,
      'eyebrows-left-up': 0.4,
      'eyebrows-right-up': 0.4,
      'eye-left-opened-up': 0.7,
      'eye-right-opened-up': 0.7,
      'mouth-retraction': 0.6,
      'mouth-open': 0.2,
      'neck-platysma': 0.4
    }
  },
  {
    id: 'disgust',
    icon: '🤢',
    label: 'Disgust',
    units: {
      'nose-left-elevation': 0.9,
      'nose-right-elevation': 0.9,
      'mouth-upward-retraction': 0.6,
      'eyebrows-left-down': 0.5,
      'eyebrows-right-down': 0.5,
      'eye-left-slit': 0.4,
      'eye-right-slit': 0.4,
      'mouth-depression': 0.3
    }
  },
  {
    id: 'smirk',
    icon: '😏',
    label: 'Smirk',
    units: {
      'mouth-part-later': 0.6,
      'mouth-corner-puller': 0.25,
      'eyebrows-left-extern-up': 0.6,
      'eye-right-slit': 0.25
    }
  },
  {
    id: 'pout',
    icon: '😗',
    label: 'Pout',
    units: {
      'mouth-protusion': 0.8,
      'mouth-pursing': 0.6,
      'eyebrows-left-inner-up': 0.3,
      'eyebrows-right-inner-up': 0.3
    }
  },
  {
    id: 'determined',
    icon: '😤',
    label: 'Determined',
    units: {
      'eyebrows-left-down': 0.45,
      'eyebrows-right-down': 0.45,
      'mouth-compression': 0.55,
      'eye-left-slit': 0.2,
      'eye-right-slit': 0.2,
      'nose-left-dilatation': 0.3,
      'nose-right-dilatation': 0.3
    }
  },
  {
    id: 'sleepy',
    icon: '😴',
    label: 'Sleepy',
    units: {
      'eye-left-closure': 0.55,
      'eye-right-closure': 0.55,
      'eyebrows-left-up': 0.15,
      'eyebrows-right-up': 0.15
    }
  },
  {
    id: 'wink',
    icon: '😉',
    label: 'Wink',
    units: {
      'eye-left-closure': 1,
      'mouth-corner-puller': 0.5,
      'eyebrows-left-down': 0.3,
      'mouth-part-later': 0.2
    }
  }
]

export const EXPRESSION_BY_ID = new Map(EXPRESSIONS.map((e) => [e.id, e]))

/** Expression id → target weights (`expr/…` names). */
export function expressionWeights(id: string, amount = 1): Map<string, number> {
  const def = EXPRESSION_BY_ID.get(id)
  const out = new Map<string, number>()
  if (!def) return out
  for (const [unit, w] of Object.entries(def.units)) out.set(E + unit, w * amount)
  return out
}
