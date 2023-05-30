import React from 'react';

import { ReadFiles } from './ReadFiles/ReadFiles.js';

import './App.css';

const App = () => {
    return (
        <div style={{ display: 'grid' }}>
            <div style={{ margin: 'auto' }}>
                <div style={{ marginTop: 20 }}>
                    <ReadFiles />
                </div>
            </div>
        </div>
    );
};

export { App };
