import { describe, it, expect } from 'vitest'
import {
  RESOLUTION_PRESETS,
  EXPORT_FORMATS,
  MIN_DIMENSION,
  MAX_DIMENSION,
  MAX_CAPTURE_DIMENSION,
  clampDimension,
  computeComposeLayout,
  clampCrop,
  cropToSourceRect,
  fitRectContain,
  captureSizeFor,
  sanitizeFilename
} from '../src/renderer/src/components/export/exportCompose'

describe('presets & formats', () => {
  it('presets have unique ids and sane dimensions', () => {
    const ids = new Set(RESOLUTION_PRESETS.map((p) => p.id))
    expect(ids.size).toBe(RESOLUTION_PRESETS.length)
    for (const p of RESOLUTION_PRESETS) {
      expect(p.width).toBeGreaterThanOrEqual(MIN_DIMENSION)
      expect(p.width).toBeLessThanOrEqual(MAX_DIMENSION)
      expect(p.height).toBeGreaterThanOrEqual(MIN_DIMENSION)
      expect(p.height).toBeLessThanOrEqual(MAX_DIMENSION)
    }
  })

  it('formats carry the mime and extension used for download', () => {
    const png = EXPORT_FORMATS.find((f) => f.id === 'png')
    expect(png).toMatchObject({ mime: 'image/png', ext: 'png', hasQuality: false, alpha: true })
    const jpeg = EXPORT_FORMATS.find((f) => f.id === 'jpeg')
    expect(jpeg).toMatchObject({ mime: 'image/jpeg', ext: 'jpg', hasQuality: true, alpha: false })
  })
})

describe('clampDimension', () => {
  it('clamps into [MIN, MAX] and rounds', () => {
    expect(clampDimension(10)).toBe(MIN_DIMENSION)
    expect(clampDimension(99999)).toBe(MAX_DIMENSION)
    expect(clampDimension(1920.6)).toBe(1921)
    expect(clampDimension(NaN)).toBe(MIN_DIMENSION)
  })
})

describe('computeComposeLayout', () => {
  const base = { width: 2000, height: 1000, paddingFrac: 0.05, title: '', subtitle: '', stamp: '' }

  it('content fills the padded page when there is no text', () => {
    const L = computeComposeLayout(base)
    expect(L.pad).toBe(50) // 5% of min(2000,1000)
    expect(L.content).toEqual({ x: 50, y: 50, w: 1900, h: 900 })
    expect(L.titleBaseline).toBe(0)
    expect(L.subtitleBaseline).toBe(0)
  })

  it('a title pushes the content down and keeps it inside the page', () => {
    const L = computeComposeLayout({ ...base, title: 'The Family' })
    expect(L.titleBaseline).toBeGreaterThan(L.pad)
    expect(L.content.y).toBeGreaterThan(L.titleBaseline)
    expect(L.content.y + L.content.h).toBeLessThanOrEqual(1000 - L.pad)
  })

  it('a subtitle sits below the title', () => {
    const L = computeComposeLayout({ ...base, title: 'T', subtitle: 'S' })
    expect(L.subtitleBaseline).toBeGreaterThan(L.titleBaseline)
    expect(L.content.y).toBeGreaterThan(L.subtitleBaseline)
  })

  it('a stamp reserves room at the bottom', () => {
    const without = computeComposeLayout(base)
    const withStamp = computeComposeLayout({ ...base, stamp: 'My Project · 2026' })
    expect(withStamp.content.h).toBeLessThan(without.content.h)
  })

  it('scales proportionally between preview and full size', () => {
    const full = computeComposeLayout({ ...base, title: 'T' })
    const half = computeComposeLayout({ ...base, width: 1000, height: 500, title: 'T' })
    expect(half.pad * 2).toBe(full.pad)
    expect(half.titleSize * 2).toBeCloseTo(full.titleSize, 0)
  })
})

describe('crop helpers', () => {
  it('clampCrop keeps the rect inside the unit square with a minimum size', () => {
    expect(clampCrop({ x: -0.5, y: 0.9, w: 2, h: 0.001 })).toEqual({
      x: 0,
      y: 0.9,
      w: 1,
      h: 0.02
    })
    const c = clampCrop({ x: 0.95, y: 0, w: 0.2, h: 0.5 })
    expect(c.x + c.w).toBeLessThanOrEqual(1)
  })

  it('cropToSourceRect maps fractions onto source pixels', () => {
    expect(cropToSourceRect({ x: 0.25, y: 0.5, w: 0.5, h: 0.25 }, 400, 800)).toEqual({
      x: 100,
      y: 400,
      w: 200,
      h: 200
    })
    expect(cropToSourceRect(null, 400, 800)).toEqual({ x: 0, y: 0, w: 400, h: 800 })
  })

  it('fitRectContain centres and preserves aspect', () => {
    const dst = { x: 0, y: 0, w: 200, h: 100 }
    const fit = fitRectContain(50, 50, dst) // square into wide box
    expect(fit.w).toBe(100)
    expect(fit.h).toBe(100)
    expect(fit.x).toBe(50)
    expect(fit.y).toBe(0)
  })

  it('captureSizeFor zooms the capture up for a crop and caps at the GPU limit', () => {
    const content = { x: 0, y: 0, w: 1000, h: 500 }
    expect(captureSizeFor(content, null)).toEqual({ width: 1000, height: 500 })
    expect(captureSizeFor(content, { x: 0, y: 0, w: 0.5, h: 0.5 })).toEqual({
      width: 2000,
      height: 1000
    })
    const tiny = captureSizeFor(content, { x: 0, y: 0, w: 0.02, h: 0.02 })
    expect(Math.max(tiny.width, tiny.height)).toBeLessThanOrEqual(MAX_CAPTURE_DIMENSION)
  })
})

describe('sanitizeFilename', () => {
  it('strips illegal characters but keeps spaces and hyphens', () => {
    expect(sanitizeFilename('My Family: "The Tree" <v2>?')).toBe('My Family The Tree v2')
    expect(sanitizeFilename('a/b\\c|d*e')).toBe('abcde')
  })

  it('falls back when everything is stripped', () => {
    expect(sanitizeFilename('???')).toBe('family-tree')
    expect(sanitizeFilename('')).toBe('family-tree')
  })
})
