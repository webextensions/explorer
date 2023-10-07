import path from 'node:path';

import express from 'express';
import bodyParser from 'body-parser';

import getPort, { portNumbers } from 'get-port';

import webpack from 'webpack';
import webpackDevMiddleware from 'webpack-dev-middleware';
import webpackHotMiddleware from 'webpack-hot-middleware';

import notifier from 'node-notifier';

import { logger } from 'note-down';

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

let portFromConfig = parseInt(process.env.PORT);
if (1 <= portFromConfig && portFromConfig <= 65535) {
    // do nothing
} else {
    portFromConfig = 3000;
}

let portToUse;
if (process.env.PORT_DYNAMIC === 'yes') {
    portToUse = await getPort({
        port: portNumbers(portFromConfig, 65535)
    });
} else {
    portToUse = portFromConfig;
}

app.listen(portToUse, () => {
    const serverPath = `http://localhost:${portToUse}/`;
    logger.info(`The server is available at: ${serverPath}`);
    notifier.notify({
        title: '[explorer] - Server started',
        message: serverPath
    });
});
