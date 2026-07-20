import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
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
  // TypeScript files (src/shared, src/renderer/src/api) get the TS parser/rules
  ...tseslint.configs.recommended.map((cfg) => ({ ...cfg, files: ['**/*.ts'] })),

  // Main process, preload, config, tests and standalone scripts run in Node
  {
    files: [
      'src/main/**',
      'src/preload/**',
      'electron.vite.config.js',
      'vite.config.web.js',
      'scripts/**',
      'tests/**'
    ],
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

  // In TS files the TS-aware unused-vars rule replaces the base one (which
  // false-positives on parameter names in type signatures)
  {
    files: ['**/*.ts'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
      ]
    }
  },

  // Must be last: disables stylistic rules that conflict with Prettier
  prettier
]
