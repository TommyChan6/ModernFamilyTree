// The vector rendering backend: the same resolved layers the canvas
// compositor paints, emitted as a standalone SVG document. Powers "Export
// SVG" (crisp at any size — print a family poster) and, being pure string
// output, lets Node tooling render contact sheets of a pack without a DOM.

import type { CharacterDoc } from '../../../../../shared/types'
import type { StylePack } from '../styleTypes'
import {
  resolveLayers,
  type CharacterAnim,
  type ResolvedGradient,
  type ResolvedLayer,
  type TransformOp
} from '../characterModel'

const f = (n: number): string => String(Math.round(n * 1000) / 1000)

function opsAttr(ops: TransformOp[]): string {
  return ops
    .map((op) => {
      if (op.type === 'translate') return `translate(${f(op.x)} ${f(op.y)})`
      if (op.type === 'rotate')
        return `rotate(${f((op.a * 180) / Math.PI)} ${f(op.cx)} ${f(op.cy)})`
      return `translate(${f(op.cx)} ${f(op.cy)}) scale(${f(op.sx)} ${f(op.sy)}) translate(${f(-op.cx)} ${f(-op.cy)})`
    })
    .join(' ')
}

function gradDef(id: string, g: ResolvedGradient): string {
  const stops = g.stops
    .map(
      ([o, c, a]) =>
        `<stop offset="${f(o)}" stop-color="${c}"${a < 1 ? ` stop-opacity="${f(a)}"` : ''}/>`
    )
    .join('')
  if (g.type === 'linear') {
    return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f(g.x1)}" y1="${f(g.y1)}" x2="${f(g.x2)}" y2="${f(g.y2)}">${stops}</linearGradient>`
  }
  return `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${f(g.cx)}" cy="${f(g.cy)}" r="${f(g.r)}" fx="${f(g.fx)}" fy="${f(g.fy)}">${stops}</radialGradient>`
}

/** Layers → `{ defs, body }` SVG fragments in character space. `prefix`
 *  keeps ids unique when several figures share one document. */
export function layersToSvg(layers: ResolvedLayer[], prefix = 'c'): { defs: string; body: string } {
  const defs: string[] = []
  const clipIds = new Map<string, string>()
  let n = 0
  const body = layers
    .map((l) => {
      let fill = l.fill || 'none'
      if (l.grad) {
        const id = `${prefix}g${n++}`
        defs.push(gradDef(id, l.grad))
        fill = `url(#${id})`
      }
      const attrs = [
        `d="${l.d}"`,
        `fill="${fill}"`,
        l.stroke && l.lineWidth > 0
          ? `stroke="${l.stroke}" stroke-width="${f(l.lineWidth)}" stroke-linejoin="round" stroke-linecap="round"`
          : '',
        l.alpha < 1 ? `opacity="${f(l.alpha)}"` : '',
        l.blend ? `style="mix-blend-mode:${l.blend}"` : ''
      ]
      const t = opsAttr(
        l.offset ? [...l.ops, { type: 'translate', x: l.offset.x, y: l.offset.y }] : l.ops
      )
      const path = `<path ${t ? `transform="${t}" ` : ''}${attrs.filter(Boolean).join(' ')}/>`
      if (!l.clip) return path
      const key = l.clip.d + '|' + opsAttr(l.clip.ops)
      let cid = clipIds.get(key)
      if (!cid) {
        cid = `${prefix}k${clipIds.size}`
        clipIds.set(key, cid)
        const ct = opsAttr(l.clip.ops)
        defs.push(
          `<clipPath id="${cid}" clipPathUnits="userSpaceOnUse"><path ${ct ? `transform="${ct}" ` : ''}d="${l.clip.d}"/></clipPath>`
        )
      }
      return `<g clip-path="url(#${cid})">${path}</g>`
    })
    .join('\n')
  return { defs: defs.join('\n'), body }
}

export interface SvgOptions {
  /** Character-space region to frame; defaults to the full figure. */
  region?: { cx: number; cy: number; span: number }
  /** Output size in px (the viewBox is still character space). */
  size?: number
  /** CSS color painted behind the figure; omit for transparency. */
  background?: string
  anim?: CharacterAnim
}

/** A complete standalone SVG document for one look. */
export function docToSvg(doc: CharacterDoc, pack: StylePack, opts: SvgOptions = {}): string {
  const region = opts.region ?? {
    cx: pack.width / 2,
    cy: pack.height / 2,
    span: Math.max(pack.width, pack.height) * 1.04
  }
  const size = opts.size ?? 1024
  const x = region.cx - region.span / 2
  const y = region.cy - region.span / 2
  const { defs, body } = layersToSvg(resolveLayers(doc, pack, opts.anim))
  const bg = opts.background
    ? `<rect x="${f(x)}" y="${f(y)}" width="${f(region.span)}" height="${f(region.span)}" fill="${opts.background}"/>`
    : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${f(x)} ${f(y)} ${f(region.span)} ${f(region.span)}">` +
    `<defs>${defs}</defs>${bg}${body}</svg>`
  )
}
