/* ESLint da API (NestJS). Não usa type-checking (rápido, não exige tsconfig). */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  env: {
    node: true,
    es2022: true,
  },
  ignorePatterns: ['dist', 'node_modules', '*.js', '*.cjs'],
  rules: {
    // `any` é usado em pontos de integração (payloads externos, Prisma JSON).
    '@typescript-eslint/no-explicit-any': 'off',
    // Não obrigamos tipos de retorno explícitos (NestJS infere bem).
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    // `!` é usado pontualmente após validação de existência.
    '@typescript-eslint/no-non-null-assertion': 'off',
    // Variáveis/args não usados viram aviso (prefixar com _ para ignorar).
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
  },
};
