/* global showDirectoryPicker */

import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

import classNames from 'classnames';

import { Virtuoso } from 'react-virtuoso';
import ky from 'ky';

import { atom, useAtom } from 'jotai';

import Fuse from 'fuse.js';

import imageCompression from 'browser-image-compression';

import { getImageDimensionsFromBlob } from '../utils/getImageDimensionsFromBlob.js';
import { resizeImageBlob } from '../utils/resizeImageBlob.js';

// FIXME: Fix this issue
// eslint-disable-next-line import/no-unresolved
import pMemoize from 'p-memoize';

import { clear } from 'idb-keyval';

import {
    getBatched,
    setBatched
} from './idbBatched.js';

import { humanReadableByteSize } from 'helpmate/dist/misc/humanReadableByteSize.js';

import { trackTime } from 'helpmate/dist/misc/trackTime.js';

import { BuildIndex } from './BuildIndex/BuildIndex.js';

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

const thumbSize = 64;

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
        }
    ]
};

const fuseOptionsAdvanced = {
    ...fuseOptions,
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
    const output = [...new Set(array)].sort();
    return output;
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
                const idInDbForThumbNN = `${file.name}:${file.lastModified}:${file.size}:thumb${thumbSize}`;

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

                let thumbNN;
                if (USE_INDEXEDDB) {
                    try {
                        thumbNN = await trackTimeAsync(
                            'dbReadThumbNN',
                            () => getBatchedMemoized(idInDbForThumbNN, 200)
                        );
                    } catch (e) {
                        // do nothing
                    }
                    if (!delayedLoadTimer) { return; }
                }
                if (!thumbNN) {
                    thumbNN = await resizeImageBlob(imageBlob, thumbSize, file.type);
                    if (!delayedLoadTimer) { return; }

                    if (USE_INDEXEDDB) {
                        const thumbNNBlob = thumbNN;

                        await trackTimeAsync(
                            'dbWriteThumbNN',
                            // () => set(idInDbForThumbNN, thumbNNBlob), // TODO: FIXME: Handle error for this call
                            () => setBatched(idInDbForThumbNN, thumbNNBlob, 100) // TODO: FIXME: Handle error for this call
                        );

                        if (!delayedLoadTimer) { return; }
                    }
                }
                const url = URL.createObjectURL(thumbNN);
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
                        maxWidth: thumbSize,
                        maxHeight: thumbSize
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
    filesAndIndexInfo,
    searchQuery,
    resourcesCount,
    relevantHandlesCount,
    relevantFilesTotal
}) {
    const [sortBy, setSortBy] = useState(null);

    const [advancedSearchEnabled, setAdvancedSearchEnabled] = useAtom(advancedSearchEnabledAtom);

    const clonedFilesAndIndexInfo = useMemo(() => {
        return structuredClone(filesAndIndexInfo);
    }, [
        filesAndIndexInfo,
        filesAndIndexInfo.readNames,
        filesAndIndexInfo.readMetadataFiles
    ]);

    const sortBy_Field = sortBy && sortBy.field;
    const sortBy_Order = sortBy && sortBy.order;

    const finalList = useMemo(() => {
        let filtered = clonedFilesAndIndexInfo.filesAndDetails;
        if (
            clonedFilesAndIndexInfo &&
            Array.isArray(clonedFilesAndIndexInfo.filesAndDetails) &&
            searchQuery.query
        ) {
            let fuseOptionsToUse = fuseOptions;
            if (advancedSearchEnabled) {
                fuseOptionsToUse = fuseOptionsAdvanced;
            }
            const fuse = new Fuse(clonedFilesAndIndexInfo.filesAndDetails, fuseOptionsToUse);
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
    }, [
        clonedFilesAndIndexInfo,
        searchQuery.query,
        sortBy_Field,
        sortBy_Order,
        advancedSearchEnabled
    ]);

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
                        if (sortBy && sortBy.field === 'size' && sortBy.order === 'asc') {
                            setSortBy({ field: 'size', order: 'desc' });
                        } else if (sortBy && sortBy.field === 'size' && sortBy.order) {
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
                    style={{
                        // FIXME: This is a hack to make the Virtuoso component fit the available space (may not work perfectly in non-100% zoom)
                        height: 'calc(100vh - 20px - 20px - 15px - 20px - 5px - 20px - 15px - 1px - 34px - 34px - 1px)'
                    }}
                    data={finalList}

                    // Adjust UX+performance:
                    //     * Higher value here means:
                    //           * faster rendering when scrolling to nearby items (eg: pressing down arrow on keyboard)
                    //           * slower rendering when scrolling to far away items (eg: making huge scroll jump with mouse)
                    increaseViewportBy={document.documentElement.offsetHeight}

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

const loadMetadataFiles = async function (filesAndIndexInfo) {
    const { handleForFolder } = filesAndIndexInfo;
    const iterator = await handleForFolder.values();

    const fileHandlesByFileName = {};
    while (true) {
        const { done, value } = await iterator.next();
        if (done) {
            break;
        }

        if (value.kind === 'file') {
            fileHandlesByFileName[value.name] = value;
        }
    }

    const { filesAndDetails } = filesAndIndexInfo;

    const filesAndDetailsOfNonMetadataFilesWithoutCorrespondingMetadataFiles = [];
    for (const fileAndDetails of filesAndDetails) {
        const fileName = fileAndDetails.fileHandle.name;
        if (!fileName.endsWith('.metadata.json')) {
            const metadataFileName = fileName + '.metadata.json';
            if (fileHandlesByFileName[metadataFileName]) {
                fileAndDetails.metadataFileHandle = fileHandlesByFileName[metadataFileName];
            } else {
                filesAndDetailsOfNonMetadataFilesWithoutCorrespondingMetadataFiles.push(fileAndDetails);
                fileAndDetails.metadataFileHandle = null;
            }
        }
    }

    for (const fileAndDetails of filesAndDetails) {
        if (fileAndDetails.metadataFileHandle) {
            const metadataFile = await fileAndDetails.metadataFileHandle.getFile();
            const metadataFileContents = await metadataFile.text();
            const metadataFileJson = JSON.parse(metadataFileContents);
            fileAndDetails.details = metadataFileJson;
        }
    }

    filesAndIndexInfo.readMetadataFiles = true;
};

const loadIndex = async function (filesAndIndexInfo) {
    const { readMetadataFiles } = filesAndIndexInfo;
    if (!readMetadataFiles) {
        await loadMetadataFiles(filesAndIndexInfo);
    }
};

const AdvancedSearchOptions = function ({ handleForFolder }) {
    const [advancedSearchEnabled, setAdvancedSearchEnabled] = useAtom(advancedSearchEnabledAtom);

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
                                setAdvancedSearchEnabled(event.target.checked);
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
    const [filesAndIndexInfo, setFilesAndIndexInfo] = useState({
        handleForFolder: null,
        filesAndDetails: null,
        readNames: false,
        readMetadataFiles: false
    });

    const [selectedFileHandle, setSelectedFileHandle] = useAtom(selectedFileHandleAtom);

    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState({
        mode: 'normal',
        query: null
    });

    const [advancedSearchEnabled, setAdvancedSearchEnabled] = useAtom(advancedSearchEnabledAtom);

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
                            if (advancedSearchEnabled) {
                                await loadIndex(filesAndIndexInfo);
                            }

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
                        filesAndIndexInfo={filesAndIndexInfo}
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
                        overflow: 'auto',
                        width: 352,
                        // FIXME: This is a hack to make this component fit the available space (may not work perfectly in non-100% zoom)
                        height: 'calc(100vh - 20px - 20px - 15px - 20px - 5px - 20px - 15px)'
                    }}
                >
                    <SideViewForFile handleForFolder={handleForFolder} />
                </div>
            </div>
        </div>
    );
};

export { ReadFiles };
