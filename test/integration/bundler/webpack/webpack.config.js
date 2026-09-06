const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: './src/index.ts',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].[contenthash].js',
        publicPath: '',
        clean: true
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/},
            {test: /\.css$/, use: ['style-loader', 'css-loader']}
        ]
    },
    plugins: [
        new HtmlWebpackPlugin({template: './index.html'}),
        new CopyPlugin({
            patterns: [
                {
                    from: require.resolve('maplibre-gl/dist/maplibre-gl-worker.mjs'),
                    to: 'maplibre-gl-worker.mjs',
                    info: {minimized: true}
                },
                {
                    from: require.resolve('maplibre-gl/dist/maplibre-gl-shared.mjs'),
                    to: 'maplibre-gl-shared.mjs',
                    info: {minimized: true}
                }
            ],
        }),
    ],
    devServer: {
        port: 3000,
        open: true
    }
};
