import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import css from 'rollup-plugin-import-css';

export default {
    input: 'src/main.ts',
    output: {
        dir: 'dist',
        format: 'es',
        sourcemap: true
    },
    plugins: [
        resolve({browser: true}),
        commonjs(),
        typescript(),
        css({output: 'main.css'})
    ]
};
