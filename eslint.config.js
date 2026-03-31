// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginSecurity from "eslint-plugin-security";
import eslintConfigPrettier from "eslint-config-prettier";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";

/** @type {import('eslint').Linter.Config[]} */
export default [
  // Global ignores
  {
    ignores: ["build/**", "node_modules/**", "**/*.js", "!eslint.config.js"],
  },

  // Base ESLint recommended rules
  eslint.configs.recommended,

  // TypeScript strict rules with type-aware linting
  ...tseslint.configs.strictTypeChecked,

  // Node.js security rules (OWASP patterns: eval, child_process, unsafe regex, etc.)
  pluginSecurity.configs.recommended,

  // Parser options for type-aware rules (scoped to TS files only)
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Framework-specific rule overrides
  {
    rules: {
      // Allow unused vars with _ prefix (common pattern for intentionally unused params)
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // Allow void for fire-and-forget async calls (used in constructors, event handlers)
      "@typescript-eslint/no-floating-promises": ["error", { ignoreVoid: true }],

      // Relax for framework patterns — namespace re-exports, barrel files
      "@typescript-eslint/no-namespace": "off",

      // Allow non-null assertions — framework has documented type assertions (DD-014)
      "@typescript-eslint/no-non-null-assertion": "warn",

      // Allow empty functions — used for noop callbacks, abstract stubs
      "@typescript-eslint/no-empty-function": "off",

      // Restrict template expressions but allow numbers and booleans
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true, allowBoolean: true }],

      // Allow confusing void expression in arrow functions (short arrow returns)
      "@typescript-eslint/no-confusing-void-expression": "off",

      // Relax unbound method check — framework passes methods as callbacks
      "@typescript-eslint/unbound-method": "off",

      // --- SDK Boundary Rules ---
      // Disabled: Framework has 0× `any` (DD-014) but SDK types resolve to `unknown`
      // at import()/dynamic boundaries, producing false positives on SDK interactions
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",

      // Async interface compliance — handlers must be async for interface contracts
      "@typescript-eslint/require-await": "off",

      // Defensive coding is intentional at system boundaries (DD-013)
      "@typescript-eslint/no-unnecessary-condition": "warn",

      // Some SDK re-exports have redundant union constituents
      "@typescript-eslint/no-redundant-type-constituents": "warn",

      // Gradual adoption — new rule from strictTypeChecked
      "@typescript-eslint/use-unknown-in-catch-callback-variable": "warn",

      // Deprecated APIs are migrated gradually — framework re-exports some for backcompat
      "@typescript-eslint/no-deprecated": "warn",

      // Extension-point interfaces intentionally declare no members yet
      "@typescript-eslint/no-empty-object-type": "warn",

      // --- Security Plugin Overrides ---
      // False positives on typed obj[key] access — TypeScript's type system handles this
      "security/detect-object-injection": "off",

      // ESM project — no require() usage
      "security/detect-non-literal-require": "off",

      // Not all string comparisons are security-sensitive
      "security/detect-possible-timing-attacks": "warn",
    },
  },

  // Prettier integration (must be last to override conflicting rules)
  eslintConfigPrettier,
  eslintPluginPrettier,
];
