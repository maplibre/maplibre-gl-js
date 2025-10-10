import autoprefixer from 'autoprefixer';
import cssnanoPlugin from 'cssnano';
import postcssInlineSvg from 'postcss-inline-svg';
const config = {
    plugins: [
        autoprefixer(),
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
