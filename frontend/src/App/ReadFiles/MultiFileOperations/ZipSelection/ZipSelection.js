import React, { useState } from 'react';

import { ZipSelectionDialog } from './ZipSelectionDialog.js';

const ZipSelection = ({ selectedFiles }) => {
    const [open, setOpen] = useState(false);

    return (
        <div>
            <button
                onClick={() => {
                    setOpen(true);
                }}
            >
                Zip selection
            </button>

            <ZipSelectionDialog
                open={open}
                onClose={() => {
                    setOpen(false);
                }}
                selectedFiles={selectedFiles}
            />
        </div>
    );
};

export { ZipSelection };
