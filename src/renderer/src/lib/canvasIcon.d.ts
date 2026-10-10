// Types for canvasIcon.js — draw the app's icons on a Canvas 2D context.
export function iconPath(value: string): Path2D | null
export function drawIcon(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  value: string,
  cx: number,
  cy: number,
  size: number,
  opts?: { color?: string; lineWidth?: number; alpha?: number }
): boolean
export function iconCanvas(
  value: string,
  px: number,
  color?: string,
  lineWidth?: number
): HTMLCanvasElement
