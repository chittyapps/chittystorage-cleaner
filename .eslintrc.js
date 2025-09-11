module.exports = {
  env: {
    browser: false,
    commonjs: true,
    es6: true,
    node: true,
    jest: true
  },
  extends: [
    'standard'
  ],
  parserOptions: {
    ecmaVersion: 2020
  },
  rules: {
    // Security-related rules
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    
    // Best practices
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-alert': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    
    // Specific to daemon
    'no-process-exit': 'off', // Daemon needs process.exit
    'no-sync': 'off' // Some sync operations are needed for config
  },
  overrides: [
    {
      files: ['src/daemon.js'],
      rules: {
        'no-console': 'off' // Main daemon can use console
      }
    },
    {
      files: ['tests/**/*.js'],
      rules: {
        'no-unused-expressions': 'off'
      }
    }
  ]
};