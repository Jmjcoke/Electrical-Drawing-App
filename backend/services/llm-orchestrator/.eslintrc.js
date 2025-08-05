module.exports = {
  extends: ['eslint:recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  env: {
    node: true,
    jest: true,
    es2020: true,
  },
  plugins: ['@typescript-eslint'],
  globals: {
    NodeJS: 'readonly',
  },
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    'no-unused-vars': 'off',
    'no-useless-escape': 'warn',
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.js'],
};