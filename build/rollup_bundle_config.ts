import {plugins} from './rollup_plugins';
import banner from './banner';
import {type InputOption, type ModuleFormat, type RollupOptions} from 'rollup';

const {BUILD} = process.env;
const production: boolean = BUILD === 'production';

export const outputPostfix: string = production ? '' : '-dev';

/** Rollup config for bundling a single entry point into a single output file. */
export const createBundleConfig = (input: InputOption, file: string, format: ModuleFormat): RollupOptions => ({
    input,
    output: {
        name: 'maplibregl',
        file,
        format,
        sourcemap: true,
        indent: false,
        banner
    },
    treeshake: production,
    plugins: plugins(production)
});
