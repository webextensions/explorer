/* global showDirectoryPicker */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

import classNames from 'classnames';

import { Virtuoso } from 'react-virtuoso';
import ky from 'ky';

import { atom, useAtom } from 'jotai';

import { get, set, clear } from 'idb-keyval';

import { humanReadableByteSize } from 'helpmate/dist/misc/humanReadableByteSize.js';

import uc from '../../utility-classes.css';
import styles from './ReadFiles.css';

import {
    READYSTATE,

    UNINITIALIZED,
    LOADING,
    LOADED,
    ERROR,

    ERROR_CODE,
    ERROR_CODE_NOT_FOUND,
    ERROR_CODE_UNKNOWN
} from './readyStates.js';

// TODO: FIXME: Various variable names have to be corrected as per their usage (since they were not adjusted properly
//              in accordance with the recent code refactoring).

// DEV-HELPER
window.trackTime_dbReadProps = 0;
window.trackTime_dbReadThumb32 = 0;
window.trackTime_dbWriteProps = 0;
window.trackTime_dbWriteThumb32 = 0;

window.count_VirtuosoExecuteSlowOperation = 0;

const CLEAR_INDEXEDDB = false; // DEV-HELPER
// const CLEAR_INDEXEDDB = true; // DEV-HELPER
if (CLEAR_INDEXEDDB) {
    clear();
}

const selectedFileHandleAtom = atom(null);

const convertLocalTimeInIsoLikeFormat = (timestamp, options = {}) => {
    if (typeof timestamp === 'number') {
        let localTime = (new Date(timestamp - (new Date()).getTimezoneOffset() * 60 * 1000)).toISOString().substr(0, 19).replace('T', ' ');

        const showTimezone = options.showTimezone;
        if (showTimezone) {
            // https://stackoverflow.com/questions/9772955/how-can-i-get-the-timezone-name-in-javascript/44935836#44935836
            localTime += ' ' + Intl.DateTimeFormat().resolvedOptions().timeZone;
        }

        return localTime;
    } else {
        return 'NA';
    }
};

const getImageDimensionsFromBlob = async function (imageBlob) {
    const imageBitmap = await createImageBitmap(imageBlob);

    const {
        width,
        height
    } = imageBitmap;

    return {
        width,
        height
    };
};

const resizeImageBlob = async function (imageBlob, maxSize, mimeType) {
    // Create a canvas element with the maximum size
    const canvas = document.createElement('canvas');
    canvas.width = maxSize;
    canvas.height = maxSize;

    // Get the canvas context
    const ctx = canvas.getContext('2d');

    // Create an image element
    const img = document.createElement('img');

    // Set the image element's src attribute to the image data
    img.src = URL.createObjectURL(imageBlob);

    // Wait for the image to load
    await new Promise((resolve, reject) => {
        img.addEventListener('load', resolve);
        img.addEventListener('error', reject);
    });

    // Get the image's width and height
    const { width, height } = img;

    // Calculate the new width and height
    let newWidth,
        newHeight;
    if (width > height) {
        newWidth = maxSize;
        newHeight = (height / width) * maxSize;
    } else {
        newWidth = (width / height) * maxSize;
        newHeight = maxSize;
    }

    // Draw the image on the canvas
    ctx.drawImage(img, 0, 0, newWidth, newHeight);

    // Convert the canvas to a blob
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob);
        }, mimeType);
    });
};

// eslint-disable-next-line no-unused-vars
const getFile = async function () {
    // Open file picker and destructure the result the first handle
    const [fileHandle] = await window.showOpenFilePicker();
    const file = await fileHandle.getFile();
    return file;
};

// eslint-disable-next-line no-unused-vars
const timeout = function (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
};

const sortAndUniqueStringArray = function (array) {
    return [...new Set(array)].sort();
};

const createMetadataForImage = async function ({ handleForFolder, imageFile, dimensions }) {
    try {
        const metadataFileHandle = (
            await handleForFolder.getFileHandle(`${imageFile.name}.metadata.json`, { create: true })
        );

        // Write contents to file
        const metadata = {
            name: imageFile.name,
            type: imageFile.type,
            size: imageFile.size,
            width: dimensions.width,
            height: dimensions.height,
            lastModified: imageFile.lastModified
        };
        const writable = await metadataFileHandle.createWritable();
        await writable.write(JSON.stringify(metadata, null, 4));
        await writable.close();

        return [null, metadata];
    } catch (e) {
        return [e];
    }
};

const GenerateMetadataFile = ({ fileHandle, handleForFolder, dimensions, onError, onSuccess }) => {
    return (
        <button
            onClick={async () => {
                const file = fileHandle;

                const [err, metadata] = await createMetadataForImage({
                    handleForFolder,
                    imageFile: file,
                    dimensions
                });

                if (err) {
                    onError(err);
                } else {
                    onSuccess(metadata);
                }
            }}
        >
            Generate metadata file
        </button>
    );
};
GenerateMetadataFile.propTypes = {
    fileHandle: PropTypes.object.isRequired,
    handleForFolder: PropTypes.object.isRequired,
    dimensions: PropTypes.object.isRequired,
    onError: PropTypes.func.isRequired,
    onSuccess: PropTypes.func.isRequired
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
            <div style={{ display: 'flex' }}>
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

const MetadataEditor = function ({ handleForFolder, fileHandle, file, json }) {
    const [tags, setTags] = useState([]);
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
                    height: '150px'
                }}
                saveEnabledByDefault={flagEnableSave}
                onSave={async (text) => {
                    const metadataFileHandle = (
                        await handleForFolder.getFileHandle(
                            fileHandle.name + '.metadata.json',
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
                        const response = await ky.post('/api/identify-tags', {
                            method: 'POST',
                            headers: {
                                'Content-Type': file.type
                            },
                            timeout: 120000,
                            body: file
                        });
                        const json = await response.json();

                        const arrTags = ((json) => {
                            const data = json.data;
                            const arr = [];
                            for (const tag of data.result.tags) {
                                arr.push(tag.tag.en);
                            }
                            return arr;
                        })(json);
                        setTags(arrTags);
                    }}
                >
                    Generate tags
                </button>
                <button
                    onClick={async () => {
                        const outputJson = JSON.parse(JSON.stringify(jsonVal));
                        outputJson.tags = [
                            ...outputJson.tags || [],
                            ...tags
                        ];
                        outputJson.tags = sortAndUniqueStringArray(outputJson.tags);
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
    fileHandle: PropTypes.object.isRequired,
    file: PropTypes.object.isRequired,
    json: PropTypes.object.isRequired
};

const MetadataFile = ({ fileHandle, file, handleForFolder, dimensions }) => {
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
                            fileHandle.name + '.metadata.json',
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
                const metadataFileJson = JSON.parse(metadataFileContents);

                setMetadataFileObject({
                    [READYSTATE]: LOADED,
                    json: metadataFileJson
                });
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
    }, [fileHandle, handleForFolder]);

    return (
        <div>
            {(() => {
                if (metadataFileObject[READYSTATE] === ERROR) {
                    if (metadataFileObject[ERROR_CODE] === ERROR_CODE_NOT_FOUND) {
                        return (
                            <GenerateMetadataFile
                                fileHandle={fileHandle}
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
                            fileHandle={fileHandle}
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
    dimensions: PropTypes.object.isRequired
};

const getRandomIntInclusive = function (min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1) + min); // The maximum is inclusive and the minimum is inclusive
};

const ImageFromAssetFile = ({
    assetFile,
    handleForFolder
}) => {
    const [file, setFile] = useState(null);
    const [imageBlob, setImageBlob] = useState(null);
    const [dimensions, setDimensions] = useState(null);

    const [metadataFileObject, setMetadataFileObject] = useState({
        status: null,
        json: null
    });

    // eslint-disable-next-line no-unused-vars
    const [output, setOutput] = useState(null);

    useEffect(() => {
        let delayedLoadTimer = null;
        (async () => {
            const file = assetFile;
            setFile(file);

            delayedLoadTimer = setTimeout(async () => {
                window.count_VirtuosoExecuteSlowOperation++;

                (async () => {
                    try {
                        let metadataFileHandle;
                        try {
                            metadataFileHandle = (
                                await handleForFolder.getFileHandle(
                                    `${file.name}.metadata.json`
                                    // { create: true }
                                )
                            );
                        } catch (e) {
                            setMetadataFileObject({
                                status: 'not-found',
                                json: null
                            });
                            return;
                        }

                        const metadataFile = await metadataFileHandle.getFile();
                        const metadataFileContents = await metadataFile.text();

                        const json = JSON.parse(metadataFileContents);
                        setMetadataFileObject({
                            status: 'found',
                            json
                        });
                    } catch (err) {
                        console.log(err);
                        setMetadataFileObject({
                            status: 'error',
                            json: null
                        });
                        return;
                    }
                })();

                const imageBlob = new Blob([file], { type: file.type });

                const USE_INDEXEDDB = true; // DEV-HELPER
                // const USE_INDEXEDDB = false; // DEV-HELPER

                const idInDbForProps   = `${file.name}:${file.lastModified}:${file.size}:props`;
                const idInDbForThumb32 = `${file.name}:${file.lastModified}:${file.size}:thumb32`;

                let props;
                if (USE_INDEXEDDB) {
                    const begin = Date.now();
                    const propsFromDb = await get(idInDbForProps);
                    props = propsFromDb;
                    const end = Date.now();
                    window.trackTime_dbReadProps += (end - begin);
                }
                if (!props) {
                    const computedDimensions = await getImageDimensionsFromBlob(imageBlob);
                    props = {
                        dimensions: computedDimensions
                    };
                }
                // FIXME: "react/prop-types" is getting applied incorrectly here since we set the vatiable name as "props"
                setDimensions(props.dimensions); // eslint-disable-line react/prop-types
                if (USE_INDEXEDDB) {
                    const begin = Date.now();
                    await set(idInDbForProps, props);
                    const end = Date.now();
                    window.trackTime_dbWriteProps += (end - begin);
                }

                let thumb32;
                if (USE_INDEXEDDB) {
                    const begin = Date.now();
                    thumb32 = await get(idInDbForThumb32);
                    const end = Date.now();
                    window.trackTime_dbReadThumb32 += (end - begin);
                }
                if (!thumb32) {
                    thumb32 = await resizeImageBlob(imageBlob, 32, file.type);
                }
                if (USE_INDEXEDDB) {
                    const begin = Date.now();
                    const thumb32Blob = thumb32;
                    await set(idInDbForThumb32, thumb32Blob);
                    const end = Date.now();
                    window.trackTime_dbWriteThumb32 += (end - begin);
                }
                const url = URL.createObjectURL(thumb32);
                setImageBlob(url);
            // Some delay to allow for the "useEffect cancel" (clearTimeout) to take effect when the user is scrolling very fast
            // }, getRandomIntInclusive(100, 200));
            }, 150);
        })();

        return () => {
            clearTimeout(delayedLoadTimer);

            // URL.revokeObjectURL(imageBlob);
        };
    }, [assetFile, handleForFolder]);

    const [selectedFileHandle, setSelectedFileHandle] = useAtom(selectedFileHandleAtom);

    return (
        <div
            style={{ display: 'flex' }}
            onClick={async () => {
                if (selectedFileHandle === assetFile) {
                    setSelectedFileHandle(null);
                } else {
                    setSelectedFileHandle(assetFile);
                }
            }}
            className={
                classNames(
                    styles.fileRow,
                    assetFile === selectedFileHandle ? styles.selectedFileRow : null
                )
            }
        >
            <div className={classNames(styles.cell, styles.fileIconImage)}>
                <img
                    src={imageBlob}
                    style={{
                        maxWidth: 32,
                        maxHeight: 32
                    }}
                    onLoad={function () {
                        // URL.revokeObjectURL(imageBlob);
                    }}
                />
            </div>
            <div className={classNames(styles.cell, styles.fileName)}>
                {(file && file.name) || ''}
            </div>
            <div className={classNames(styles.cell, styles.fileType)}>
                {(file && file.type) || ''}
            </div>
            <div className={classNames(styles.cell, styles.fileSize)}>
                {
                    (file && humanReadableByteSize(file.size)) ||
                    ''
                }
            </div>
            <div className={classNames(styles.cell, styles.fileDimensions)}>
                {
                    (
                        dimensions &&
                        dimensions.width &&
                        dimensions.height &&
                        `${dimensions.width}x${dimensions.height}`
                    ) ||
                    ''
                }
            </div>
            <div className={classNames(styles.cell, styles.fileLastModified)}>
                {
                    (
                        file &&
                        convertLocalTimeInIsoLikeFormat(file.lastModified)
                    ) ||
                    ''
                }
            </div>
            <div className={classNames(styles.cell, styles.metadataContents)}>
                {(() => {
                    if (metadataFileObject.status === 'found') {
                        const json = metadataFileObject.json;
                        const tags = json.tags || [];
                        return (
                            <div title={tags.join('\n')}>
                                {tags.length} tags
                            </div>
                        );
                    } else if (metadataFileObject.status === 'not-found') {
                        return (
                            <div>
                                <a
                                    title="Create metadata file"
                                    href="#"
                                    onClick={async (evt) => {
                                        evt.preventDefault();

                                        const [err, metadata] = await createMetadataForImage({
                                            handleForFolder,
                                            imageFile: file,
                                            dimensions
                                        });

                                        if (err) {
                                            setMetadataFileObject({
                                                status: 'error',
                                                json: null
                                            });
                                        } else {
                                            setMetadataFileObject({
                                                status: 'found',
                                                json: metadata
                                            });
                                        }
                                    }}
                                >
                                    Create
                                </a>
                            </div>
                        );
                    } else if (metadataFileObject.status === 'error') {
                        return (
                            <div>Error</div>
                        );
                    } else {
                        return (
                            <div></div>
                        );
                    }
                })()}
            </div>
            <div>
                {
                    output && (
                        <div>
                            <textarea
                                value={JSON.stringify(output, null, 4)}
                                readOnly
                                style={{
                                    width: 500,
                                    height: 200
                                }}
                            />
                        </div>
                    )
                }
            </div>
        </div>
    );
};
ImageFromAssetFile.propTypes = {
    assetFile: PropTypes.object.isRequired,
    handleForFolder: PropTypes.object.isRequired
};

const sortFnByField = (field) => {
    return (a, b) => {
        if (a[field] < b[field]) {
            return -1;
        } else if (a[field] > b[field]) {
            return 1;
        } else {
            return 0;
        }
    };
};
const sortFnByFieldReverse = (field) => {
    return (a, b) => {
        if (a[field] < b[field]) {
            return 1;
        } else if (a[field] > b[field]) {
            return -1;
        } else {
            return 0;
        }
    };
};

const ShowImagesWrapper = ({
    handleForFolder,
    files
}) => {
    const [sortBy, setSortBy] = useState(null);

    const sortedFiles = structuredClone(files);

    if (sortedFiles) {
        if (sortBy && sortBy.field === 'size') {
            if (sortBy.reverse) {
                sortedFiles.sort(sortFnByFieldReverse(sortBy.field));
            } else {
                sortedFiles.sort(sortFnByField(sortBy.field));
            }
        }
    }
    return (
        <div style={{ width: 830, border: '1px solid #ccc', borderRadius: 10, overflow: 'hidden' }}>
            <div className={styles.headerRow}>
                <div className={classNames(styles.cell, styles.fileIconHeader)}>
                    &nbsp;
                </div>
                <div className={classNames(styles.cell, styles.fileName, 'bold')}>
                    Name
                </div>
                <div className={classNames(styles.cell, styles.fileType, 'bold')}>
                    Type
                </div>
                <div
                    className={classNames(styles.cell, styles.fileSize)}
                    onClick={() => {
                        if (sortBy && sortBy.field === 'size' && !sortBy.reverse) {
                            setSortBy({ field: 'size', reverse: true });
                        } else if (sortBy && sortBy.field === 'size' && sortBy.reverse) {
                            setSortBy(null);
                        } else {
                            setSortBy({ field: 'size', reverse: false });
                        }
                    }}
                >
                    Size
                </div>
                <div className={classNames(styles.cell, styles.fileDimensions)}>
                    Dimensions
                </div>
                <div className={classNames(styles.cell, styles.fileLastModified)}>
                    Last modified
                </div>
                <div className={classNames(styles.cell, styles.metadataContents)}>
                    Metadata
                </div>
            </div>
            <div>
                <Virtuoso
                    style={{ height: '500px' }}
                    data={sortedFiles}

                    // Adjust UX+performance:
                    //     * Higher value here means faster rendering when scrolling to nearby items (eg: pressing down arrow on keyboard)
                    //     * Higher value here means slower rendering when scrolling to far away items (eg: making huge scroll jump with mouse)
                    increaseViewportBy={500}

                    itemContent={(index, assetFile) => {
                        const fileName = assetFile.name;
                        return (
                            <ImageFromAssetFile
                                key={fileName}
                                assetFile={assetFile}
                                handleForFolder={handleForFolder}
                            />
                        );
                    }}
                />
            </div>
        </div>
    );
};
ShowImagesWrapper.propTypes = {
    handleForFolder: PropTypes.object,
    files: PropTypes.array.isRequired // TODO: Or null
};

const SideViewForFile = function ({ handleForFolder }) {
    // eslint-disable-next-line no-unused-vars
    const [selectedFileHandle, setSelectedFileHandle] = useAtom(selectedFileHandleAtom);
    const [selectedFile, setSelectedFile] = useState(null);

    const [dimensions, setDimensions] = useState(null);

    useEffect(() => {
        if (selectedFileHandle) {
            (async () => {
                const file = selectedFileHandle;
                setSelectedFile(file);
            })();
        }
    }, [selectedFileHandle]);

    if (!selectedFileHandle) {
        return (
            <div className={classNames(uc.italic, uc.color_777, uc.textAlignCenter)}>
                No file selected
            </div>
        );
    } else {
        if (selectedFile) {
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
                                <img
                                    src={url}
                                    style={{
                                        maxWidth: '230px',
                                        maxHeight: '230px'
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
                    <div style={{ marginTop: 10 }}>
                        <div>
                            Name: {selectedFile.name}
                        </div>
                        <div>
                            Type: {selectedFile.type}
                        </div>
                        <div>
                            Size: {humanReadableByteSize(selectedFile.size)}
                        </div>
                        <div>
                            Last modified: {
                                convertLocalTimeInIsoLikeFormat(selectedFile.lastModified)
                            }
                        </div>
                        <div style={{ marginTop: 10 }}>
                            <div>
                                Metadata:
                            </div>
                            <div>
                                {
                                    dimensions && // Wait for "dimensions" to be setup
                                    <MetadataFile
                                        fileHandle={selectedFileHandle}
                                        file={selectedFile}
                                        handleForFolder={handleForFolder}
                                        dimensions={dimensions}
                                    />
                                }
                            </div>
                        </div>
                    </div>
                </div>
            );
        } else {
            return (
                <div>
                    Loading...
                </div>
            );
        }
    }
};
SideViewForFile.propTypes = {
    handleForFolder: PropTypes.object.isRequired
};

const ReadFiles = () => {
    const [files, setFiles] = useState(null);

    const [handleForFolder, setHandleForFolder] = useState(null);

    return (
        <div>
            <div style={{ display: 'grid' }}>
                <div style={{ margin: 'auto' }}>
                    <button
                        style={{
                            cursor: 'pointer'
                        }}
                        onClick={async () => {
                            let dirHandle;
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

                            // Get handles for all the files
                            const handles = [];
                            for await (const entry of dirHandle.values()) {
                                if (
                                    entry.kind === 'file' &&
                                    (
                                        entry.name.endsWith('.jpeg') ||
                                        entry.name.endsWith('.jpg')  ||
                                        entry.name.endsWith('.png')
                                    )
                                ) {
                                    handles.push(entry);
                                }
                            }

                            (async () => {
                                const files = [];
                                for (const handle of handles) {
                                    const file = await handle.getFile();
                                    files.push(file);
                                }
                                setFiles(files);
                            })();
                            setFiles(files);
                        }}
                    >
                        Open Folder
                        <span style={{ color: '#999' }}>
                            {' (from disk)'}
                        </span>
                    </button>
                </div>
            </div>

            <div
                style={{
                    marginTop: 15,
                    display: 'flex'
                }}
            >
                <div>
                    <ShowImagesWrapper
                        handleForFolder={handleForFolder}
                        files={files}
                    />
                </div>
                <div
                    style={{
                        marginLeft: 15,
                        border: '1px solid #ccc',
                        borderRadius: 10,
                        overflow: 'hidden',
                        width: 252
                    }}
                >
                    <SideViewForFile handleForFolder={handleForFolder} />
                </div>
            </div>
        </div>
    );
};

export { ReadFiles };
