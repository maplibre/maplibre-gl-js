import {type Plugin} from 'rolldown';
import {visualizer} from 'rollup-plugin-visualizer';

const stats = process.env.BUNDLE === 'stats';

export const plugins = (_production: boolean): Plugin[] => stats
    ? (['treemap', 'sunburst', 'flamegraph', 'network'] as const).map(template =>
        visualizer({
            template,
            title: `gl-js-${template}`,
            filename: `staging/${template}.html`,
            gzipSize: true,
            brotliSize: true,
            sourcemap: true,
            open: true,
        }) as unknown as Plugin
    )
    : [];
