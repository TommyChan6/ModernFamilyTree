"""Compile MakeHuman's CC0 human (base mesh hm08 + morph targets + skeleton +
skin weights) into ONE compact gzip binary for the Character view's 3D style.

Source: https://github.com/makehumancommunity/makehuman (assets are CC0 1.0 —
see src/renderer/src/components/character/human3d/assets/CREDITS.md). Clone it
(a sparse checkout of makehuman/data is enough) and point MH_DATA at
`makehuman/data`:

  git clone --depth 1 --filter=blob:none --sparse \
      https://github.com/makehumancommunity/makehuman.git mh
  cd mh && git sparse-checkout set makehuman/data/3dobjs makehuman/data/targets \
      makehuman/data/rigs
  MH_DATA=mh/makehuman/data python scripts/human3d/build.py

What goes in (decimetres, +y up, +z forward, the character's left at +x):
  * vertices: the body + the helpers we render or fit to (tongue, eyes, teeth,
    eyelash lines, skirt) remapped to a compact index space, plus one VIRTUAL
    vertex per skeleton joint (the joint's vertex-list centroid) appended at
    the end — so every target carries its joint deltas and the skeleton re-fits
    to any shape for free;
  * faces: quads (all hm08 faces are quads) + per-corner UVs, grouped;
  * skeleton: bones parent-first with head/tail joint (virtual vertex) ids;
  * weights: top-4 bone influences per vertex (uint8 bone id, uint8 weight);
  * targets: sparse (uint16 vertex, 3x int16 delta * per-target scale) — the
    macro set (ethnic/universal/height/proportions/breast — no infant targets,
    height/proportions only at average muscle+weight), every local modelling
    target the UI exposes, and the caucasian expression units;
  * region masks: per-vertex uint8 channels the skin/hair/clothing code reads
    (scalp, brows, beard zones, lips, flush, translucency, …) — see masks().

Output: src/renderer/src/components/character/human3d/assets/human3d.bin
(gzip of: 'HM3D' u32 version, u32 json length, json, pad to 4, binary blob).
Needs Python 3 + numpy.
"""

import glob
import gzip
import json
import os
import struct
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'src', 'renderer', 'src', 'components', 'character', 'human3d', 'assets',
                   'human3d.bin')
DATA = os.environ.get('MH_DATA') or (sys.argv[1] if len(sys.argv) > 1 else None)
if not DATA or not os.path.isdir(DATA):
    sys.exit('Set MH_DATA to a makehuman/data directory (see the docstring).')
TARGETS = os.path.join(DATA, 'targets')

# ── Base mesh ────────────────────────────────────────────────────────────────
KEEP_GROUPS = [
    'body',
    'helper-tongue',
    'helper-l-eye',
    'helper-r-eye',
    'helper-upper-teeth',
    'helper-lower-teeth',
    'helper-l-eyelashes-1',
    'helper-l-eyelashes-2',
    'helper-r-eyelashes-1',
    'helper-r-eyelashes-2',
    'helper-skirt',
]

verts, uvs, faces = [], [], []  # faces: (group, [v0..3], [t0..3])
group = None
with open(os.path.join(DATA, '3dobjs', 'base.obj')) as fh:
    for line in fh:
        if line.startswith('v '):
            verts.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('vt '):
            uvs.append([float(x) for x in line.split()[1:3]])
        elif line.startswith('g '):
            group = line.split()[1]
        elif line.startswith('f '):
            corners = [c.split('/') for c in line.split()[1:]]
            faces.append((group, [int(c[0]) - 1 for c in corners], [int(c[1]) - 1 for c in corners]))
V = np.array(verts, np.float64)
UV = np.array(uvs, np.float64)
NV0 = len(V)
assert all(len(f[1]) == 4 for f in faces), 'hm08 is all quads'

group_verts = {}
for g, vs, _ in faces:
    group_verts.setdefault(g, set()).update(vs)
keep = sorted(set().union(*[group_verts[g] for g in KEEP_GROUPS]))
remap = np.full(NV0, -1, np.int64)
remap[keep] = np.arange(len(keep))
NK = len(keep)

# ── Skeleton + virtual joint vertices ────────────────────────────────────────
skel = json.load(open(os.path.join(DATA, 'rigs', 'default.mhskel')))
joint_defs = skel['joints']  # joint name -> [original vertex ids]


def bone_order():
    bones = skel['bones']
    out, seen = [], set()

    def visit(name):
        if name in seen:
            return
        parent = bones[name]['parent']
        if parent:
            visit(parent)
        seen.add(name)
        out.append(name)

    for name in sorted(bones):
        visit(name)
    return out


BONES = bone_order()
used_joints = []
for b in BONES:
    for k in ('head', 'tail'):
        j = skel['bones'][b][k]
        if j not in used_joints:
            used_joints.append(j)
joint_index = {j: NK + i for i, j in enumerate(used_joints)}
NVERT = NK + len(used_joints)
assert NVERT < 65536


def expand(delta_full):
    """(NV0,3) per-original-vertex array -> (NVERT,3) compact + joint centroids."""
    out = np.zeros((NVERT, 3), np.float64)
    out[:NK] = delta_full[keep]
    for j, idx in joint_index.items():
        out[idx] = delta_full[joint_defs[j]].mean(axis=0)
    return out


POS = expand(V)

bone_json = []
for b in BONES:
    d = skel['bones'][b]
    bone_json.append({
        'name': b,
        'parent': BONES.index(d['parent']) if d['parent'] else -1,
        'head': joint_index[d['head']],
        'tail': joint_index[d['tail']],
    })

# ── Skin weights: top 4 per kept vertex ──────────────────────────────────────
mhw = json.load(open(os.path.join(DATA, 'rigs', 'default_weights.mhw')))['weights']
per_vert = [[] for _ in range(NK)]
for bname, pairs in mhw.items():
    if bname not in BONES:
        continue
    bi = BONES.index(bname)
    for v, w in pairs:
        k = remap[v]
        if k >= 0 and w > 0:
            per_vert[k].append((w, bi))
SKIN_I = np.zeros((NK, 4), np.uint8)
SKIN_W = np.zeros((NK, 4), np.uint8)
head_bone = BONES.index('head')
for k, lst in enumerate(per_vert):
    lst.sort(reverse=True)
    lst = lst[:4]
    if not lst:
        lst = [(1.0, head_bone)]
    tot = sum(w for w, _ in lst)
    q = [int(round(255 * w / tot)) for w, _ in lst]
    q[0] += 255 - sum(q)
    for i, (w, bi) in enumerate(lst):
        SKIN_I[k, i] = bi
        SKIN_W[k, i] = q[i]
assert len(BONES) < 256

# ── Faces per group (compact vertex ids) + per-corner UVs ────────────────────
face_groups = {}
for g, vs, ts in faces:
    if g not in KEEP_GROUPS:
        continue
    fg = face_groups.setdefault(g, ([], []))
    fg[0].append([remap[v] for v in vs])
    fg[1].append(ts)
used_uv = sorted({t for g in face_groups for f in face_groups[g][1] for t in f})
uv_remap = {t: i for i, t in enumerate(used_uv)}
UVS = UV[used_uv].astype(np.float32)

# ── Targets ──────────────────────────────────────────────────────────────────


def read_target(path):
    d = np.zeros((NV0, 3), np.float64)
    with open(path) as fh:
        for line in fh:
            if not line.strip() or line.startswith('#'):
                continue
            p = line.split()
            d[int(p[0])] = (float(p[1]), float(p[2]), float(p[3]))
    return d


def target_files():
    out = []  # (name, path)
    md = os.path.join(TARGETS, 'macrodetails')
    for p in sorted(glob.glob(os.path.join(md, '*.target'))):
        b = os.path.basename(p)[:-7]
        if 'baby' in b:
            continue
        out.append(('macro/' + b, p))
    for sub in ('height', 'proportions'):
        for p in sorted(glob.glob(os.path.join(md, sub, '*.target'))):
            b = os.path.basename(p)[:-7]
            if 'baby' in b or 'averagemuscle-averageweight' not in b:
                continue
            out.append((sub + '/' + b, p))
    for p in sorted(glob.glob(os.path.join(TARGETS, 'breast', '*.target'))):
        b = os.path.basename(p)[:-7]
        if b.startswith(('breast-', 'nipple-')):
            out.append((b, p))
        elif 'baby' not in b and 'averagemuscle-averageweight' in b:
            out.append(('breast/' + b, p))
    for g in ('head', 'forehead', 'eyebrows', 'neck', 'eyes', 'nose', 'mouth', 'ears', 'chin',
              'cheek', 'torso', 'hip', 'stomach', 'buttocks', 'armslegs', 'measure'):
        for p in sorted(glob.glob(os.path.join(TARGETS, g, '*.target'))):
            out.append((os.path.basename(p)[:-7], p))
    for p in sorted(glob.glob(os.path.join(TARGETS, 'expression', 'units', 'caucasian', '*.target'))):
        out.append(('expr/' + os.path.basename(p)[:-7], p))
    return out


THRESH = 2e-5  # dm — smaller deltas are noise
blob = bytearray()
target_json = []
TARGET_DELTAS = {}  # name -> (NVERT,3) for the mask heuristics below


def align(n=4):
    while len(blob) % n:
        blob.append(0)


for name, path in target_files():
    d = expand(read_target(path))
    mag = np.abs(d).max(axis=1)
    idx = np.nonzero(mag > THRESH)[0]
    if not len(idx):
        continue
    TARGET_DELTAS[name] = d
    vals = d[idx]
    scale = float(np.abs(vals).max()) / 32767.0
    q = np.round(vals / scale).astype(np.int16)
    align(2)
    off_i = len(blob)
    blob += idx.astype(np.uint16).tobytes()
    off_d = len(blob)
    blob += q.tobytes()
    target_json.append({'name': name, 'n': int(len(idx)), 'scale': scale, 'idx': off_i, 'd': off_d})

print(f'{len(target_json)} targets, {len(blob) / 1e6:.2f} MB of target data')

# ── Region masks (per compact vertex, 0..255) ────────────────────────────────
sys.path.insert(0, HERE)
from masks import compute_masks  # noqa: E402

MASKS = compute_masks({
    'POS': POS, 'NK': NK, 'keep': keep, 'remap': remap, 'face_groups': face_groups,
    'TD': TARGET_DELTAS, 'SKIN_I': SKIN_I, 'SKIN_W': SKIN_W, 'BONES': BONES,
    'UVS': UVS, 'uv_remap': uv_remap,
})

# ── Assemble ─────────────────────────────────────────────────────────────────
buffers = {}


def put(name, arr):
    align(4)
    buffers[name] = {'off': len(blob), 'len': int(arr.size), 'type': str(arr.dtype)}
    blob.extend(arr.tobytes())


put('pos', POS.astype(np.float32).ravel())
put('uv', UVS.ravel())
put('skinIndex', SKIN_I.ravel())
put('skinWeight', SKIN_W.ravel())
groups_json = {}
for g, (fv, ft) in face_groups.items():
    key = g.replace('helper-', '')
    put('quads:' + key, np.array(fv, np.uint16).ravel())
    put('quadUV:' + key, np.array([[uv_remap[t] for t in f] for f in ft], np.uint16).ravel())
    groups_json[key] = {'quads': len(fv)}
for name, m in MASKS.items():
    put('mask:' + name, np.clip(np.round(m * 255), 0, 255).astype(np.uint8))

header = json.dumps({
    'units': 'dm',
    'vertexCount': NVERT,
    'meshVertexCount': NK,
    'joints': used_joints,
    'bones': bone_json,
    'groups': groups_json,
    'buffers': buffers,
    'targets': target_json,
    'masks': sorted(MASKS),
    'source': 'MakeHuman hm08 (CC0 1.0)',
}, separators=(',', ':')).encode()
pad = (-(12 + len(header))) % 4
payload = b'HM3D' + struct.pack('<II', 1, len(header) + pad) + header + b' ' * pad + bytes(blob)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'wb') as fh:
    fh.write(gzip.compress(payload, 9, mtime=0))
print(f'wrote {OUT}: {len(payload) / 1e6:.2f} MB raw, {os.path.getsize(OUT) / 1e6:.2f} MB gzip')
