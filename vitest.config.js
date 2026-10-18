import { defineConfig } from 'vitest/config'
import { readFileSync } from 'fs'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  test: {
    setupFiles: ['tests/setup.js']
  }
})
