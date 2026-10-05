"""Turn public-domain Song/Yuan landscape paintings into transparent map sprites.

For each source painting:
  1. estimate the silk/paper colour as a smooth low-order field (iteratively
     re-fitted 2D quadratic over pixels that look like bare silk),
  2. flat-field the image by that field (silk -> 1.0),
  3. derive alpha from ink density (and, for blue-green, colour distance),
     suppress red seals, de-speckle,
  4. crop the listed regions, feather sides + dissolve the foot into "mist",
     trim, downscale, save .webp.

Sources (Wikimedia Commons originals, public domain — see
src/renderer/src/assets/ink/map/CREDITS.md) are expected in ./src/ as:
  fankuan.jpg     File:Fan_Kuan_-_Travelers_Among_Mountains_and_Streams_-_Google_Art_Project.jpg
  guoxi.jpg       File:Guo_Xi_-_Early_Spring_(large).jpg
  litang.jpg      File:Li_Tang_-_Wind_in_Pines_Among_a_Myriad_Valleys.jpg
  miyouren_met.jpg File:Mi_Youren_-_Cloudy_Mountains_-_1973.121.1_-_Metropolitan_Museum_of_Art.jpg
  huang.jpg       File:Huang_Gongwang._Dwelling_in_the_Fuchun_Mountains._detail._National_Palace_Museum,_Taipei.jpg
  wx1.jpg         File:Wang_Ximeng_-_A_Thousand_Li_of_River1.jpg
  wxbridge.jpg    File:Wang_Ximeng_-_A_Thousand_Li_of_River_(Bridge).jpg
  wxend.jpg       File:Wang_Ximeng_-_A_Thousand_Li_of_River_(End).jpg
Crops live in crops.json; sprites are written to ./out/ (copy them into
src/renderer/src/assets/ink/map/). Needs Python 3 + numpy, Pillow, opencv.

Usage: python process.py [only-name-substring]
"""
import json
import zlib
import os
import sys

import cv2
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src')
OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)

INK = np.array([28, 26, 23], np.float32)  # #1c1a17
PAPER = np.array([239, 231, 212], np.float32)  # #efe7d4

# name: (source, mode, x0, y0, x1, y1, opts)  — crop box as fractions
CROPS = json.load(open(os.path.join(HERE, 'crops.json'), encoding='utf-8'))
# per-source region used to fit the silk field (skips mounting / text panels)
FIT = {'wxend.jpg': (0.27, 0.0, 1.0, 1.0), 'miyouren_met.jpg': (0.12, 0.0, 0.88, 1.0)}


def load(name, maxdim=3000):
    im = Image.open(os.path.join(SRC, name)).convert('RGB')
    W, H = im.size
    s = min(1.0, maxdim / max(W, H))
    if s < 1:
        im = im.resize((round(W * s), round(H * s)), Image.LANCZOS)
    return np.asarray(im).astype(np.float32)


def silk_field(img, fit=None):
    """Smooth estimate of the bare silk colour at every pixel."""
    H, W, _ = img.shape
    sm = cv2.resize(img, (W // 8, H // 8), interpolation=cv2.INTER_AREA)
    region = np.ones(sm.shape[:2], bool)
    if fit:
        hh, ww = sm.shape[:2]
        region[:] = False
        region[int(fit[1] * hh) : int(fit[3] * hh), int(fit[0] * ww) : int(fit[2] * ww)] = True
    region = region.reshape(-1)
    h, w, _ = sm.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    xx /= w
    yy /= h
    A = np.stack([np.ones_like(xx), xx, yy, xx * xx, yy * yy, xx * yy], -1).reshape(-1, 6)
    L = sm.mean(-1).reshape(-1)
    pix = sm.reshape(-1, 3)
    # seed: the brighter half of the image is mostly silk
    mask = (L >= np.percentile(L[region], 55)) & region
    for _ in range(5):
        coef, *_ = np.linalg.lstsq(A[mask], L[mask], rcond=None)
        fit = A @ coef
        resid = L - fit
        sd = resid[mask].std()
        mask = (resid > -1.2 * sd) & region
    # per-channel fit on the final silk mask
    chans = []
    for c in range(3):
        coef, *_ = np.linalg.lstsq(A[mask], pix[mask, c], rcond=None)
        chans.append((A @ coef).reshape(h, w))
    field = np.stack(chans, -1)
    field = cv2.resize(field, (W, H), interpolation=cv2.INTER_CUBIC)
    noise = float(np.std(L[mask] - (A @ np.linalg.lstsq(A[mask], L[mask], rcond=None)[0])[mask]))
    return field, noise / max(1.0, float(L[mask].mean()))


def seal_mask(img):
    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    # cinnabar seals: red well above green, green ~ blue (ochre has g >> b)
    red = (r > g * 1.45) & (r > b * 1.4) & (r - g > 40) & (g < b * 1.3)
    red = cv2.dilate(red.astype(np.uint8), np.ones((9, 9), np.uint8))
    return red.astype(bool)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def window(h, w, o, seed):
    """Feather the crop: soft sides/top, a ragged misty dissolve at the foot."""
    rnd = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    u = xx / max(1, w - 1)
    v = yy / max(1, h - 1)
    side = o.get('side', 0.1)
    top = o.get('top', 0.04)
    foot = o.get('foot', 0.35)
    m = smoothstep(0, side, u) * smoothstep(0, side, 1 - u) * smoothstep(0, top, v)
    if foot > 0:
        # the mist line wanders: a smooth random curve across the width
        k = rnd.normal(0, 1, 8)
        curve = sum(k[i] * np.sin((i + 1) * np.pi * u + k[(i + 3) % 8]) for i in range(4)) * 0.025
        start = 1 - foot + curve
        m *= 1 - smoothstep(start, np.minimum(1.0, start + foot * 0.9), v)
    if o.get('oval'):
        d = ((u - 0.5) / 0.5) ** 2 + ((v - 0.55) / 0.55) ** 2
        m *= 1 - smoothstep(0.65, 1.0, d)
    return m


def process(name, spec, cache):
    src, mode, x0, y0, x1, y1 = spec[:6]
    o = spec[6] if len(spec) > 6 else {}
    if src not in cache:
        img = load(src)
        field, noise = silk_field(img, FIT.get(src))
        cache[src] = (img, field, noise, seal_mask(img))
    img, field, noise, seals = cache[src]
    H, W, _ = img.shape
    X0, Y0, X1, Y1 = int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)
    I = img[Y0:Y1, X0:X1]
    B = field[Y0:Y1, X0:X1]
    S = seals[Y0:Y1, X0:X1]
    ratio = np.clip(I / np.maximum(B, 1), 0, 1.6)
    lum = ratio @ np.array([0.3, 0.55, 0.15], np.float32)
    dens = np.clip(1 - lum, 0, 1)
    d0 = o.get('d0', max(0.05, noise * 2.2))
    d1 = o.get('d1', 0.75)
    gamma = o.get('gamma', 0.85)
    a_ink = np.clip((dens - d0) / (d1 - d0), 0, 1) ** gamma
    if mode == 'color':
        # mineral pigments: distance from bare silk in flat-fielded colour
        labI = cv2.cvtColor(np.ascontiguousarray(I / 255), cv2.COLOR_RGB2LAB)
        labB = cv2.cvtColor(np.ascontiguousarray(B / 255), cv2.COLOR_RGB2LAB)
        dist = np.sqrt(((labI - labB) ** 2).sum(-1))
        a_col = smoothstep(o.get('c0', 9.0), o.get('c1', 30.0), dist)
        alpha = np.maximum(a_ink, a_col)
    else:
        alpha = a_ink
    alpha = alpha * (~S)
    for ex0, ey0, ex1, ey1 in o.get('erase', []):
        h_, w_ = alpha.shape
        alpha[int(ey0 * h_) : int(ey1 * h_), int(ex0 * w_) : int(ex1 * w_)] = 0
    # de-speckle: kill isolated dots of silk texture
    a8 = (alpha * 255).astype(np.uint8)
    a8 = cv2.medianBlur(a8, 3)
    alpha = a8.astype(np.float32) / 255
    alpha *= window(*alpha.shape, o, zlib.crc32(name.encode()) % 9999)
    alpha *= o.get('amax', 1.0)

    if mode == 'color':
        # keep the pigment colour; remove the varnish cast with a partial
        # white balance toward paper, then lift a touch.
        # translate (not scale) in Lab: shift the silk colour toward paper so
        # pigments keep their relative hue instead of blowing out to cyan
        labP = cv2.cvtColor(np.ascontiguousarray((PAPER / 255).reshape(1, 1, 3)), cv2.COLOR_RGB2LAB)
        k = o.get('wb', 0.6)
        lab = labI + (labP - labB) * k
        lab[..., 1:] *= o.get('sat', 0.9)
        rgb = np.clip(cv2.cvtColor(lab.astype(np.float32), cv2.COLOR_LAB2RGB) * 255, 0, 255)
    else:
        # monochrome ink: constant ink tone, alpha carries the gradation;
        # very dense ink goes a little warmer-black
        rgb = np.broadcast_to(INK, I.shape).copy()

    # trim fully transparent margins
    ys, xs = np.where(alpha > 0.03)
    if len(ys) == 0:
        print('EMPTY', name)
        return None
    ty0, ty1, tx0, tx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgb = rgb[ty0:ty1, tx0:tx1]
    alpha = alpha[ty0:ty1, tx0:tx1]
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    im = Image.fromarray(out, 'RGBA')
    mx = o.get('max', 512)
    s = min(1.0, mx / max(im.size))
    if s < 1:
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    # foot anchor: lowest row with substantial alpha (relative), for placement
    a = np.asarray(im)[..., 3].astype(np.float32) / 255
    rows = a.mean(1)
    foot_y = float(np.where(rows > rows.max() * 0.25)[0].max() / im.height)
    path = os.path.join(OUT, name + '.webp')
    im.save(path, 'WEBP', quality=o.get('q', 82), method=6)
    return dict(name=name, w=im.width, h=im.height, foot=round(foot_y, 3), bytes=os.path.getsize(path))


def contact(results, path):
    pad = 16
    cols = 4
    cell = 300
    rows = (len(results) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * (cell + pad) + pad, rows * (cell + pad + 18) + pad), tuple(int(c) for c in PAPER))
    from PIL import ImageDraw

    d = ImageDraw.Draw(sheet)
    for i, r in enumerate(results):
        im = Image.open(os.path.join(OUT, r['name'] + '.webp'))
        s = min(cell / im.width, cell / im.height)
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
        cx = pad + (i % cols) * (cell + pad)
        cy = pad + (i // cols) * (cell + pad + 18)
        sheet.paste(im, (cx + (cell - im.width) // 2, cy + (cell - im.height)), im)
        d.text((cx, cy + cell + 2), f"{r['name']} {r['w']}x{r['h']} {r['bytes']//1024}k", fill=(120, 30, 20))
    sheet.save(path)


if __name__ == '__main__':
    only = sys.argv[1] if len(sys.argv) > 1 else ''
    cache = {}
    res = []
    for name, spec in CROPS.items():
        if only and only not in name:
            continue
        r = process(name, spec, cache)
        if r:
            res.append(r)
            print(r)
    contact(res, os.path.join(HERE, 'contact' + ('_' + only if only else '') + '.png'))
    if not only:
        json.dump({r['name']: r for r in res}, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)
        print('total KB', sum(r['bytes'] for r in res) // 1024)
