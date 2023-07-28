import path from 'node:path';

import express from 'express';
import bodyParser from 'body-parser';

import getPort, { portNumbers } from 'get-port';

import webpack from 'webpack';
import webpackDevMiddleware from 'webpack-dev-middleware';
import webpackHotMiddleware from 'webpack-hot-middleware';

import './server-load-environment-variables.mjs';

import webpackConfig from '../frontend/webpack.config.mjs';

import { identifyTags } from './api/identifyTags/identifyTags.mjs';

const __dirname = path.dirname(import.meta.url).replace('file://', '');

const app = express();

const compiler = webpack(webpackConfig);
app.use(
    webpackDevMiddleware(compiler, {
        publicPath: webpackConfig.output.publicPath
    })
);

app.use(webpackHotMiddleware(compiler));

app.use(
    express.static(
        path.resolve(__dirname, '..', 'public')
    )
);

app.use(bodyParser.raw({ type: 'image/*', limit: '100mb' }));

app.post('/api/identifyTags', identifyTags());

const freePort = await getPort({ port: portNumbers(3000, 3100) });
app.listen(freePort, () => {
    console.log(`The server is available at: http://localhost:${freePort}/`);
});
