// Vitest worker contexts on Node 18 don't expose the Web Crypto API on
// globalThis the way browsers, Electron and newer Node do — src/shared/auth.ts
// relies on it for PBKDF2. Backfill it from node:crypto; a no-op elsewhere.
import { webcrypto } from 'node:crypto'

if (!globalThis.crypto) globalThis.crypto = webcrypto
