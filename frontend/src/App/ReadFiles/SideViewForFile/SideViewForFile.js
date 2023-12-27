import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import classNames from 'classnames';

import { useAtom } from 'jotai';

import ky from 'ky';

import imageCompression from 'browser-image-compression';

import { humanReadableByteSize } from 'helpmate/dist/misc/humanReadableByteSize.js';

import {
    READYSTATE,

    UNINITIALIZED,
    LOADING,
    LOADED,
    ERROR,

    ERROR_CODE,
    ERROR_CODE_NOT_FOUND,
    ERROR_CODE_UNKNOWN
} from '../readyStates.js';

import { convertLocalTimeInIsoLikeFormat } from '../../utils/convertLocalTimeInIsoLikeFormat.js';

import { GenerateMetadataFile } from '../GenerateMetadataFile/GenerateMetadataFile.js';
import { MultiFileOperations } from '../MultiFileOperations/MultiFileOperations.js';

import { selectedFilesAtom } from '../../store/jotaiStore.js';

import uc from '../../../utility-classes.css';

const sortAndUniqueStringArray = function (array) {
    const output = [...new Set(array)].sort();
    return output;
};

const BasicEditor = ({ value, saveEnabledByDefault, onEdit, onSave, textareaStyle }) => {
    const [text, setText] = useState(value);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        if (saveEnabledByDefault) {
            setIsDirty(true);
        }
    }, [saveEnabledByDefault]);

    const flagEnableSave = isDirty;

    return (
        <div>
            <textarea
                value={text}
                onChange={(e) => {
                    setText(e.target.value);
                    setIsDirty(true);
                    if (onEdit) {
                        onEdit(e.target.value);
                    }
                }}
                style={textareaStyle}
            />
            <div style={{ display: 'flex', marginTop: 5 }}>
                <button
                    disabled={!flagEnableSave}
                    onClick={() => {
                        onSave(text);
                        setIsDirty(false);
                    }}
                >
                    {flagEnableSave ? 'Save' : 'Saved'}
                </button>
                <button
                    style={{ marginLeft: 5 }}
                    onClick={() => {
                        const json = JSON.parse(text);
                        const formattedJson = JSON.stringify(json, null, 4);
                        if (formattedJson !== text) {
                            setText(formattedJson);
                            setIsDirty(true);
                        }
                    }}
                >
                    Format JSON
                </button>
            </div>
        </div>
    );
};
BasicEditor.propTypes = {
    value: PropTypes.string.isRequired,
    saveEnabledByDefault: PropTypes.bool,
    onEdit: PropTypes.func,
    onSave: PropTypes.func.isRequired,
    textareaStyle: PropTypes.object
};

const MetadataEditor = function ({ handleForFolder, file, json }) {
    const [tags, setTags] = useState([]);
    const [tagsRaw, setTagsRaw] = useState([]);
    const [flagEnableSave, setFlagEnableSave] = useState(false);

    const [editorLastSetAt, setEditorLastSetAt] = useState(0);

    const [jsonVal, setJsonVal] = useState(json);

    return (
        <div>
            <BasicEditor
                key={editorLastSetAt}
                value={JSON.stringify(jsonVal, null, 4)}
                textareaStyle={{
                    width: '100%',
                    height: '350px'
                }}
                saveEnabledByDefault={flagEnableSave}
                onSave={async (text) => {
                    const metadataFileHandle = (
                        await handleForFolder.getFileHandle(
                            file.name + '.metadata.json',
                            { create: false }
                        )
                    );

                    // Write contents to file
                    const writable = await metadataFileHandle.createWritable();
                    await writable.write(text);
                    await writable.close();
                }}
            />

            <div style={{ marginTop: 10, display: 'flex' }}>
                <button
                    onClick={async () => {
                        const imageFile = file;
                        const imageCompressionOptions = {
                            maxSizeMB: 0.25,
                            maxWidthOrHeight: 500,
                            useWebWorker: true
                        };
                        const compressedFile = await imageCompression(imageFile, imageCompressionOptions);

                        const apiUrl = '/api/identifyTags';
                        const response = await ky.post(apiUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': file.type
                            },
                            timeout: 120000,
                            retry: 5,
                            body: compressedFile
                        });
                        const json = await response.json();

                        const arrTags = ((json) => {
                            const data = json.data;
                            const tags = data;
                            const arr = [];
                            for (const tag of tags) {
                                arr.push(tag.description);
                            }
                            return arr;
                        })(json);
                        setTags(arrTags);
                        setTagsRaw(json.data);
                    }}
                >
                    Generate tags
                </button>
                <button
                    style={{ marginLeft: 5 }}
                    onClick={async () => {
                        const outputJson = JSON.parse(JSON.stringify(jsonVal));
                        outputJson.tags = [
                            ...outputJson.tags || [],
                            ...tags
                        ];
                        outputJson.tags = sortAndUniqueStringArray(outputJson.tags);

                        if (Array.isArray(tagsRaw) && tagsRaw.length) {
                            outputJson.tagsRaw = tagsRaw;
                        }

                        setJsonVal(outputJson);
                        setFlagEnableSave(true);
                        setEditorLastSetAt(Date.now());
                    }}
                >
                    Sync tags to metadata
                </button>
            </div>
            {
                Array.isArray(tags) &&
                (
                    tags.length ?
                        (
                            <div style={{ marginTop: 10 }}>
                                <textarea
                                    value={JSON.stringify(tags, null, 4)}
                                    readOnly
                                    style={{
                                        width: '100%',
                                        height: 200
                                    }}
                                />
                            </div>
                        ) :
                        null
                )
            }
        </div>
    );
};
MetadataEditor.propTypes = {
    handleForFolder: PropTypes.object.isRequired,
    file: PropTypes.object.isRequired,
    json: PropTypes.object.isRequired
};

const MetadataFile = ({
    file,
    handleForFolder,
    dimensions,
    onLoad
}) => {
    const [metadataFileObject, setMetadataFileObject] = useState({
        [READYSTATE]: UNINITIALIZED,
        json: null
    });

    useEffect(() => {
        (async () => {
            setMetadataFileObject({
                [READYSTATE]: LOADING,
                json: null
            });

            try {
                let metadataFileHandle;
                try {
                    metadataFileHandle = (
                        await handleForFolder.getFileHandle(
                            file.name + '.metadata.json',
                            { create: false }
                        )
                    );
                } catch (e) {
                    setMetadataFileObject({
                        [READYSTATE]: ERROR,
                        [ERROR_CODE]: ERROR_CODE_NOT_FOUND,
                        json: null
                    });
                    return;
                }

                const metadataFile = await metadataFileHandle.getFile();
                const metadataFileContents = await metadataFile.text();
                const metadataFileJson = (() => {
                    try {
                        const json = JSON.parse(metadataFileContents);
                        return json;
                    } catch (e) {
                        if (
                            typeof metadataFileContents === 'string' &&
                            metadataFileContents.trim() === ''
                        ) {
                            return {};
                        } else {
                            return {
                                oldContent: metadataFileContents
                            };
                        }
                    }
                })();

                setMetadataFileObject({
                    [READYSTATE]: LOADED,
                    json: metadataFileJson
                });

                if (onLoad) {
                    onLoad(metadataFileJson);
                }
            } catch (e) {
                console.log(e);
                setMetadataFileObject({
                    [READYSTATE]: ERROR,
                    [ERROR_CODE]: ERROR_CODE_UNKNOWN,
                    json: null
                });
                return;
            }
        })();
    }, [file, handleForFolder]);

    return (
        <div>
            {(() => {
                if (metadataFileObject[READYSTATE] === ERROR) {
                    if (metadataFileObject[ERROR_CODE] === ERROR_CODE_NOT_FOUND) {
                        return (
                            <GenerateMetadataFile
                                file={file}
                                handleForFolder={handleForFolder}
                                dimensions={dimensions}
                                onError={(e) => {
                                    console.log(e);
                                    setMetadataFileObject({
                                        [READYSTATE]: ERROR,
                                        [ERROR_CODE]: ERROR_CODE_UNKNOWN,
                                        json: null
                                    });
                                }}
                                onSuccess={(metadata) => {
                                    setMetadataFileObject({
                                        [READYSTATE]: LOADED,
                                        json: metadata
                                    });
                                }}
                            />
                        );
                    } else {
                        return 'Unexpected Error';
                    }
                } else if (metadataFileObject[READYSTATE] === LOADED) {
                    return (
                        <MetadataEditor
                            handleForFolder={handleForFolder}
                            file={file}
                            json={metadataFileObject.json}
                        />
                    );
                } else {
                    return null;
                }
            })()}
        </div>
    );
};
MetadataFile.propTypes = {
    fileHandle: PropTypes.object.isRequired,
    file: PropTypes.object.isRequired,
    handleForFolder: PropTypes.object.isRequired,
    dimensions: PropTypes.object.isRequired,
    onLoad: PropTypes.func.isRequired
};

const SideViewForFile = function ({ handleForFolder }) {
    const [selectedFiles] = useAtom(selectedFilesAtom);

    const [dimensions, setDimensions] = useState(null);

    const [backgroundColor, setBackgroundColor] = useState('#fff');

    if (selectedFiles.size === 0) {
        return (
            <div className={classNames(uc.italic, uc.color_777, uc.textAlignCenter)}>
                No file selected
            </div>
        );
    } else if (selectedFiles.size >= 2) {
        return (
            <div style={{ padding: '20px 10px' }}>
                <div className={classNames(uc.italic, uc.color_777, uc.textAlignCenter)}>
                    {selectedFiles.size} files selected
                </div>

                <div style={{ marginTop: 10 }}>
                    <div>
                        <MultiFileOperations
                            selectedFiles={selectedFiles}
                            handleForFolder={handleForFolder}
                        />
                    </div>
                </div>
            </div>
        );
    } else {
        let selectedFile;
        for (const item of selectedFiles) {
            selectedFile = item;
            break; // Get the first element encountered and exit loop
        }

        const blob = new Blob([selectedFile], { type: selectedFile.type });
        const url = URL.createObjectURL(blob);

        return (
            <div style={{ margin: 10 }}>
                <div style={{ display: 'grid' }}>
                    <div
                        style={{
                            margin: 'auto'
                        }}
                    >
                        <div
                            style={{ borderRadius: 10, overflow: 'hidden' }}
                        >
                            <div
                                style={{
                                    width: 230,
                                    height: 230,
                                    display: 'grid',
                                    backgroundColor,

                                    // alignItems: 'center',
                                    // justifyItems: 'center',
                                    placeItems: 'center'
                                }}
                            >
                                <img
                                    src={url}
                                    style={{
                                        maxWidth: 230,
                                        maxHeight: 230
                                    }}
                                    onLoad={function (img) {
                                        // URL.revokeObjectURL(url);

                                        const loadedDimensions = {
                                            width: img.target.naturalWidth,
                                            height: img.target.naturalHeight
                                        };

                                        // FIXME: Use a better approach to compare objects (or at least use something like json-stable-stringify)
                                        if (JSON.stringify(dimensions) !== JSON.stringify(loadedDimensions)) {
                                            setDimensions(loadedDimensions);
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div style={{ marginTop: 15 }}>
                    <div>
                        <span style={{ fontWeight: 'bold' }}>Name:</span> {selectedFile.name}
                    </div>
                    <div style={{ marginTop: 3 }}>
                        <span style={{ fontWeight: 'bold' }}>Type:</span> {selectedFile.type}
                    </div>
                    <div style={{ marginTop: 3 }}>
                        <span style={{ fontWeight: 'bold' }}>Size:</span> {humanReadableByteSize(selectedFile.size)}
                    </div>
                    <div style={{ marginTop: 3 }}>
                        <span style={{ fontWeight: 'bold' }}>Last modified:</span> {
                            convertLocalTimeInIsoLikeFormat(selectedFile.lastModified)
                        }
                    </div>
                    <div style={{ marginTop: 10 }}>
                        <div style={{ fontWeight: 'bold' }}>
                            Metadata:
                        </div>
                        <div style={{ marginTop: 3 }}>
                            {
                                dimensions && // Wait for "dimensions" to be setup
                                <MetadataFile
                                    fileHandle={selectedFile}
                                    file={selectedFile}
                                    handleForFolder={handleForFolder}
                                    dimensions={dimensions}
                                    onLoad={function (metadata) {
                                        const { averageColor } = metadata;
                                        if (averageColor) {
                                            /* eslint-disable @stylistic/indent */
                                            const colorValue = [
                                                'rgba(',
                                                    averageColor.red, ', ',
                                                    averageColor.green, ', ',
                                                    averageColor.blue, ', ',
                                                    averageColor.alpha,
                                                ')'
                                            ].join('');
                                            /* eslint-enable @stylistic/indent */

                                            setBackgroundColor(colorValue);
                                        }
                                    }}
                                />
                            }
                        </div>
                    </div>
                </div>
            </div>
        );
    }
};
SideViewForFile.propTypes = {
    handleForFolder: PropTypes.oneOfType([
        PropTypes.object,
        PropTypes.oneOf([null])
    ])
};

export { SideViewForFile };
