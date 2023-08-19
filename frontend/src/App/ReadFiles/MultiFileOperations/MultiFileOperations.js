import React from 'react';
import { ZipSelection } from './ZipSelection/ZipSelection.js';
import { AddTags } from './AddTags/AddTags.js';

const MultiFileOperations = ({ handleForFolder, selectedFiles }) => {
    return (
        <div>
            <div>
                {/*
                <div>
                    <button>
                        Build metadata files
                    </button>
                </div>

                <div>
                    <button>
                        Delete metadata files
                    </button>
                </div>
                */}

                <div>
                    <ZipSelection
                        selectedFiles={selectedFiles}
                    />
                </div>

                <div style={{ marginTop: 10 }}>
                    <AddTags
                        handleForFolder={handleForFolder}
                        selectedFiles={selectedFiles}
                    />
                </div>

                {/*
                <div>
                    <button>
                        Zip files with metadata
                    </button>
                </div>
                */}
            </div>
        </div>
    );
};

export { MultiFileOperations };
