// A projecting stand-in for a CanvasRenderingContext2D: the Timeline's 2D
// layers (year grid, labels, chronicle, edit ghosts, the ink sheet) keep
// drawing in FLAT stage px and this wrapper lays it all on the tilted board
// (timelineTilt.ts / coords.js). It is only handed out while the view is
// tilted — flat, the renderers draw on the raw context, untouched.
//
// Three modes, kept on a stack with save() / restore():
//   board     (default) coordinates are flat board points: path vertices are
//             projected (straight lines stay straight under the homography)
//             and clipped to the in-front half plane; arcs / text / small
//             images / rounded pills become billboards at their projected
//             point, scaled by the perspective there.
//   billboard inside group(ax, ay, h, fn): a little upright picture standing
//             at the anchor — local coords map by X + (p − a)·s (labels,
//             badges, pills keep their shape and stay together).
//   native    after translate(): the real transform (drawIcon, seals, rotated
//             chips) — the translate point itself is projected and scaled by
//             the perspective, so those draw as billboards too.

import {
  billboardFrame,
  boardDepth,
  clipPolygonNear,
  clipSegmentNear,
  nearLimit,
  projectFlat,
  type BillboardFrame,
  type ScreenPt
} from './timelineTilt'
import type { ViewTransform } from '../graph/webgl/coords.js'

const BOARD = 0,
  NATIVE = 1,
  LOCAL = 2

interface Mode {
  k: number
  g: BillboardFrame | null
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Ctx = CanvasRenderingContext2D & { [key: string]: any }

export class TiltCanvas {
  raw: Ctx
  view: ViewTransform
  lim = Infinity
  /** The proxy the drawing code receives in place of the raw context. */
  ctx: Ctx
  private mode: Mode = { k: BOARD, g: null }
  private stack: Mode[] = []
  private penX = NaN
  private penY = NaN
  private needMove = true
  private bound = new Map<PropertyKey, any>()
  private over: Record<string, (...a: any[]) => any>

  constructor(raw: CanvasRenderingContext2D, view: ViewTransform) {
    this.raw = raw as Ctx
    this.view = view
    this.over = this._overrides()
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- closures over the proxy
    const self = this
    this.ctx = new Proxy(this.raw, {
      get(target, prop) {
        if (prop === '__tilt') return self
        if (prop === 'raw') return target
        const o = typeof prop === 'string' ? self.over[prop] : undefined
        if (o) return o
        const v = (target as any)[prop]
        if (typeof v !== 'function') return v
        let b = self.bound.get(prop)
        if (!b) self.bound.set(prop, (b = v.bind(target)))
        return b
      },
      set(target, prop, value) {
        ;(target as any)[prop] = value
        return true
      }
    }) as Ctx
  }

  /** New camera / viewport for this frame. */
  setView(view: ViewTransform): void {
    this.view = view
    this.lim = nearLimit(view)
    this.mode = { k: BOARD, g: null }
    this.stack.length = 0
  }

  /** Draw `fn` as a billboard standing at flat (ax, ay), lifted h px. Returns
   *  the frame it used (null = behind the camera, nothing drawn). */
  group(ax: number, ay: number, h: number, fn: () => void): BillboardFrame | null {
    const g = billboardFrame(ax, ay, h, this.view)
    if (!g) return null
    this.stack.push(this.mode)
    this.mode = { k: LOCAL, g }
    try {
      fn()
    } finally {
      this.mode = this.stack.pop() || { k: BOARD, g: null }
    }
    return g
  }

  // ── mapping ──
  private front(x: number, y: number): boolean {
    return boardDepth(x, y, this.view) <= this.lim
  }
  private P(x: number, y: number): ScreenPt {
    const m = this.mode
    if (m.k === LOCAL && m.g) {
      const g = m.g
      return { x: g.X + (x - g.ax) * g.s, y: g.Y + (y - g.ay) * g.s, s: g.s }
    }
    return projectFlat(x, y, this.view)
  }

  private _overrides(): Record<string, (...a: any[]) => any> {
    const raw = this.raw
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- closures over the proxy
    const self = this
    const native = () => self.mode.k === NATIVE
    const board = () => self.mode.k === BOARD
    // Board-mode billboard about a centre: (x, y, w, h) → the projected rect.
    const centred = (x: number, y: number, w: number, h: number) => {
      const P = self.P(x + w / 2, y + h / 2)
      return { x: P.x - (w / 2) * P.s, y: P.y - (h / 2) * P.s, w: w * P.s, h: h * P.s, s: P.s }
    }
    const mapRect = (x: number, y: number, w: number, h: number) => {
      const a = self.P(x, y)
      return { x: a.x, y: a.y, w: w * a.s, h: h * a.s, s: a.s }
    }
    const polygon = (x: number, y: number, w: number, h: number): Path2D | null => {
      const pts = clipPolygonNear([x, y, x + w, y, x + w, y + h, x, y + h], self.view, self.lim)
      if (pts.length < 6) return null
      const path = new Path2D()
      for (let i = 0; i < pts.length; i += 2) {
        const p = projectFlat(pts[i], pts[i + 1], self.view)
        if (i === 0) path.moveTo(p.x, p.y)
        else path.lineTo(p.x, p.y)
      }
      path.closePath()
      return path
    }
    const text = (fill: boolean) =>
      function (t: string, x: number, y: number, ...rest: number[]) {
        const draw = fill ? raw.fillText : raw.strokeText
        if (native()) return draw.call(raw, t, x, y, ...rest)
        if (board() && !self.front(x, y)) return
        const P = self.P(x, y)
        raw.save()
        raw.translate(P.x, P.y)
        raw.scale(P.s, P.s)
        draw.call(raw, t, 0, 0, ...rest)
        raw.restore()
      }
    return {
      save() {
        self.stack.push(self.mode)
        raw.save()
      },
      restore() {
        self.mode = self.stack.pop() || { k: BOARD, g: null }
        raw.restore()
      },
      setTransform(...a: any[]) {
        ;(raw.setTransform as any)(...a)
        self.mode = { k: BOARD, g: null }
      },
      translate(x: number, y: number) {
        if (native()) return raw.translate(x, y)
        const P = self.P(x, y)
        raw.translate(P.x, P.y)
        raw.scale(P.s, P.s)
        self.mode = { k: NATIVE, g: null }
      },
      beginPath() {
        self.needMove = true
        self.penX = self.penY = NaN
        raw.beginPath()
      },
      moveTo(x: number, y: number) {
        if (native()) return raw.moveTo(x, y)
        self.penX = x
        self.penY = y
        if (board() && !self.front(x, y)) {
          self.needMove = true
          return
        }
        const P = self.P(x, y)
        raw.moveTo(P.x, P.y)
        self.needMove = false
      },
      lineTo(x: number, y: number) {
        if (native()) return raw.lineTo(x, y)
        if (!board()) {
          const P = self.P(x, y)
          return raw.lineTo(P.x, P.y)
        }
        const x0 = self.penX,
          y0 = self.penY
        self.penX = x
        self.penY = y
        if (!Number.isFinite(x0 + y0)) {
          // no current point: a lineTo starts the subpath
          if (self.front(x, y)) {
            const P = self.P(x, y)
            raw.moveTo(P.x, P.y)
            self.needMove = false
          }
          return
        }
        const c = clipSegmentNear(x0, y0, x, y, self.view, self.lim)
        if (!c) {
          self.needMove = true
          return
        }
        if (self.needMove || c.t0 > 0) {
          const A = projectFlat(c.x0, c.y0, self.view)
          raw.moveTo(A.x, A.y)
        }
        const B = projectFlat(c.x1, c.y1, self.view)
        raw.lineTo(B.x, B.y)
        self.needMove = c.t1 < 1
      },
      quadraticCurveTo(cx: number, cy: number, x: number, y: number) {
        if (native()) return raw.quadraticCurveTo(cx, cy, x, y)
        if (board() && !(self.front(cx, cy) && self.front(x, y) && !self.needMove))
          return self.over.lineTo(x, y)
        const C = self.P(cx, cy),
          E = self.P(x, y)
        self.penX = x
        self.penY = y
        raw.quadraticCurveTo(C.x, C.y, E.x, E.y)
      },
      bezierCurveTo(ax: number, ay: number, bx: number, by: number, x: number, y: number) {
        if (native()) return raw.bezierCurveTo(ax, ay, bx, by, x, y)
        if (
          board() &&
          !(self.front(ax, ay) && self.front(bx, by) && self.front(x, y) && !self.needMove)
        )
          return self.over.lineTo(x, y)
        const A = self.P(ax, ay),
          B = self.P(bx, by),
          E = self.P(x, y)
        self.penX = x
        self.penY = y
        raw.bezierCurveTo(A.x, A.y, B.x, B.y, E.x, E.y)
      },
      arc(x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean) {
        if (native()) return raw.arc(x, y, r, a0, a1, ccw)
        if (board() && !self.front(x, y)) return
        const P = self.P(x, y)
        self.penX = x
        self.penY = y
        self.needMove = false
        raw.arc(P.x, P.y, Math.max(0, r * P.s), a0, a1, ccw)
      },
      ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number) {
        if (native()) return raw.ellipse(x, y, rx, ry, rot, a0, a1)
        if (board() && !self.front(x, y)) return
        const P = self.P(x, y)
        raw.ellipse(P.x, P.y, Math.max(0, rx * P.s), Math.max(0, ry * P.s), rot, a0, a1)
      },
      arcTo(x1: number, y1: number, x2: number, y2: number, r: number) {
        if (native()) return raw.arcTo(x1, y1, x2, y2, r)
        if (board() && !(self.front(x1, y1) && self.front(x2, y2))) return
        const A = self.P(x1, y1),
          B = self.P(x2, y2)
        self.penX = x1
        self.penY = y1
        raw.arcTo(A.x, A.y, B.x, B.y, Math.max(0, r * A.s))
      },
      rect(x: number, y: number, w: number, h: number) {
        if (native()) return raw.rect(x, y, w, h)
        if (!board()) {
          const q = mapRect(x, y, w, h)
          return raw.rect(q.x, q.y, q.w, q.h)
        }
        const pts = clipPolygonNear([x, y, x + w, y, x + w, y + h, x, y + h], self.view, self.lim)
        for (let i = 0; i < pts.length; i += 2) {
          const p = projectFlat(pts[i], pts[i + 1], self.view)
          if (i === 0) raw.moveTo(p.x, p.y)
          else raw.lineTo(p.x, p.y)
        }
        if (pts.length) raw.closePath()
      },
      roundRect(x: number, y: number, w: number, h: number, r: any) {
        if (native()) return (raw as any).roundRect(x, y, w, h, r)
        if (board() && !self.front(x + w / 2, y + h / 2)) return
        const q = board() ? centred(x, y, w, h) : mapRect(x, y, w, h)
        const rr = Array.isArray(r) ? r.map((v: number) => v * q.s) : (r ?? 0) * q.s
        ;(raw as any).roundRect(q.x, q.y, q.w, q.h, rr)
      },
      fillRect(x: number, y: number, w: number, h: number) {
        if (native()) return raw.fillRect(x, y, w, h)
        if (!board()) {
          const q = mapRect(x, y, w, h)
          return raw.fillRect(q.x, q.y, q.w, q.h)
        }
        const p = polygon(x, y, w, h)
        if (p) raw.fill(p)
      },
      strokeRect(x: number, y: number, w: number, h: number) {
        if (native()) return raw.strokeRect(x, y, w, h)
        if (!board()) {
          const q = mapRect(x, y, w, h)
          return raw.strokeRect(q.x, q.y, q.w, q.h)
        }
        const p = polygon(x, y, w, h)
        if (p) raw.stroke(p)
      },
      clearRect(x: number, y: number, w: number, h: number) {
        raw.clearRect(x, y, w, h) // only ever used for full-canvas clears
      },
      fillText: text(true),
      strokeText: text(false),
      drawImage(img: CanvasImageSource, ...a: number[]) {
        if (native()) return (raw.drawImage as any)(img, ...a)
        // normalise to source rect + destination rect
        const iw = (img as any).width || 0,
          ih = (img as any).height || 0
        let sx = 0,
          sy = 0,
          sw = iw,
          sh = ih,
          dx: number,
          dy: number,
          dw: number,
          dh: number
        if (a.length >= 8) [sx, sy, sw, sh, dx, dy, dw, dh] = a
        else if (a.length >= 4) [dx, dy, dw, dh] = a
        else {
          ;[dx, dy] = a
          dw = iw
          dh = ih
        }
        if (!board()) {
          const q = mapRect(dx, dy, dw, dh)
          return raw.drawImage(img, sx, sy, sw, sh, q.x, q.y, q.w, q.h)
        }
        if (dw > 60 && dw > dh * 4) {
          // A long strip (a brushed rule across the sheet): lay it along its
          // centre line — clipped in front, mapped by an affine through the
          // projected ends.
          const yc = dy + dh / 2
          const c = clipSegmentNear(dx, yc, dx + dw, yc, self.view, self.lim)
          if (!c) return
          const A = projectFlat(c.x0, c.y0, self.view),
            B = projectFlat(c.x1, c.y1, self.view)
          const len = Math.hypot(B.x - A.x, B.y - A.y)
          if (!(len > 0.5)) return
          const hh = dh * ((A.s + B.s) / 2)
          const ux = (B.x - A.x) / len,
            uy = (B.y - A.y) / len
          raw.save()
          raw.transform(ux, uy, -uy, ux, A.x, A.y)
          raw.drawImage(img, sx + sw * c.t0, sy, sw * (c.t1 - c.t0), sh, 0, -hh / 2, len, hh)
          raw.restore()
          return
        }
        if (!self.front(dx + dw / 2, dy + dh / 2)) return
        const q = centred(dx, dy, dw, dh)
        raw.drawImage(img, sx, sy, sw, sh, q.x, q.y, q.w, q.h)
      },
      createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
        if (native()) return raw.createLinearGradient(x0, y0, x1, y1)
        const c = board() ? clipSegmentNear(x0, y0, x1, y1, self.view, self.lim) : null
        if (board() && c && (c.t0 > 0 || c.t1 < 1)) {
          // keep the stops anchored: extrapolate the projected direction
          const A = projectFlat(c.x0, c.y0, self.view),
            B = projectFlat(c.x1, c.y1, self.view)
          const span = c.t1 - c.t0 || 1
          const dx = (B.x - A.x) / span,
            dy = (B.y - A.y) / span
          return raw.createLinearGradient(
            A.x - dx * c.t0,
            A.y - dy * c.t0,
            A.x + dx * (1 - c.t0),
            A.y + dy * (1 - c.t0)
          )
        }
        const A = self.P(x0, y0),
          B = self.P(x1, y1)
        return raw.createLinearGradient(A.x, A.y, B.x, B.y)
      },
      createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) {
        if (native()) return raw.createRadialGradient(x0, y0, r0, x1, y1, r1)
        const A = self.P(x0, y0),
          B = self.P(x1, y1)
        return raw.createRadialGradient(A.x, A.y, r0 * A.s, B.x, B.y, r1 * B.s)
      }
    }
  }
}

/** Draw `fn` as an upright billboard standing at flat (ax, ay) (lifted h px)
 *  when `ctx` is a tilted TiltCanvas proxy; plain flat drawing otherwise.
 *  Returns the frame used (null when flat or behind the camera). */
export function billboard(
  ctx: any,
  ax: number,
  ay: number,
  fn: () => void,
  h = 0
): BillboardFrame | null {
  const t: TiltCanvas | undefined = ctx && ctx.__tilt
  if (!t) {
    fn()
    return null
  }
  return t.group(ax, ay, h, fn)
}

/** The raw 2D context behind a (possibly projecting) context — for screen-
 *  fixed decoration (backdrops) that must not lie on the board. */
export function rawContext(ctx: any): CanvasRenderingContext2D {
  return (ctx && ctx.__tilt && ctx.raw) || ctx
}
