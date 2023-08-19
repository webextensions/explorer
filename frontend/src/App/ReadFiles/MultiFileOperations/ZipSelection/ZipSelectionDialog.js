import React, { useState } from 'react';

import { ResponsiveDialog } from '../../../Components/ResponsiveDialog/ResponsiveDialog.js';

import { zipFiles } from './zipFiles.js';

import styles from './ZipSelectionDialog.css';

const ZipSelectionDialog = ({
    open,
    onClose,
    selectedFiles
}) => {
    const arrListOfFileNames = [];
    for (const fileHandle of selectedFiles) {
        arrListOfFileNames.push(fileHandle.name);
    }

    const [zipOngoing, setZipOngoing] = useState(false);
    const [zippedOutput, setZippedOutput] = useState(null);

    return (
        <ResponsiveDialog
            open={open}
            onClose={() => { onClose(); }}
            noPrimaryButton
        >
            <div className={styles.ZipSelectionDialog}>
                <div>
                    Entries selected:
                </div>
                <div style={{ marginTop: 5 }}>
                    <ul style={{ marginLeft: 40 }}>
                        {arrListOfFileNames.map((fileName) => {
                            return (
                                <li key={fileName}>
                                    {fileName}
                                </li>
                            );
                        })}
                    </ul>
                </div>
                <div style={{ display: 'flex', marginTop: 20 }}>
                    <div>
                        <button
                            disabled={zipOngoing}
                            onClick={async () => {
                                setZipOngoing(true);

                                const zippedContent = await zipFiles(selectedFiles);
                                setZippedOutput(zippedContent);
                            }}
                        >
                            Zip
                        </button>
                    </div>
                    {
                        zippedOutput &&
                        <div style={{ marginLeft: 10 }}>
                            <button
                                onClick={async () => {
                                    const { saveAs } = (await import('file-saver')).default;
                                    saveAs(zippedOutput, 'output.zip');
                                }}
                            >
                                Download zipped output
                            </button>
                        </div>
                    }
                </div>
            </div>
        </ResponsiveDialog>
    );
};

export { ZipSelectionDialog };
