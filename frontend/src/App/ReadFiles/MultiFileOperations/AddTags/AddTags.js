import React, { useState } from 'react';
import PropTypes from 'prop-types';

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
AddTags.propTypes = {
    handleForFolder: PropTypes.object.isRequired,
    selectedFiles: PropTypes.object.isRequired
};

export { AddTags };
