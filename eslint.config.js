import typescriptEslint from '@typescript-eslint/eslint-plugin';
import stylisticTs from '@stylistic/eslint-plugin';
import tsdoc from 'eslint-plugin-tsdoc';
import vitest from '@vitest/eslint-plugin';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import html from 'eslint-plugin-html';
import preferTypeForDataShapes from './build/eslint-rules/prefer-type-for-data-shapes.js';

export default [
    {
        ignores: ['build/*.js', 'build/rollup/**', 'staging/**', 'coverage/**', 'node_modules/**', 'docs/**', 'dist/**', 'site/**', 'test/integration/bundler/*/**', '**/*_generated.js', '**/*_generated.mjs', 'test/bench/**/benchmarks_worker.mjs']
    },
    {
        ignores: ['test/bench/**'],
        files: ['**/*.ts', '**/*.js'],
        plugins: {
            '@typescript-eslint': typescriptEslint,
            '@stylistic': stylisticTs,
            tsdoc,
            vitest,
            'local': {rules: {'prefer-type-for-data-shapes': preferTypeForDataShapes}},
        },

        linterOptions: {
            reportUnusedDisableDirectives: true,
        },

        languageOptions: {
            globals: {
                ...Object.fromEntries(Object.entries(globals.browser).map(([key]) => [key, 'off'])),
                performance: true,
            },

            parser: tsParser,
            ecmaVersion: 5,
            sourceType: 'module',

            parserOptions: {
                createDefaultProgram: true,
                projectService: {
                    allowDefaultProject: [
                        'build/generate-*.ts',
                        'build/eslint-rules/*.js',
                        'test/build/*.ts',
                        'eslint.config.js',
                        'postcss.config.js',
                    ],
                    maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 20,
                },
            },
        },

        rules: {
            'no-dupe-class-members': 'off',
            '@typescript-eslint/no-dupe-class-members': ['error'],
            '@typescript-eslint/consistent-type-imports': ['error',{
                'fixStyle': 'inline-type-imports'
            }],
            '@typescript-eslint/no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
            }],
            '@typescript-eslint/prefer-optional-chain': 'error',
            '@typescript-eslint/prefer-reduce-type-parameter': 'error',
            '@typescript-eslint/prefer-return-this-type': 'error',
            '@typescript-eslint/prefer-for-of': 'error',
            '@typescript-eslint/no-unnecessary-type-assertion': 'error',
            '@typescript-eslint/prefer-includes': 'error',
            '@typescript-eslint/prefer-string-starts-ends-with': 'error',
            '@typescript-eslint/array-type': ['error', {default: 'array-simple'}],
            'local/prefer-type-for-data-shapes': 'error',

            'logical-assignment-operators': ['error', 'always', {enforceForIfStatements: true}],
            'prefer-object-spread': 'error',
            'prefer-object-has-own': 'error',
            'object-shorthand': 'error',
            'no-useless-computed-key': 'error',
            'no-object-constructor': 'error',
            '@stylistic/member-delimiter-style': ['error'],
            'no-useless-constructor': 'off',
            '@typescript-eslint/no-useless-constructor': ['error'],
            'no-undef': 'off',
            'no-use-before-define': 'off',
            'no-duplicate-imports': 'off',
            'implicit-arrow-linebreak': 'off',
            'arrow-parens': 'off',
            'arrow-body-style': 'off',
            'no-confusing-arrow': 'off',
            'no-control-regex': 'off',
            'no-invalid-this': 'off',
            'no-buffer-constructor': 'off',
            'array-bracket-spacing': 'error',
            'consistent-return': 'off',
            'global-require': 'off',
            'key-spacing': 'error',
            'no-eq-null': 'off',
            'no-lonely-if': 'off',
            'no-new': 'off',

            'no-restricted-properties': [2, {
                object: 'Object',
                property: 'assign',
            }],

            'no-unused-vars': 'off',
            'no-warning-comments': 'error',
            'object-curly-spacing': ['error', 'never'],

            'prefer-const': ['error', {
                destructuring: 'all',
            }],

            'prefer-template': 'error',
            'prefer-spread': 'off',
            quotes: 'off',
            '@stylistic/quotes': ['error', 'single'],
            'no-redeclare': 'off',
            '@typescript-eslint/no-redeclare': ['error'],
            'space-before-function-paren': 'off',
            'template-curly-spacing': 'error',
            'no-useless-escape': 'off',
            indent: 'off',
            '@stylistic/indent': ['error'],
            '@stylistic/semi': ['error'],
            'no-restricted-syntax': [
                'error',
                {
                    'selector': 'CallExpression[callee.property.name=\'forEach\']',
                    'message': 'Do not use forEach. Use for...of for iteration, map for mapping, or reduce for accumulation instead.'
                }
            ],

            'no-multiple-empty-lines': ['error', {
                max: 1,
            }],

            'tsdoc/syntax': 'warn'
        },
    },
    {
        files: ['**/*.html'],
        plugins: {
            html
        },
        rules: {
            'no-restricted-properties': 'off',
            'new-cap': 'off',
            '@typescript-eslint/no-unused-vars': 'off'
        }
    },
    {
        files: ['test/bench/**/*.jsx', 'test/bench/**/*.js', 'test/bench/**/*.ts'],
        plugins: {
            react
        },
        rules: {
            'react/jsx-uses-vars': [2],
            'no-restricted-properties': 'off'
        },
        languageOptions: {
            globals: {
                ...Object.fromEntries(Object.entries(globals.browser).map(([key]) => [key, 'off'])),
                performance: true,
            },

            parser: tsParser,
            ecmaVersion: 5,
            sourceType: 'module',

            parserOptions: {
                createDefaultProgram: true,
            },
        },
    },
];
