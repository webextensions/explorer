/* global showDirectoryPicker */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

import classNames from 'classnames';

import { Virtuoso } from 'react-virtuoso';
import ky from 'ky';

import { atom, useAtom } from 'jotai';

import { humanReadableByteSize } from 'helpmate/dist/misc/humanReadableByteSize.js';

import uc from '../../utility-classes.css';
import styles from './ReadFiles.css';

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

const ImageFromHandle = ({ fileHandle, handleForFolder }) => {
    const [file, setFile] = useState(null);
    const [imageBlob, setImageBlob] = useState(null);
    const [dimensions, setDimensions] = useState(null);

    // const [metadataFileStatus, setMetadataFileStatus] = useState(null);
    const [metadataFileObject, setMetadataFileObject] = useState({
        status: null,
        json: null
    });

    // eslint-disable-next-line no-unused-vars
    const [output, setOutput] = useState(null);

    useEffect(() => {
        (async () => {
            const file = await fileHandle.getFile();
            setFile(file);

            const blob = new Blob([file], { type: file.type });
            const url = URL.createObjectURL(blob);
            setImageBlob(url);

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
    }, [fileHandle, handleForFolder]);

    const [selectedFileHandle, setSelectedFileHandle] = useAtom(selectedFileHandleAtom);

    return (
        <div
            style={{ display: 'flex' }}
            onClick={async () => {
                if (selectedFileHandle === fileHandle) {
                    setSelectedFileHandle(null);
                } else {
                    setSelectedFileHandle(fileHandle);
                }
            }}
            className={
                classNames(
                    styles.fileRow,
                    fileHandle === selectedFileHandle ? styles.selectedFileRow : null
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
                    onLoad={function (img) {
                        // URL.revokeObjectURL(imageBlob);

                        // const metadataFileHandle = (
                        //     await handleForFolder.getFileHandle(`${file.name}.metadata.json`, { create: true })
                        // );
                        // const metadataFile = await metadataFileHandle.getFile();
                        // const metadataFileContents = await metadataFile.text();
                        // const metadata = JSON.parse(metadataFileContents);
                        // console.log(metadata);

                        setDimensions({
                            width: img.target.naturalWidth,
                            height: img.target.naturalHeight
                        });
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
                            <div>
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

                                        const metadataFileHandle = (
                                            await handleForFolder.getFileHandle(`${file.name}.metadata.json`, { create: true })
                                        );

                                        // Write contents to file
                                        const metadata = {
                                            name: file.name,
                                            type: file.type,
                                            size: file.size,
                                            width: dimensions.width,
                                            height: dimensions.height,
                                            lastModified: file.lastModified
                                        };
                                        const writable = await metadataFileHandle.createWritable();
                                        await writable.write(JSON.stringify(metadata, null, 4));
                                        await writable.close();
                                        setMetadataFileObject({
                                            status: 'found',
                                            json: metadata
                                        });
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
ImageFromHandle.propTypes = {
    fileHandle: PropTypes.object.isRequired,
    handleForFolder: PropTypes.object.isRequired
};

const ShowImagesWrapper = ({ handleForFolder, handlesForAssets }) => {
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
                <div className={classNames(styles.cell, styles.fileSize)}>
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
                    data={handlesForAssets}
                    // totalCount={handlesForAssets.length}
                    itemContent={(index, handleForAsset) => {
                        return (
                            <ImageFromHandle
                                key={index}
                                fileHandle={handleForAsset}
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
    handleForFolder: PropTypes.object.isRequired,
    handlesForAssets: PropTypes.array.isRequired
};

const SideViewForFile = function () {
    // eslint-disable-next-line no-unused-vars
    const [selectedFileHandle, setSelectedFileHandle] = useAtom(selectedFileHandleAtom);
    const [selectedFile, setSelectedFile] = useState(null);

    const [output, setOutput] = useState('');

    useEffect(() => {
        if (selectedFileHandle) {
            (async () => {
                const file = await selectedFileHandle.getFile();
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
                        <div>
                            <div style={{ marginTop: 10 }}>
                                <button
                                    onClick={async () => {
                                        const file = selectedFile;
                                        const response = await ky.post('/api/identify-tags', {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': file.type
                                            },
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
                                        setOutput(arrTags);
                                    }}
                                >
                                    Generate tags
                                </button>
                            </div>
                            {
                                output && (
                                    <div style={{ marginTop: 10 }}>
                                        <textarea
                                            value={JSON.stringify(output, null, 4)}
                                            readOnly
                                            style={{
                                                width: '100%',
                                                height: 200
                                            }}
                                        />
                                    </div>
                                )
                            }
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

const ReadFiles = () => {
    const [handlesForAssets, setHandlesForAssets] = useState([]);

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
                            setHandlesForAssets(handles);
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
                        handlesForAssets={handlesForAssets}
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
                    <SideViewForFile />
                </div>
            </div>
        </div>
    );
};

export { ReadFiles };
