import {type Plugin} from 'rolldown';
import {visualizer} from 'rollup-plugin-visualizer';

const {BUNDLE} = process.env;
const stats = BUNDLE === 'stats';

// Strip the legacy `_token_stack:` label from jsonlint's generated parser —
// browsers don't optimize the unrolled-goto pattern. https://github.com/zaach/jison/issues/351
const stripJsonlintTokenStack: Plugin = {
    name: 'maplibre-strip-jsonlint-token-stack',
    transform: {
        filter: {
            id: /\/jsonlint-lines-primitives\/lib\/jsonlint\.js$/,
        },
        handler(code) {
            if (!code.includes('_token_stack:')) return null;
            return {
                code: code.replace(/_token_stack:/g, ''),
                map: null,
            };
        },
    },
};

export const plugins = (_production: boolean): Plugin[] => [
    stripJsonlintTokenStack,
    ...(stats ? (['treemap', 'sunburst', 'flamegraph', 'network'] as const).map(template =>
        visualizer({
            template,
            title: `gl-js-${template}`,
            filename: `staging/${template}.html`,
            gzipSize: true,
            brotliSize: true,
            sourcemap: true,
            open: true
        }) as unknown as Plugin
    ) : [])
];
