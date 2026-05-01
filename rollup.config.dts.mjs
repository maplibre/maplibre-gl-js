import {defineConfig} from 'rollup';
import {dts} from 'rollup-plugin-dts';

export default defineConfig({
    input: 'src/index.ts',
    output: {
        file: 'dist/maplibre-gl.d.ts',
        format: 'es',
    },
    plugins: [dts()],
});
