/* eslint-disable filenames/match-exported */

import path from 'node:path';

import webpack from 'webpack';

// TODO: Identify a fix for this ESLint issue
// eslint-disable-next-line import/default
import CopyPlugin from 'copy-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';

import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';

const __dirname = path.dirname(import.meta.url).replace('file://', '');

const BABEL_QUERY = {
    presets: ['@babel/preset-react'],
    // plugins: ['transform-es2015-modules-commonjs']
    plugins: ['react-refresh/babel']
};

const config = {
    mode: 'development',

    entry: [
        'webpack-hot-middleware/client?path=/__webpack_hmr&timeout=20000',
        path.resolve(__dirname, './src/index.js')
    ],
    output: {
        filename: 'index.js',
        path: path.resolve(__dirname, '..', 'public')
    },

    devtool: 'inline-source-map',

    module: {
        rules: [
            // https://github.com/babel/babel-loader#usage
            {
                test: /\.js$/,
                loader: 'babel-loader',
                options: BABEL_QUERY,
                exclude: /node_modules/
            },
            {
                test: /\.css$/,
                use: [
                    // {
                    //     loader: MiniCssExtractPlugin.loader
                    // },
                    MiniCssExtractPlugin.loader,

                    {
                        // https://adamrackis.dev/css-modules/
                        loader: 'css-loader',
                        options: {
                            // https://webpack.js.org/loaders/css-loader/#object-2
                            modules: {
                                auto: function (resourcePath) {
                                    if (
                                        // TODO: FIXME: Create a separate "vendor.css" or similarly named file
                                        resourcePath.indexOf('frontend/node_modules/') >= 0
                                    ) {
                                        return false;
                                    } else {
                                        return true;
                                    }
                                },
                                localIdentName: '[name]__[local]--[hash:base64:5]'
                            }
                        }
                    }
                ]
            }
        ]
    },

    plugins: [
        new MiniCssExtractPlugin({
            filename: 'index.css'
        }),
        new CopyPlugin({
            patterns: [
                { from: path.resolve(__dirname, './src/index.html'), to: path.resolve(__dirname, '..', 'public') }
            ]
        }),
        new webpack.HotModuleReplacementPlugin(),
        new ReactRefreshWebpackPlugin()
    ]
};

// eslint-disable-next-line import/no-default-export
export default config;
