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

const PORT = parseInt(process.env.PORT);
let portToUse;

if (1 <= PORT && PORT <= 65535) {
    portToUse = PORT;
} else {
    const portFrom = parseInt(process.env.PORT_FROM) || 3000;
    const portTo   = parseInt(process.env.PORT_TO)   || 65535;

    portToUse = await getPort({
        port: portNumbers(portFrom, portTo)
    });
}
app.listen(portToUse, () => {
    const serverPath = `http://localhost:${portToUse}/`;
    logger.info(`The server is available at: ${serverPath}`);
    notifier.notify({
        title: '[folder-explorer] - Server started',
        message: serverPath
    });
});
