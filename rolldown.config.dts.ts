import {defineConfig} from 'rolldown';
import {dts} from 'rolldown-plugin-dts';
import packageJSON from './package.json' with {type: 'json'};

export default defineConfig({
    input: {'maplibre-gl': 'src/index.ts'},
    output: {
        dir: 'dist',
        format: 'es',
    },
    external: Object.keys(packageJSON.dependencies),
    plugins: [dts({emitDtsOnly: true})],
});
