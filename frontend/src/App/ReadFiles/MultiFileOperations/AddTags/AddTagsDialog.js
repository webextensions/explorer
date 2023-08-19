import React, { useState } from 'react';

import {
    tryCatchSafe,
    tryCatchSafeAsync
} from 'helpmate/dist/control/tryCatch.js';

import { ResponsiveDialog } from '../../../Components/ResponsiveDialog/ResponsiveDialog.js';

import styles from './AddTagsDialog.css';

const addTagsToFiles = async ({
    handleForFolder,
    files,
    tags,
    onProgress
}) => {
    const arrListOfFileNames = [];
    for (const fileHandle of files) {
        arrListOfFileNames.push(fileHandle.name);
    }

    const arrListOfMetadataFileNames = arrListOfFileNames.map((fileName) => {
        return `${fileName}.metadata.json`;
    });

    for (const metadataFileName of arrListOfMetadataFileNames) {
        const [err, metadataFileHandle] = await tryCatchSafeAsync(() => handleForFolder.getFileHandle(metadataFileName));
        if (err) {
            // Skip this file
            // TODO: Send progress status (To log warning)
            continue;
        }
        const metadataFile = await metadataFileHandle.getFile();
        const metadataFileContents = await metadataFile.text();
        const [errParse, metadataFileJson] = tryCatchSafe(() => JSON.parse(metadataFileContents));
        if (errParse) {
            // Skip this file
            // TODO: Send progress status (To log warning)
            continue;
        }

        metadataFileJson.tags = metadataFileJson.tags || [];
        metadataFileJson.tags = [...new Set([...metadataFileJson.tags, ...tags])];

        const writableStream = await metadataFileHandle.createWritable();
        await writableStream.write(JSON.stringify(metadataFileJson, null, 4));

        // Calling ".close()" inside a setTimeout since individually it is a time consuming operation
        setTimeout(async () => {
            await writableStream.close();
        });
    }

    // TODO: This call might end before all the ".close()" calls are done.
    //       We may want to somehow "await" for all the setTimeout functions around those ".close()" calls
    return status;
};

const AddTagsDialog = ({
    open,
    onClose,
    handleForFolder,
    selectedFiles
}) => {
    const arrListOfFileNames = [];
    for (const fileHandle of selectedFiles) {
        arrListOfFileNames.push(fileHandle.name);
    }

    const [processOngoing, setProcessOngoing] = useState(false);

    const [userInput, setUserInput] = useState('');

    return (
        <ResponsiveDialog
            open={open}
            onClose={() => { onClose(); }}
            noPrimaryButton
        >
            <div className={styles.AddTagsDialog}>
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

                <div style={{ marginTop: 20 }}>
                    <div>
                        Tags to add:
                    </div>
                    <div style={{ marginTop: 5 }}>
                        <textarea
                            value={userInput}
                            style={{
                                width: '50%',
                                height: 100,
                                padding: '8px'
                            }}
                            onChange={(evt) => {
                                setUserInput(evt.target.value);
                            }}
                        />
                    </div>
                </div>
                <div style={{ display: 'flex', marginTop: 20 }}>
                    <div>
                        <button
                            disabled={processOngoing}
                            onClick={async () => {
                                setProcessOngoing(true);

                                let tags = userInput;
                                tags = tags.split('\n');
                                tags = tags.map((tag) => {
                                    return tag.trim();
                                });
                                tags = tags.filter(x => x);

                                const status = await addTagsToFiles({
                                    handleForFolder,
                                    files: selectedFiles,
                                    tags,
                                    onProgress: (progress) => {
                                        console.log('progress', progress);
                                    }
                                });

                                setProcessOngoing(false);
                            }}
                        >
                            Add tags
                        </button>
                    </div>
                </div>
            </div>
        </ResponsiveDialog>
    );
};

export { AddTagsDialog };
