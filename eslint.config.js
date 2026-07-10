import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default [
  {
    ignores: [
      'node_modules/**',
      'out/**',
      'dist/**',
      'preview.html',
      // one-off debug scripts, not part of the app
      'test_main.js',
      'test_main2.js'
    ]
  },

  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  // Main process, preload, config and tests run in Node
  {
    files: ['src/main/**', 'src/preload/**', 'electron.vite.config.js', 'tests/**'],
    languageOptions: { globals: { ...globals.node } }
  },

  // Renderer runs in Chromium
  {
    files: ['src/renderer/**'],
    languageOptions: { globals: { ...globals.browser } }
  },

  {
    rules: {
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
      ],
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  },

  // Must be last: disables stylistic rules that conflict with Prettier
  prettier
]
