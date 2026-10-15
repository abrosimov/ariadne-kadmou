import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import obsidianmd from 'eslint-plugin-obsidianmd';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import { globalIgnores, defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

// Correctness and type safety at the strictest level the tools offer. Rules
// about comments, line length and layout are left out on purpose: layout is
// Prettier's, and comments are the author's.
export default defineConfig(
	globalIgnores([
		'node_modules',
		'.hermetic',
		'dist',
		'main.js',
		'esbuild.config.mjs',
		'version-bump.mjs',
		'versions.json',
		'package.json',
		'pnpm-lock.yaml',
		'pnpm-workspace.yaml',
		'Taskfile.yml',
		'tsconfig.json',
	]),
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ['manifest.json'],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json'],
			},
		},
		linterOptions: {
			reportUnusedDisableDirectives: 'error',
			reportUnusedInlineConfigs: 'error',
		},
	},
	...obsidianmd.configs.recommended,
	{
		files: ['**/*.ts', '**/*.mts'],
		extends: [
			js.configs.recommended,
			tseslint.configs.strictTypeChecked,
			tseslint.configs.stylisticTypeChecked,
			unicorn.configs.recommended,
		],
		rules: {
			// Type safety beyond the strict preset.
			'@typescript-eslint/strict-boolean-expressions': [
				'error',
				{ allowString: false, allowNumber: false, allowNullableObject: false },
			],
			'@typescript-eslint/switch-exhaustiveness-check': [
				'error',
				{ requireDefaultForNonUnion: true, considerDefaultExhaustiveForUnions: false },
			],
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/explicit-module-boundary-types': 'error',
			'@typescript-eslint/promise-function-async': 'error',
			'@typescript-eslint/require-array-sort-compare': 'error',
			'@typescript-eslint/prefer-readonly': 'error',
			'@typescript-eslint/no-shadow': 'error',
			'@typescript-eslint/no-unnecessary-qualifier': 'error',
			'@typescript-eslint/no-useless-empty-export': 'error',
			'@typescript-eslint/method-signature-style': 'error',
			'@typescript-eslint/default-param-last': 'error',
			'@typescript-eslint/no-loop-func': 'error',
			'@typescript-eslint/return-await': ['error', 'always'],
			'@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
			'@typescript-eslint/consistent-type-exports': 'error',
			'@typescript-eslint/no-import-type-side-effects': 'error',
			'@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],

			// Core correctness.
			eqeqeq: 'error',
			curly: 'error',
			'no-param-reassign': 'error',
			'no-implicit-coercion': 'error',
			'no-console': 'error',
			'no-eval': 'error',
			'no-new-func': 'error',
			'no-var': 'error',
			'prefer-const': 'error',
			'object-shorthand': 'error',
			'prefer-template': 'error',
			'no-else-return': 'error',
			'no-lonely-if': 'error',
			'no-useless-rename': 'error',
			'no-useless-concat': 'error',
			'no-unneeded-ternary': 'error',
			'no-self-compare': 'error',
			'no-template-curly-in-string': 'error',
			'no-unmodified-loop-condition': 'error',
			'no-unreachable-loop': 'error',
			'no-constant-binary-expression': 'error',
			'no-promise-executor-return': 'error',
			'array-callback-return': 'error',
			'default-case-last': 'error',
			'no-restricted-syntax': [
				'error',
				{
					selector: 'TSEnumDeclaration',
					message: 'Node type stripping cannot run an enum; use a string union.',
				},
			],

			// toSorted is ES2023; minAppVersion 1.8.7 still runs on installers with Chrome 106.
			'unicorn/no-array-sort': 'off',

			// Unicorn: taste, not correctness.
			'unicorn/prevent-abbreviations': 'off',
			'unicorn/no-null': 'off',
			'unicorn/no-array-reduce': 'off',
			'unicorn/no-array-callback-reference': 'off',
			'unicorn/no-useless-undefined': ['error', { checkArguments: false, checkArrowFunctionBody: false }],
			'unicorn/filename-case': ['error', { case: 'kebabCase' }],
		},
	},
	{
		// End-to-end specs run their callbacks in Obsidian's window, where `window` is the global.
		files: ['test/e2e/**/*.ts'],
		rules: { 'unicorn/prefer-global-this': 'off' },
	},
	prettier,
);
