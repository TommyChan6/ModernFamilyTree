"""Per-vertex region masks for the 3D human (called by build.py).

Every mask is a float 0..1 per compact vertex, authored in the hm08 base
mesh's own frame (decimetres, +y up, +z forward; eyes at y≈7.28, nose tip
z≈1.68, mouth y≈6.61, chin y≈6.07, crown y≈8.49). Masks are topological — they
ride every morph — and the runtime subdivides them like positions.

  scalp      hair-root region (hairline with temples, sideburns, nape)
  browU      0 inner … 1 outer along each eyebrow (0 off-brow)
  browV      across the brow: 0.5 on the brow's centre line, ±0.25 dm → 0/1
  brow       soft eyebrow band (where brow strands may root)
  beard      full beard area (cheeks, jaw, chin, upper lip, under-jaw)
  mustache   upper lip band
  goatee     chin below the lower lip
  sideburn   in front of the ears
  neck       beard under the jaw / down the throat
  lips       vermilion (from the lip-volume targets' displacement)
  flush      cheeks / nose / ears — where blood shows (blush, cold, rosacea)
  eyeUpper   upper lid + crease (eyeshadow)
  eyeLower   under-eye (dark circles, lower liner)
  thin       translucency: ears, nostrils, fingers
"""

import numpy as np


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def compute_masks(ctx):
    P = ctx['POS']
    NK = ctx['NK']
    x, y, z = P[:NK, 0], P[:NK, 1], P[:NK, 2]
    ax = np.abs(x)
    TD = ctx['TD']
    BONES = ctx['BONES']
    SI, SW = ctx['SKIN_I'], ctx['SKIN_W'] / 255.0
    is_body = np.zeros(NK, bool)
    for fv in ctx['face_groups']['body'][0]:
        is_body[fv] = True

    def bone_weight(pred):
        ids = [i for i, b in enumerate(BONES) if pred(b)]
        w = np.zeros(NK)
        for j in range(4):
            w += np.where(np.isin(SI[:, j], ids), SW[:, j], 0)
        return w

    # Adjacency for smoothing
    nbrs = [set() for _ in range(NK)]
    for g, (fv, _) in ctx['face_groups'].items():
        for q in fv:
            for c in range(4):
                a, b = q[c], q[(c + 1) % 4]
                nbrs[a].add(b)
                nbrs[b].add(a)

    def smooth(m, it=2):
        m = m.copy()
        for _ in range(it):
            out = m.copy()
            for i in range(NK):
                if nbrs[i]:
                    out[i] = 0.5 * m[i] + 0.5 * np.mean([m[j] for j in nbrs[i]])
            m = out
        return m

    head = bone_weight(lambda b: b in ('head', 'jaw') or b.startswith(('levator', 'oris', 'oculi',
                                                                         'orbicularis', 'risorius',
                                                                         'temporalis', 'special')))
    out = {}

    # ── Ears (shared by several masks) ───────────────────────────────────────
    ear_c = np.array([0.80, 7.24, 0.33])
    d_ear = np.sqrt((ax - ear_c[0]) ** 2 * 1.0 + ((y - ear_c[1]) / 1.5) ** 2 + (z - ear_c[2]) ** 2)
    ear = (1 - smoothstep(0.17, 0.26, d_ear)) * smoothstep(0.66, 0.74, ax)

    # ── Scalp ────────────────────────────────────────────────────────────────
    cz = 0.42
    theta = np.degrees(np.arctan2(ax, z - cz))  # 0 = front, 180 = back
    # hairline height by azimuth: forehead, temple dip, sideburn, behind ear, nape
    keys_t = np.array([0, 22, 40, 62, 78, 96, 112, 135, 180])
    keys_y = np.array([7.93, 7.91, 7.80, 7.66, 7.05, 7.30, 7.10, 6.86, 6.70])
    yh = np.interp(theta, keys_t, keys_y)
    scalp = smoothstep(yh - 0.05, yh + 0.07, y) * (y > 6.4)
    scalp *= 1 - ear
    scalp *= smoothstep(0.55, 0.85, head + (y > 7.6))
    out['scalp'] = smooth(scalp, 2) * is_body

    # ── Eyebrows ─────────────────────────────────────────────────────────────
    t = (ax - 0.08) / (0.66 - 0.08)  # inner → outer
    yc = 7.455 + 0.06 * np.sin(np.clip(t, 0, 1) * np.pi * 0.85) - 0.05 * np.clip(t - 0.75, 0, 1) * 4
    v = (y - yc)
    front = smoothstep(0.85, 1.15, z)
    band = (1 - smoothstep(0.05, 0.11, np.abs(v))) * smoothstep(-0.12, 0.02, t) * (1 - smoothstep(0.98, 1.12, t))
    brow = band * front * is_body
    out['brow'] = brow
    out['browU'] = np.clip(t, 0, 1) * (brow > 0.01)
    out['browV'] = np.clip(0.5 + v / 0.5, 0, 1) * (brow > 0.01)

    # ── Beard zones ──────────────────────────────────────────────────────────
    y_cheek = 6.76 + np.clip(ax - 0.24, 0, None) / 0.46 * 0.40  # cheek line: nose ala → sideburn
    in_front_of_ear = smoothstep(0.30, 0.48, z - (ax - 0.55) * 0.9)
    upper = 1 - smoothstep(y_cheek - 0.03, y_cheek + 0.05, y)
    under = smoothstep(5.98, 6.08, y)  # throat floor (just under the Adam's apple)
    beard = upper * under * in_front_of_ear * (1 - ear)
    # keep it off the back of the neck: only the front/side half
    beard *= smoothstep(-0.05, 0.25, z - 0.25 * (ax / 0.7) ** 2) * smoothstep(0.35, 0.55, z + (y - 6.3).clip(0) * 2)
    lips_raw = np.zeros(NK)
    for name in ('mouth-upperlip-volume-incr', 'mouth-lowerlip-volume-incr'):
        if name in TD:
            lips_raw = np.maximum(lips_raw, np.linalg.norm(TD[name][:NK], axis=1))
    lips = smoothstep(0.25, 0.6, lips_raw / max(lips_raw.max(), 1e-9)) * is_body
    lips = smooth(lips, 1)
    out['lips'] = lips
    beard *= 1 - smoothstep(0.15, 0.5, lips)
    out['beard'] = smooth(beard, 2) * is_body

    mustache = smoothstep(6.62, 6.67, y) * (1 - smoothstep(6.79, 6.84, y)) * (1 - smoothstep(0.26, 0.36, ax))
    mustache *= smoothstep(1.25, 1.4, z) * (1 - smoothstep(0.2, 0.5, lips))
    out['mustache'] = smooth(mustache, 1) * is_body
    goatee = (1 - smoothstep(6.47, 6.53, y)) * smoothstep(5.98, 6.1, y) * (1 - smoothstep(0.22, 0.32, ax))
    goatee *= smoothstep(0.9, 1.15, z) * (1 - smoothstep(0.2, 0.5, lips))
    out['goatee'] = smooth(goatee, 1) * is_body
    sideburn = smoothstep(0.58, 0.68, ax) * smoothstep(6.95, 7.05, y) * (1 - smoothstep(7.32, 7.42, y))
    sideburn *= in_front_of_ear * (1 - ear)
    out['sideburn'] = smooth(sideburn, 1) * is_body
    # under the jaw line: below the chin's front plane
    neck = 1 - smoothstep(6.08, 6.22, y + np.clip(z - 1.0, 0, None) * 0.5)
    out['neck'] = smooth(neck * out['beard'], 1)

    # ── Flush (cheeks, nose, ears) ───────────────────────────────────────────
    cheek = 1 - smoothstep(0.08, 0.32, np.sqrt((ax - 0.46) ** 2 + ((y - 6.98) * 1.2) ** 2 + (z - 1.22) ** 2))
    nose = 1 - smoothstep(0.05, 0.24, np.sqrt(x ** 2 + ((y - 6.95) * 0.8) ** 2 + (z - 1.6) ** 2))
    out['flush'] = smooth(np.clip(np.maximum.reduce([cheek, nose * 0.8, ear * 0.7]), 0, 1), 1) * is_body

    # ── Around the eyes ──────────────────────────────────────────────────────
    ex = ax - 0.308
    ey = y - 7.284
    rr = np.sqrt((ex / 1.25) ** 2 + ey ** 2)
    near = smoothstep(0.7, 1.0, z)
    out['eyeUpper'] = smooth((1 - smoothstep(0.08, 0.24, rr)) * smoothstep(-0.02, 0.04, ey) * near, 1) * is_body
    out['eyeLower'] = smooth((1 - smoothstep(0.08, 0.22, rr)) * (1 - smoothstep(-0.03, 0.01, ey)) * near, 1) * is_body

    # ── Wrinkle zones (the shader draws the lines; these say where) ─────────
    out['forehead'] = smooth(smoothstep(7.56, 7.64, y) * (1 - smoothstep(7.82, 7.92, y)) *
                             (1 - smoothstep(0.45, 0.6, ax)) * smoothstep(1.0, 1.2, z), 1) * is_body
    crow = 1 - smoothstep(0.05, 0.16, np.sqrt((ax - 0.62) ** 2 + (y - 7.27) ** 2 + ((z - 1.0) * 0.6) ** 2))
    out['crow'] = smooth(crow, 1) * is_body
    # nasolabial fold: the line from the nose wing to just outside the mouth corner
    a = np.array([0.20, 6.86])
    b = np.array([0.33, 6.52])
    pq = np.stack([ax, y], 1) - a
    ab = b - a
    tt = np.clip(pq @ ab / (ab @ ab), 0, 1)
    dist = np.linalg.norm(pq - tt[:, None] * ab, axis=1)
    out['naso'] = smooth((1 - smoothstep(0.02, 0.07, dist)) * smoothstep(1.15, 1.3, z), 1) * is_body

    # ── Translucency ─────────────────────────────────────────────────────────
    fingers = bone_weight(lambda b: b.startswith('finger'))
    nostril = 1 - smoothstep(0.05, 0.16, np.sqrt((ax - 0.13) ** 2 + (y - 6.86) ** 2 + (z - 1.48) ** 2))
    out['thin'] = np.clip(np.maximum.reduce([ear, nostril * 0.6, fingers * 0.7]), 0, 1) * is_body
    return out
