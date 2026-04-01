// @ts-check
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // Base: recommended TypeScript rules
  ...tseslint.configs.recommended,

  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Catch unused variables — would have caught the logger issue
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],

      // Enforce explicit return types on public methods and functions
      '@typescript-eslint/explicit-function-return-type': ['error', {
        allowExpressions: true,       // allow inline arrow functions
        allowHigherOrderFunctions: true,
      }],

      // No floating promises — async calls must be awaited or explicitly ignored
      '@typescript-eslint/no-floating-promises': 'error',

      // Prefer type imports for clarity
      '@typescript-eslint/consistent-type-imports': ['error', {
        prefer: 'type-imports',
      }],

      // No explicit `any` — forces proper typing
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },

  {
    // Relax some rules in test files
    files: ['src/**/*.test.ts', 'src/**/loggerContract.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  {
    // Ignore build output and config files
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'src/presentation/public/**'],
  },
)
