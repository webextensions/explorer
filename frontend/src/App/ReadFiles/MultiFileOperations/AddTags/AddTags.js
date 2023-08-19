import React, { useState } from 'react';

import { AddTagsDialog } from './AddTagsDialog.js';

const AddTags = ({ handleForFolder, selectedFiles }) => {
    const [open, setOpen] = useState(false);

    return (
        <div>
            <button
                onClick={() => {
                    setOpen(true);
                }}
            >
                Add tags
            </button>

            <AddTagsDialog
                open={open}
                onClose={() => {
                    setOpen(false);
                }}
                handleForFolder={handleForFolder}
                selectedFiles={selectedFiles}
            />
        </div>
    );
};

export { AddTags };
