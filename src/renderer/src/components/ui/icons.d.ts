// Types for icons.js — the app's icon vocabulary.
export type IconNode = [string, Record<string, string | number>][]
export const LEGACY_GLYPHS: Record<string, string>
export const ICON_NAMES: string[]
export const ICON_ALIASES: Record<string, string>
export function resolveIcon(value: unknown): string | null
export function hasIcon(value: unknown): boolean
export function iconNode(value: unknown): IconNode | null
