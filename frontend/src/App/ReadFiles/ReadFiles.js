/* global showDirectoryPicker */

import React, { Fragment, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

import classNames from 'classnames';

import { Virtuoso } from 'react-virtuoso';
import ky from 'ky';

import { atom, useAtom } from 'jotai';

import Fuse from 'fuse.js';

import pMemoize from 'p-memoize';

import { clear } from 'idb-keyval';

import {
    getBatched,
    setBatched
} from './idbBatched.js';

import { humanReadableByteSize } from 'helpmate/dist/misc/humanReadableByteSize.js';

import { trackTime } from 'helpmate/dist/misc/trackTime.js';

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

const trackTimeAsync = trackTime.async;
window.trackTimeLog = trackTime.log; // DEV-HELPER

// TODO: FIXME: Various variable names have to be corrected as per their usage (since they were not adjusted properly
//              in accordance with the recent code refactoring).

const fuseOptions = {
    // isCaseSensitive: false,
    // includeScore: false,
    // shouldSort: true,
    // includeMatches: false,
    // findAllMatches: false,
    // minMatchCharLength: 1,
    // location: 0,
    // threshold: 0.6,
    // distance: 100,
    // useExtendedSearch: false,
    // ignoreLocation: false,
    // ignoreFieldNorm: false,
    // fieldNormWeight: 1,
    includeScore: true,
    keys: [
        {
            name: 'file.name',
            weight: 1
        },
        {
            name: 'details.tags',
            weight: 0.9
        }
    ]
};

window.count_VirtuosoExecuteSlowOperation = 0;

const CLEAR_INDEXEDDB = false; // DEV-HELPER
// const CLEAR_INDEXEDDB = true; // DEV-HELPER
if (CLEAR_INDEXEDDB) {
    clear();
}

const cacheMap = new Map();
window.cacheMap = cacheMap; // DEV-HELPER
const getBatchedMemoized = pMemoize(
    getBatched,
    {
        cache: cacheMap
    }
);

const selectedFileHandleAtom = atom(null);

const advancedSearchEnabledAtom = atom(false);

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
            dimensions: {
                width: dimensions.width,
                height: dimensions.height
            },
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
                    if (!delayedLoadTimer) { return; }
                    try {
                        let metadataFileHandle;
                        try {
                            metadataFileHandle = (
                                await handleForFolder.getFileHandle(
                                    `${file.name}.metadata.json`
                                    // { create: true }
                                )
                            );
                            if (!delayedLoadTimer) { return; }
                        } catch (e) {
                            setMetadataFileObject({
                                status: 'not-found',
                                json: null
                            });
                            return;
                        }

                        const metadataFile = await metadataFileHandle.getFile();
                        if (!delayedLoadTimer) { return; }
                        const metadataFileContents = await metadataFile.text();
                        if (!delayedLoadTimer) { return; }

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
                    try {
                        // Note: pMemoize does not cache the promises which throw an error hence we are using such API
                        //       for getBatchedMemoized and wrapping it in try-catch
                        const propsFromDb = await trackTimeAsync(
                            'dbReadProps',
                            () => getBatchedMemoized(idInDbForProps, 200)
                        );
                        if (!delayedLoadTimer) { return; }
                        props = propsFromDb;
                    } catch (e) {
                        // do nothing
                    }
                }
                if (!props) {
                    const computedDimensions = await getImageDimensionsFromBlob(imageBlob);
                    if (!delayedLoadTimer) { return; }
                    props = {
                        dimensions: computedDimensions
                    };

                    if (USE_INDEXEDDB) {
                        // TODO: FIXME: Handle error for this call
                        await trackTimeAsync(
                            'dbWriteProps',
                            // () => set(idInDbForProps, props),
                            () => setBatched(idInDbForProps, props, 100)
                        );
                        if (!delayedLoadTimer) { return; }
                    }
                }
                // FIXME: "react/prop-types" is getting applied incorrectly here since we set the vatiable name as "props"
                setDimensions(props.dimensions); // eslint-disable-line react/prop-types

                let thumb32;
                if (USE_INDEXEDDB) {
                    try {
                        thumb32 = await trackTimeAsync(
                            'dbReadThumb32',
                            () => getBatchedMemoized(idInDbForThumb32, 200)
                        );
                    } catch (e) {
                        // do nothing
                    }
                    if (!delayedLoadTimer) { return; }
                }
                if (!thumb32) {
                    thumb32 = await resizeImageBlob(imageBlob, 32, file.type);
                    if (!delayedLoadTimer) { return; }

                    if (USE_INDEXEDDB) {
                        const thumb32Blob = thumb32;

                        await trackTimeAsync(
                            'dbWriteThumb32',
                            // () => set(idInDbForThumb32, thumb32Blob), // TODO: FIXME: Handle error for this call
                            () => setBatched(idInDbForThumb32, thumb32Blob, 100) // TODO: FIXME: Handle error for this call
                        );

                        if (!delayedLoadTimer) { return; }
                    }
                }
                const url = URL.createObjectURL(thumb32);
                setImageBlob(url);
            // Some delay to allow for the "useEffect cancel" (clearTimeout) to take effect when the user is scrolling very fast
            // }, getRandomIntInclusive(100, 200));
            // }, 150);
            });
        })();

        return () => {
            clearTimeout(delayedLoadTimer);
            delayedLoadTimer = null;

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

const getObjectProperty = function (obj, propertyPath) {
    // Extract the nested property value from the object
    const properties = propertyPath.split('.');
    let value = obj;
    for (const property of properties) {
        if (value[property] !== undefined) {
            value = value[property];
        } else {
            // Handle cases where the nested property doesn't exist in the object
            return undefined;
        }
    }
    return value;
};
const sortFnByPropertyPath = function (propertyPath, options = {}) {
    const order = options.order || 'asc';

    return function (a, b) {
        // Extract the nested property value from both objects
        const propA = getObjectProperty(a, propertyPath);
        const propB = getObjectProperty(b, propertyPath);

        if (order === 'desc') {
            if (propA === undefined || propA === null) return 1;
            if (propB === undefined || propA === null) return -1;
            if (propA > propB) return -1;
            if (propA < propB) return 1;
            return 0;
        } else {
            if (propA === undefined || propA === null) return -1;
            if (propB === undefined || propA === null) return 1;
            if (propA < propB) return -1;
            if (propA > propB) return 1;
            return 0;
        }
    };
};

const ShowImagesWrapper = function ({
    handleForFolder,
    filesAndDetails,
    searchQuery,
    resourcesCount,
    relevantHandlesCount,
    relevantFilesTotal
}) {
    const [sortBy, setSortBy] = useState(null);

    const clonedFilesAndDetails = useMemo(() => {
        return structuredClone(filesAndDetails);
    }, [filesAndDetails]);

    const sortBy_Field = sortBy && sortBy.field;
    const sortBy_Order = sortBy && sortBy.order;

    const finalList = useMemo(() => {
        let filtered = clonedFilesAndDetails;
        if (Array.isArray(clonedFilesAndDetails) && searchQuery.query) {
            const fuse = new Fuse(clonedFilesAndDetails, fuseOptions);
            let searchResults = fuse.search(searchQuery.query);
            searchResults = searchResults.filter((item) => item.score < 0.25);
            searchResults.sort((a, b) => {
                if (a.score < b.score) {
                    return -1;
                } else if (a.score > b.score) {
                    return 1;
                } else {
                    return 0;
                }
            });
            searchResults = searchResults.map((item) => item.item);

            filtered = searchResults;
        }

        if (filtered) {
            if (sortBy && sortBy.field === 'size') {
                const propertyPath = 'file.size';
                filtered.sort(sortFnByPropertyPath(propertyPath, { order: sortBy.order }));
            }
        }
        const finalList = filtered;
        return finalList;
    }, [clonedFilesAndDetails, searchQuery.query, sortBy_Field, sortBy_Order]);

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
                            setSortBy({ field: 'size', order: 'desc' });
                        } else if (sortBy && sortBy.field === 'size' && sortBy.reverse) {
                            setSortBy(null);
                        } else {
                            setSortBy({ field: 'size', order: 'asc' });
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
                    data={finalList}

                    // Adjust UX+performance:
                    //     * Higher value here means:
                    //           * faster rendering when scrolling to nearby items (eg: pressing down arrow on keyboard)
                    //           * slower rendering when scrolling to far away items (eg: making huge scroll jump with mouse)
                    increaseViewportBy={500}

                    itemContent={(index, fileAndDetails) => {
                        const file = fileAndDetails.file;
                        const fileName = file.name;
                        const details = fileAndDetails.details;
                        return (
                            <ImageFromAssetFile
                                key={fileName}
                                assetFile={file}
                                handleForFolder={handleForFolder}
                            />
                        );
                    }}
                />
            </div>
            <div>
                <div
                    style={{
                        display: 'flex',
                        height: 34,
                        padding: '5px 10px',
                        backgroundColor: '#eee'
                    }}
                >
                    <div style={{ lineHeight: '24px' }}>
                        Resources: {
                            resourcesCount === null ? 'Not loaded' : resourcesCount
                        }
                    </div>
                    <div style={{ lineHeight: '24px' }}>
                        {(() => {
                            if (relevantHandlesCount === null) {
                                return null;
                            } else {
                                return (
                                    <span>
                                        {' ; '}
                                        Images: {relevantHandlesCount}/{relevantFilesTotal}
                                    </span>
                                );
                            }
                        })()}
                    </div>
                </div>
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

const buildIndex = async function ({
    handleForFolder,
    statusUpdateCallback
}) {
    try {

        /*
        // Go through all the files in the folder and find all the files.
        Example input:
            * abc.jpg
            * abc.jpg.metadata.json
            * def.exe
            * ghi.png
            * ghi.png.metadata.json
            * jkl.doc
            * mno.jpg
            * pqr.txt
            * stu.xlsx.metadata.json

        // Now, split them into two sets. One set contains the files ending with the extension ".metadata.json". The other
        // set contains the files that don't end with the extension ".metadata.json".
        Split into two sets:
            Set 1: Set without ".metadata.json" extension:
                * abc.jpg
                * def.exe
                * ghi.png
                * jkl.doc
                * mno.jpg
                * pqr.txt
            Set 2: Set with ".metadata.json" extension:
                * abc.jpg.metadata.json
                * ghi.png.metadata.json
                * stu.xlsx.metadata.json

        // Now from the Set 2 (the one with ".metadata.json" extension), create another set with the same files but without
        // the extension ".metadata.json". This will be the set of files for which we have metadata. We call it Set 3.
        Set 3: Set created from the list of files with ".metadata.json" extension, but without the extension ".metadata.json"
            * abc.jpg
            * ghi.png
            * stu.xlsx

        // Now from the Set 1 (the one without ".metadata.json" extension), remove all the entries that are in the Set 3.
        // This will be the set of files for which we don't have the corresponding ".metadata.json" file. We call it Set 4.
        Set 4: Set created from the list of files without ".metadata.json" extension, but not in the Set 3.
            * def.exe
            * jkl.doc
            * mno.jpg
            * pqr.txt

        Now, for each file in the Set 4, create a new file with the same name but with the extension ".metadata.json".
        */

        const iterator = await handleForFolder.values();

        const listFileHandles = [];
        for await (const handleForFile of iterator) {
            listFileHandles.push(handleForFile);
        }

        const handlesForActualFiles = listFileHandles.filter(function (item) {
            return item.kind === 'file';
        });

        const handlesForActualMetadataFiles = handlesForActualFiles.filter(function (file) {
            return file.name.endsWith('.metadata.json');
        });

        const namesOfFilesWithMetadataWithoutMetadataExtension = handlesForActualMetadataFiles.map(function (file) {
            return file.name.replace(/\.metadata\.json$/, '');
        });

        const setNamesOfFilesWithMetadataWithoutMetadataExtension = new Set(namesOfFilesWithMetadataWithoutMetadataExtension);

        const handlesForActualNonMetadataFiles = handlesForActualFiles.filter(function (file) {
            if (file.name.endsWith('.metadata.json')) {
                return false;
            } else {
                return true;
            }
        });

        const handlesForFilesForWhichMetadataFileNeedsToBeCreated = handlesForActualNonMetadataFiles.filter(function (file) {
            if (setNamesOfFilesWithMetadataWithoutMetadataExtension.has(file.name)) {
                return false;
            } else {
                return true;
            }
        });

        let filesCreated = 0;
        const filesToBeCreated = handlesForFilesForWhichMetadataFileNeedsToBeCreated.length;
        // Now create the ".metadata.json" files for the files for which they don't exist.
        for (const handleForFile of handlesForFilesForWhichMetadataFileNeedsToBeCreated) {
            const handleForMetadataFile = await trackTimeAsync(
                'buildIndex_getFileHandle',
                () => handleForFolder.getFileHandle(handleForFile.name + '.metadata.json', { create: true })
            );

            const file = await trackTimeAsync(
                'buildIndex_getFile',
                () => handleForFile.getFile()
            );

            const metadata = {
                name: file.name,
                type: file.type,
                size: file.size,
                lastModified: file.lastModified
            };

            if (file.type === 'image/jpeg' || file.type === 'image/png') {
                const imageBlob = new Blob([file], { type: file.type });
                const dimensions = await getImageDimensionsFromBlob(imageBlob);
                metadata.dimensions = dimensions;
            }

            const writableStream = await trackTimeAsync(
                'buildIndex_createWritable',
                () => handleForMetadataFile.createWritable()
            );

            await trackTimeAsync(
                'buildIndex_write',
                () => writableStream.write(JSON.stringify(metadata, null, 4))
            );

            setTimeout(async function () {
                await trackTimeAsync(
                    'buildIndex_closeStream',
                    () => writableStream.close()
                );

                filesCreated++;
                statusUpdateCallback({
                    filesCreated,
                    filesToBeCreated
                });
            });
        }
        return [null];
    } catch (e) {
        return [e];
    }

};

const BuildIndex = function ({ handleForFolder }) {
    const [progressStatus, setProgressStatus] = useState(null);
    return (
        <div style={{ display: 'flex' }}>
            <button
                type="button"
                onClick={async () => {
                    setProgressStatus(null);

                    const [err] = await buildIndex({
                        handleForFolder,
                        statusUpdateCallback: function (status) {
                            const { filesCreated, filesToBeCreated } = status;
                            setProgressStatus({
                                filesCreated,
                                filesToBeCreated
                            });
                        }
                    });
                }}
            >
                Build index
            </button>
            {
                progressStatus &&
                <Fragment>
                    <div style={{ marginLeft: 10, lineHeight: '20px' }}>
                        {progressStatus.filesCreated} / {progressStatus.filesToBeCreated}
                    </div>
                    <div style={{ marginLeft: 5, lineHeight: '20px' }}>
                        ({
                            parseInt(
                                1000 *
                                (progressStatus.filesCreated / progressStatus.filesToBeCreated)
                            ) / 10
                        }%)
                    </div>
                </Fragment>
            }
        </div>
    );
};

const AdvancedSearchOptions = function ({ handleForFolder }) {
    const [advancedSearchEnabled, setAdvancedSearch] = useAtom(advancedSearchEnabledAtom);

    const checkboxEnabled = !!handleForFolder;
    return (
        <div>
            <div>
                <label style={{ display: 'flex' }}>
                    <div>
                        <input
                            type="checkbox"
                            disabled={!checkboxEnabled}
                            checked={advancedSearchEnabled}
                            style={{ marginLeft: 0 }}
                            onChange={function (event) {
                                setAdvancedSearch(event.target.checked);
                            }}
                        />
                    </div>
                    <div
                        style={{
                            lineHeight: '20px',
                            marginLeft: 5,
                            opacity: checkboxEnabled ? 1 : 0.5
                        }}
                    >
                        Advanced Search
                    </div>
                </label>
            </div>
            {
                advancedSearchEnabled &&
                <div style={{ marginLeft: 20, marginTop: 2 }}>
                    <div>
                        <div>
                            <BuildIndex
                                handleForFolder={handleForFolder}
                            />
                        </div>
                    </div>
                </div>
            }
        </div>
    );
};

const ReadFiles = function () {
    const [handleForFolder, setHandleForFolder] = useState(null);
    const [resourcesCount, setResourcesCount] = useState(null);
    const [relevantHandlesCount, setRelevantFilesCount] = useState(null);
    const [relevantFilesTotal, setRelevantFilesTotal] = useState(null);
    const [filesAndDetails, setFilesAndDetails] = useState(null);

    const [selectedFileHandle, setSelectedFileHandle] = useAtom(selectedFileHandleAtom);

    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState({
        mode: 'normal',
        query: null
    });

    const [advancedSearchEnabled, setAdvancedSearch] = useAtom(advancedSearchEnabledAtom);

    const setQueryWithMode = function () {
        const mode = advancedSearchEnabled ? 'advanced' : 'normal';

        let query = searchInput.trim();
        if (query === '') {
            query = null;
        }

        setSearchQuery({
            mode,
            query
        });
    };

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
                            setRelevantFilesCount(null);
                            setRelevantFilesTotal(null);
                            setFilesAndDetails(null);
                            setSelectedFileHandle(null);

                            // Get handles for all the files
                            const handles = [];
                            let index = 0;
                            setResourcesCount(index);
                            const iterator = dirHandle.values();
                            while (true) {
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
                                    entry.name.endsWith('.png')
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
                                        file,
                                        details: {}
                                    });

                                    setRelevantFilesCount(filesAndDetails.length);
                                }
                                setFilesAndDetails(filesAndDetails);
                            })();
                        }}
                    >
                        Open Folder
                        <span style={{ color: '#999' }}>
                            {' (from disk)'}
                        </span>
                    </button>
                </div>
            </div>

            <div style={{ marginTop: 15 }}>
                <div style={{ display: 'flex' }}>
                    <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => {
                            setSearchInput(e.target.value);
                        }}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                setQueryWithMode();
                            }
                        }}
                    />

                    <button
                        style={{
                            cursor: 'pointer',
                            marginLeft: 10
                        }}
                        disabled={!handleForFolder}
                        onClick={async () => {
                            setQueryWithMode();
                        }}
                    >
                        Search
                    </button>
                </div>
            </div>
            <div style={{ marginTop: 5 }}>
                <AdvancedSearchOptions
                    handleForFolder={handleForFolder}
                />
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
                        filesAndDetails={filesAndDetails}
                        searchQuery={searchQuery}
                        resourcesCount={resourcesCount}
                        relevantHandlesCount={relevantHandlesCount}
                        relevantFilesTotal={relevantFilesTotal}
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
