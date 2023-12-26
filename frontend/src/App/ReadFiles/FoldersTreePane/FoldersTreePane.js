/* global showDirectoryPicker */

import React from 'react';
import PropTypes from 'prop-types';

const TreeView = function () {
    return (
        <div>
            TreeView
        </div>
    );
};

const OpenFolderButton = function ({
    setHandleForFolder,
    setRelevantFilesCount,
    setRelevantFilesTotal,
    setFilesAndIndexInfo,
    setSelectedFiles,
    setResourcesCount
}) {
    return (
        <div>
            <button
                style={{
                    cursor: 'pointer'
                }}
                onClick={async () => {
                    let dirHandle = null;
                    try {
                        dirHandle = await showDirectoryPicker({
                            // mode: 'read'
                            mode: 'readwrite'
                        });
                    } catch (e) {
                        console.error(e);
                        // eslint-disable-next-line no-alert
                        alert('An error occurred.\n\nPlease check the console for more details.');
                        return;
                    }
                    setHandleForFolder(dirHandle);
                    setRelevantFilesCount(null);
                    setRelevantFilesTotal(null);
                    setFilesAndIndexInfo({
                        handleForFolder: null,
                        filesAndDetails: null,
                        readNames: false,
                        readMetadataFiles: false
                    });
                    setSelectedFiles(new Set([]));

                    // Get handles for all the files
                    const handles = [];
                    let index = 0;
                    setResourcesCount(index);
                    const iterator = dirHandle.values();
                    while (true) { // eslint-disable-line no-constant-condition
                        const response = await iterator.next();
                        if (response.done) {
                            break;
                        }
                        const entry = response.value;
                        index++;
                        setResourcesCount(index);
                        if (
                            entry.name.endsWith('.jpeg') ||
                            entry.name.endsWith('.jpg')  ||
                            entry.name.endsWith('.png')  ||
                            entry.name.endsWith('.svg')
                        ) {
                            handles.push(entry);
                        }
                    }

                    setRelevantFilesTotal(handles.length);
                    (async () => {
                        const filesAndDetails = [];
                        for (const handle of handles) {
                            const file = await handle.getFile();
                            filesAndDetails.push({
                                fileHandle: handle,
                                file,
                                details: {}
                            });

                            setRelevantFilesCount(filesAndDetails.length);
                        }
                        setFilesAndIndexInfo({
                            handleForFolder: dirHandle,
                            filesAndDetails,
                            readNames: true,
                            readMetadataFiles: false
                        });
                    })();
                }}
            >
                <div>
                    Open Folder
                </div>
                <div style={{ color: '#999' }}>
                    (from disk)
                </div>
            </button>
        </div>
    );
};
OpenFolderButton.propTypes = {
    setHandleForFolder: PropTypes.func.isRequired,
    setRelevantFilesCount: PropTypes.func.isRequired,
    setRelevantFilesTotal: PropTypes.func.isRequired,
    setFilesAndIndexInfo: PropTypes.func.isRequired,
    setSelectedFiles: PropTypes.func.isRequired,
    setResourcesCount: PropTypes.func.isRequired
};

const FoldersTreePane = function ({
    setHandleForFolder,
    setRelevantFilesCount,
    setRelevantFilesTotal,
    setFilesAndIndexInfo,
    setSelectedFiles,
    setResourcesCount
}) {
    return (
        <div
            style={{
                height: '100%'
            }}
        >
            <div>
                <OpenFolderButton
                    setHandleForFolder={setHandleForFolder}
                    setRelevantFilesCount={setRelevantFilesCount}
                    setRelevantFilesTotal={setRelevantFilesTotal}
                    setFilesAndIndexInfo={setFilesAndIndexInfo}
                    setSelectedFiles={setSelectedFiles}
                    setResourcesCount={setResourcesCount}
                />
            </div>

            <div>
                <TreeView />
            </div>
        </div>
    );
};
FoldersTreePane.propTypes = {
    setHandleForFolder: PropTypes.func.isRequired,
    setRelevantFilesCount: PropTypes.func.isRequired,
    setRelevantFilesTotal: PropTypes.func.isRequired,
    setFilesAndIndexInfo: PropTypes.func.isRequired,
    setSelectedFiles: PropTypes.func.isRequired,
    setResourcesCount: PropTypes.func.isRequired
};

export { FoldersTreePane };
