import cssnanoPlugin from 'cssnano';
import postcssInlineSvg from 'postcss-svg-load';
const config = {
    plugins: [
        postcssInlineSvg(),
        cssnanoPlugin({
            preset: [
                'default',
                {
                    svgo: {
                        plugins: [
                            {
                                name: 'preset-default',
                                params: {
                                    overrides: {
                                        removeViewBox: false,
                                        removeDimensions: false,
                                    },
                                },
                            },
                        ],
                    },
                },
            ],
        }),
    ],
};

export default config;
