import autoprefixer from 'autoprefixer';
import cssnanoPlugin from 'cssnano';
import postcssInlineSvg from 'postcss-inline-svg';
const config = {
    plugins: [
        autoprefixer(),
        postcssInlineSvg(),
        cssnanoPlugin()
    ]
};

export default config;
