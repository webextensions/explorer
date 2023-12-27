import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

import classNames from 'classnames';

import { Virtuoso } from 'react-virtuoso';

import { atom, useAtom } from 'jotai';

import Fuse from 'fuse.js';

import { getImageDimensionsFromBlob } from '../utils/getImageDimensionsFromBlob.js';
import { getAverageColorFromImageBlob } from '../utils/getAverageColorFromImageBlob.js';
import {
    // resizeImageBlob,
    resizeImageBlobAndCropToSize
} from '../utils/resizeImageBlob.js';

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

import { convertLocalTimeInIsoLikeFormat } from '../utils/convertLocalTimeInIsoLikeFormat.js';

import { BuildIndex } from './BuildIndex/BuildIndex.js';

import { SideViewForFile } from './SideViewForFile/SideViewForFile.js';
import { createMetadataForImage } from './GenerateMetadataFile/createMetadataForImage.js';

import { useZustandStore } from '../store/zustandStore.js';

import {
    CurrentDirectoryAtom,
    selectedFilesAtom
} from '../store/jotaiStore.js';

import styles from './ReadFiles.css';

import { FoldersTreePane } from './FoldersTreePane/FoldersTreePane.js';

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

// DEV-HELPER
const CLEAR_INDEXEDDB = false;
// const CLEAR_INDEXEDDB = true; typeof DO_NOT_UNCOMMENT;
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

const advancedSearchEnabledAtom = atom(false);

// eslint-disable-next-line no-unused-vars
const getFile = async function () {
    // Open file picker and destructure the result the first handle
    const [fileHandle] = await window.showOpenFilePicker();
    const file = await fileHandle.getFile();
    return file;
};

// eslint-disable-next-line no-unused-vars
const timeout = function (ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

const ImageFromAssetFile = ({
    finalList,
    assetFile,
    handleForFolder
}) => {
    const [file, setFile] = useState(null);
    const [imageBlob, setImageBlob] = useState(null);
    const [dimensions, setDimensions] = useState(null);
    const [fileProps, setFileProps] = useState(null);

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

                // DEV-HELPER
                const USE_INDEXEDDB = true;
                // const USE_INDEXEDDB = false; typeof DO_NOT_UNCOMMENT;

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
                    props = {};

                    const [errDimensions, computedDimensions] = await getImageDimensionsFromBlob(imageBlob);
                    if (!delayedLoadTimer) { return; }
                    if (!errDimensions) {
                        props.dimensions = computedDimensions;
                    }

                    const [errAverageColor, averageColor] = await getAverageColorFromImageBlob(imageBlob);
                    if (!delayedLoadTimer) { return; }
                    if (!errAverageColor) {
                        props.averageColor = averageColor;
                    }

                    if (USE_INDEXEDDB) {
                        if (Object.keys(props).length) {
                            // TODO: FIXME: Handle error for this call
                            await trackTimeAsync(
                                'dbWriteProps',
                                // () => set(idInDbForProps, props),
                                () => setBatched(idInDbForProps, props, 100)
                            );
                            if (!delayedLoadTimer) { return; }
                        }
                    }
                }
                // FIXME: "react/prop-types" is getting applied incorrectly here since we set the variable name as "props"
                setDimensions(props.dimensions); // eslint-disable-line react/prop-types
                setFileProps(props);

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
                    // thumbNN = await resizeImageBlob(imageBlob, thumbSize, file.type);
                    thumbNN = await resizeImageBlobAndCropToSize({
                        imageBlob,
                        width: thumbSize,
                        height: thumbSize,
                        mimeType: file.type
                    });
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

    const [selectedFiles, setSelectedFiles] = useAtom(selectedFilesAtom);

    return (
        <div
            onClick={async (evt) => {
                // TODO: Handle ctrl+shift+click
                //       In case of ctrl+shift+click, the "first selected index" approach should change to "last clicked index" as per expected UX for that case
                if (evt.shiftKey) {
                    const files = [...selectedFiles];
                    const firstSelectedFile = files[0];
                    const firstSelectedFileIndex = finalList.findIndex((file) => file.file === firstSelectedFile);
                    const currentFileIndex = finalList.findIndex((file) => file.file === assetFile);
                    const minIndex = Math.min(firstSelectedFileIndex, currentFileIndex);
                    const maxIndex = Math.max(firstSelectedFileIndex, currentFileIndex);
                    const newSet = new Set([]);
                    newSet.add(firstSelectedFile); // Retain first selected file
                    for (let i = minIndex; i <= maxIndex; i++) {
                        if (!newSet.has(finalList[i].file)) {
                            newSet.add(finalList[i].file);
                        }
                    }
                    setSelectedFiles(newSet);
                } else if (evt.ctrlKey) {
                    if (selectedFiles.has(assetFile)) {
                        const updatedSet = new Set(selectedFiles);
                        updatedSet.delete(assetFile);
                        setSelectedFiles(updatedSet);
                    } else {
                        const updatedSet = new Set(selectedFiles);
                        updatedSet.add(assetFile);
                        setSelectedFiles(updatedSet);
                    }
                } else {
                    if (selectedFiles.size === 1 && selectedFiles.has(assetFile)) {
                        setSelectedFiles(new Set([]));
                    } else {
                        setSelectedFiles(new Set([assetFile]));
                    }
                }
            }}
            className={
                classNames(
                    styles.fileRow,
                    selectedFiles.has(assetFile) ? styles.selectedFileRow : null
                )
            }
            style={{
                display: 'flex',
                marginTop: 8,
                marginBottom: 8
            }}
        >
            <div
                className={classNames(styles.cell, styles.fileIconImage)}
                style={{
                    display: 'grid',
                    placeItems: 'center',
                    backgroundColor: (() => {
                        if (!fileProps || !fileProps.averageColor) {
                            return '#fff';
                        }
                        /* eslint-disable @stylistic/indent */
                        return ([
                            'rgba(',
                                fileProps.averageColor.red, ',',
                                fileProps.averageColor.green, ',',
                                fileProps.averageColor.blue, ',',
                                fileProps.averageColor.alpha,
                            ')'
                        ].join(''));
                        /* eslint-enable @stylistic/indent */
                    })()
                }}
            >
                <img
                    src={imageBlob}
                    style={{
                        width: thumbSize,
                        height: thumbSize
                    }}
                    // onLoad={function () {
                    //     // URL.revokeObjectURL(imageBlob);
                    // }}
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
    finalList: PropTypes.array.isRequired,
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
        let propA = getObjectProperty(a, propertyPath);
        if (typeof propA === 'string') {
            propA = propA.toLowerCase();
        }
        let propB = getObjectProperty(b, propertyPath);
        if (typeof propB === 'string') {
            propB = propB.toLowerCase();
        }

        const nameA = getObjectProperty(a, 'file.name').toLowerCase();
        const nameB = getObjectProperty(b, 'file.name').toLowerCase();

        if (order === 'desc') {
            if (propA === undefined || propA === null) return 1;
            if (propB === undefined || propA === null) return -1;
            if (propA > propB) return -1;
            if (propA < propB) return 1;
        } else {
            if (propA === undefined || propA === null) return -1;
            if (propB === undefined || propA === null) return 1;
            if (propA < propB) return -1;
            if (propA > propB) return 1;
        }

        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
    };
};

const ResourcesCountInStatusBar = function () {
    const resourcesCount = useZustandStore((state) => state.resourcesCount);

    return (resourcesCount === null ? 'Not loaded' : resourcesCount);
};

const ImagesCountInStatusBar = function () {
    const relevantHandlesCount = useZustandStore((state) => state.relevantHandlesCount);
    const relevantFilesTotal = useZustandStore((state) => state.relevantFilesTotal);

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
};

const FilesListStatusBar = function () {
    return (
        <div
            style={{
                display: 'flex',
                height: 34,
                padding: '5px 10px',
                backgroundColor: '#eee'
            }}
        >
            <div style={{ lineHeight: '24px' }}>
                Resources: <ResourcesCountInStatusBar />
            </div>
            <div style={{ lineHeight: '24px' }}>
                <ImagesCountInStatusBar />
            </div>
        </div>
    );
};

const ShowImagesWrapper = function ({
    searchQuery
}) {
    // eslint-disable-next-line no-unused-vars
    const [currentDirectoryAtom, setCurrentDirectoryAtom] = useAtom(CurrentDirectoryAtom);
    const handleForFolder = currentDirectoryAtom;

    const filesAndIndexInfo = useZustandStore((state) => state.filesAndIndexInfo);

    const [sortBy, setSortBy] = useState(null);

    // eslint-disable-next-line no-unused-vars
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
            if (
                sortBy &&
                (
                    sortBy.field === 'lastModified' ||
                    sortBy.field === 'name' ||
                    sortBy.field === 'size' ||
                    sortBy.field === 'type'
                )
            ) {
                let propertyPath;
                if (sortBy.field === 'lastModified') {
                    propertyPath = 'file.lastModified';
                } else if (sortBy.field === 'name') {
                    propertyPath = 'file.name';
                } else if (sortBy.field === 'size') {
                    propertyPath = 'file.size';
                } else if (sortBy.field === 'type') {
                    propertyPath = 'file.type';
                }
                filtered.sort(sortFnByPropertyPath(propertyPath, { order: sortBy.order }));
            } else {
                const propertyPath = 'file.name';
                filtered.sort(sortFnByPropertyPath(propertyPath, { order: 'asc' }));
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

    const applySortByUpdate = function (fieldClicked) {
        if (sortBy && sortBy.field === fieldClicked && sortBy.order === 'asc') {
            setSortBy({ field: fieldClicked, order: 'desc' });
        } else {
            setSortBy({ field: fieldClicked, order: 'asc' });
        }
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                width: 830,
                height: '100%',
                border: '1px solid #ccc',
                borderRadius: 10,
                overflow: 'hidden'
            }}
        >
            <div className={styles.headerRow}>
                <div className={classNames(styles.cell, styles.fileIconHeader)}>
                    &nbsp;
                </div>
                <div
                    className={classNames(styles.cell, styles.fileName, 'bold')}
                    onClick={() => {
                        applySortByUpdate('name');
                    }}
                >
                    Name
                </div>
                <div
                    className={classNames(styles.cell, styles.fileType, 'bold')}
                    onClick={() => {
                        applySortByUpdate('type');
                    }}
                >
                    Type
                </div>
                <div
                    className={classNames(styles.cell, styles.fileSize)}
                    onClick={() => {
                        applySortByUpdate('size');
                    }}
                >
                    Size
                </div>
                <div className={classNames(styles.cell, styles.fileDimensions)}>
                    Dimensions
                </div>
                <div
                    className={classNames(styles.cell, styles.fileLastModified)}
                    onClick={() => {
                        applySortByUpdate('lastModified');
                    }}
                >
                    Last modified
                </div>
                <div className={classNames(styles.cell, styles.metadataContents)}>
                    Metadata
                </div>
            </div>
            <div style={{ flex: 1, userSelect: 'none' }}>
                <Virtuoso
                    data={finalList}

                    // Adjust UX+performance:
                    //     * Higher value here means:
                    //           * faster rendering when scrolling to nearby items (eg: pressing down arrow on keyboard)
                    //           * slower rendering when scrolling to far away items (eg: making huge scroll jump with mouse)
                    increaseViewportBy={document.documentElement.offsetHeight}

                    itemContent={(index, fileAndDetails) => {
                        const file = fileAndDetails.file;
                        const fileName = file.name;
                        // const details = fileAndDetails.details;
                        return (
                            <ImageFromAssetFile
                                key={fileName}
                                finalList={finalList}
                                assetFile={file}
                                handleForFolder={handleForFolder}
                            />
                        );
                    }}
                />
            </div>
            <div>
                <FilesListStatusBar />
            </div>
        </div>
    );
};
ShowImagesWrapper.propTypes = {
    searchQuery: PropTypes.object.isRequired
};

const loadMetadataFiles = async function (filesAndIndexInfo) {
    const { handleForFolder } = filesAndIndexInfo;
    const iterator = await handleForFolder.values();

    const fileHandlesByFileName = {};
    while (true) { // eslint-disable-line no-constant-condition
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

const AdvancedSearchOptions = function () {
    // eslint-disable-next-line no-unused-vars
    const [currentDirectoryAtom, setCurrentDirectoryAtom] = useAtom(CurrentDirectoryAtom);
    const handleForFolder = currentDirectoryAtom;
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
    // eslint-disable-next-line no-unused-vars
    const [currentDirectoryAtom, setCurrentDirectoryAtom] = useAtom(CurrentDirectoryAtom);

    const filesAndIndexInfo = useZustandStore((state) => state.filesAndIndexInfo);

    const setRelevantHandlesCount = useZustandStore((state) => state.setRelevantHandlesCount);
    const setRelevantFilesTotal = useZustandStore((state) => state.setRelevantFilesTotal);
    const setFilesAndIndexInfo = useZustandStore((state) => state.setFilesAndIndexInfo);
    // eslint-disable-next-line no-unused-vars
    const [selectedFiles, setSelectedFiles] = useAtom(selectedFilesAtom);
    const setResourcesCount = useZustandStore((state) => state.setResourcesCount);

    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState({
        mode: 'normal',
        query: null
    });

    // eslint-disable-next-line no-unused-vars
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

    useEffect(() => {
        if (!currentDirectoryAtom) {
            return;
        }

        setRelevantHandlesCount(null);
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

        (async () => {
            // const iterator = dirHandle.values();
            const iterator = currentDirectoryAtom.values();
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

                    setRelevantHandlesCount(filesAndDetails.length);
                }
                setFilesAndIndexInfo({
                    handleForFolder: currentDirectoryAtom,
                    filesAndDetails,
                    readNames: true,
                    readMetadataFiles: false
                });
            })();
        })();
    }, [currentDirectoryAtom]);

    return (
        <div
            style={{
                display: 'grid',
                height: '100%',
                gridTemplateRows: 'auto auto minmax(0, 1fr)'
            }}
        >
            <div style={{ marginTop: 15 }}>
                <div style={{ display: 'flex' }}>
                    <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => {
                            setSearchInput(e.target.value);
                        }}
                        onKeyPress={async (e) => {
                            if (e.key === 'Enter') {
                                if (advancedSearchEnabled) {
                                    await loadIndex(filesAndIndexInfo);
                                }

                                setQueryWithMode();
                            }
                        }}
                    />

                    <button
                        style={{
                            cursor: 'pointer',
                            marginLeft: 10
                        }}
                        disabled={!currentDirectoryAtom}
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

            <div style={{ marginTop: 5, marginBottom: 15 }}>
                <AdvancedSearchOptions />
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto auto auto',
                    columnGap: 15
                }}
            >
                <div
                    style={{
                        width: 202,
                        overflow: 'hidden',
                        border: '1px solid #ccc',
                        borderRadius: 10
                    }}
                >
                    <div
                        style={{
                            overflow: 'auto',
                            display: 'grid', /* `display: 'grid'` is useful for applying padding to the bottom (without this, when scrollbar is visible, the padding doesn't get applied to the bottom) */
                            padding: 10,
                            height: '100%'
                        }}
                    >
                        <FoldersTreePane />
                    </div>
                </div>
                <div>
                    <ShowImagesWrapper
                        handleForFolder={currentDirectoryAtom}
                        filesAndIndexInfo={filesAndIndexInfo}
                        searchQuery={searchQuery}
                    />
                </div>
                <div
                    style={{
                        border: '1px solid #ccc',
                        borderRadius: 10,
                        overflow: 'hidden',
                        width: 352
                    }}
                >
                    <div
                        style={{
                            overflowY: 'scroll',
                            // overflowY: 'auto',

                            height: '100%'
                        }}
                    >
                        <SideViewForFile handleForFolder={currentDirectoryAtom} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export { ReadFiles };
