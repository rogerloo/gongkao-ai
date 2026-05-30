import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'

/**
 * ESLint 9 flat config(PLAN §10)。
 * 作用域:前端 TS/TSX。后端 Python 走 ruff(uv),不在此。
 *
 * 注:react-hooks@7 的 recommended-latest 仍是 eslintrc 旧格式、react-refresh@0.5 未导出 flat configs,
 * 故这两个插件用显式 plugins + 手写 rules 接入(flat 兼容)。eslint-config-prettier 末尾关闭格式类规则。
 */
export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.tsbuildinfo', '.husky/**'],
  },
  {
    files: ['frontend/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  eslintConfigPrettier,
)
