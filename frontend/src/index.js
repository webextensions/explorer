/* eslint-disable filenames/no-index */

import React from 'react';
import ReactDOM from 'react-dom/client'; // eslint-disable-line node/file-extension-in-import

import './styles-reset.css';

import { App } from './App/App.js';

const root = document.getElementById('root');
ReactDOM.createRoot(root).render(<App />);
