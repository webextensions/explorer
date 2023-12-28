import React, { Fragment, useState } from 'react';
import PropTypes from 'prop-types';

import imageCompression from 'browser-image-compression';
import ky from 'ky';

import { dequal } from 'dequal';

import { tryCatchFallback } from 'helpmate/dist/control/tryCatch.js';

import { SplitButton } from '../../Components/SplitButton.js';

import { trackTime } from 'helpmate/dist/misc/trackTime.js';

import { getImageDimensionsFromBlob } from '../../utils/getImageDimensionsFromBlob.js';
import { getAverageColorFromImageBlob } from '../../utils/getAverageColorFromImageBlob.js';

const trackTimeAsync = trackTime.async;

const buildIndex = async function ({
    skipWhereMetadataFileAlreadyExists,
    metadataToBuild = {},
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

        const folderContentsIterator = await handleForFolder.values();

        let fileHandles = new Set([]);
        statusUpdateCallback({
            pass: 'Counting Files',
            passProgress: {
                score: fileHandles.size
            }
        });
        for await (const fileHandle of folderContentsIterator) {
            fileHandles.add(fileHandle);

            statusUpdateCallback({
                pass: 'Counting Files',
                passProgress: {
                    score: fileHandles.size
                }
            });
        }

        fileHandles = Array.from(fileHandles);
        fileHandles.sort((a, b) => a.name.localeCompare(b.name));
        fileHandles = new Set(fileHandles);

        const handlesForActualFiles = new Set([]);
        for (const fileHandle of fileHandles) {
            if (fileHandle.kind === 'file') {
                handlesForActualFiles.add(fileHandle);
            }
        }

        const
            handlesForActualNonMetadataFiles = new Set([]),
            handlesForActualMetadataFiles = new Set([]);
        for (const fileHandle of handlesForActualFiles) {
            if (fileHandle.name.endsWith('.metadata.json')) {
                handlesForActualMetadataFiles.add(fileHandle);
            } else {
                handlesForActualNonMetadataFiles.add(fileHandle);
            }
        }

        const namesOfFilesWithMetadataWithoutMetadataExtension = new Set([]);
        for (const file of handlesForActualMetadataFiles) {
            const name = file.name.replace(/\.metadata\.json$/, '');
            namesOfFilesWithMetadataWithoutMetadataExtension.add(name);
        }

        const handlesForFilesForWhichMetadataFileNeedsToBeCreated = new Set([]);
        for (const file of handlesForActualNonMetadataFiles) {
            if (!namesOfFilesWithMetadataWithoutMetadataExtension.has(file.name)) {
                handlesForFilesForWhichMetadataFileNeedsToBeCreated.add(file);
            }
        }

        let handlesForFilesToProcess;
        if (skipWhereMetadataFileAlreadyExists) {
            handlesForFilesToProcess = handlesForFilesForWhichMetadataFileNeedsToBeCreated;
        } else {
            handlesForFilesToProcess = handlesForActualNonMetadataFiles;
        }

        let filesMetadataEnsured = 0;
        const filesMetadataToBeUpdated = handlesForFilesToProcess.size;
        statusUpdateCallback({
            pass: 'Creating/Updating Metadata Files',
            passTitle: JSON.stringify(metadataToBuild),
            passProgress: {
                score: filesMetadataEnsured,
                target: filesMetadataToBeUpdated
            }
        });

        for (const handleForFile of handlesForFilesToProcess) {
            // create the ".metadata.json" files if they don't exist for the respective files.
            const handleForMetadataFile = await trackTimeAsync(
                'buildIndex_getFileHandle',
                () => handleForFolder.getFileHandle(handleForFile.name + '.metadata.json', { create: true })
            );
            const metadataFile = await handleForMetadataFile.getFile();
            const metadataFileContents = await metadataFile.text();
            const metadataFileJson = tryCatchFallback(() => JSON.parse(metadataFileContents), {});

            const outputMetadataFileJson = JSON.parse(JSON.stringify(metadataFileJson));
            outputMetadataFileJson.name = handleForFile.name;

            let digDeeper = false;
            if (
                (metadataToBuild.type && !outputMetadataFileJson.type) ||
                (metadataToBuild.lastModified && !outputMetadataFileJson.lastModified) ||
                (metadataToBuild.size && !outputMetadataFileJson.size) ||
                (metadataToBuild.dimensions && !outputMetadataFileJson.dimensions) ||
                (metadataToBuild.averageColor && !outputMetadataFileJson.averageColor) ||
                (metadataToBuild.tags && !outputMetadataFileJson.tags)
            ) {
                digDeeper = true;
            }

            if (digDeeper) {
                const file = await trackTimeAsync(
                    'buildIndex_getFile',
                    () => handleForFile.getFile()
                );

                if (metadataToBuild.type && !outputMetadataFileJson.type) {
                    outputMetadataFileJson.type = file.type;
                }

                if (metadataToBuild.lastModified && !outputMetadataFileJson.lastModified) {
                    outputMetadataFileJson.lastModified = file.lastModified;
                }

                if (metadataToBuild.size && !outputMetadataFileJson.size) {
                    outputMetadataFileJson.size = file.size;
                }

                let digFurther = false;
                if (
                    (metadataToBuild.dimensions && !outputMetadataFileJson.dimensions) ||
                    (metadataToBuild.averageColor && !outputMetadataFileJson.averageColor) ||
                    (metadataToBuild.tags && !outputMetadataFileJson.tags)
                ) {
                    digFurther = true;
                }

                if (digFurther) {
                    if (
                        file.type === 'image/gif'     ||
                        file.type === 'image/jpeg'    ||
                        file.type === 'image/png'     ||
                        file.type === 'image/svg+xml' ||
                        file.type === 'image/webp'
                    ) {
                        const imageBlob = new Blob([file], { type: file.type });

                        if (metadataToBuild.dimensions && !outputMetadataFileJson.dimensions) {
                            const [err, dimensions] = await getImageDimensionsFromBlob(imageBlob);
                            if (!err) {
                                outputMetadataFileJson.dimensions = dimensions;
                            }
                        }

                        if (metadataToBuild.averageColor && !outputMetadataFileJson.averageColor) {
                            const [err, averageColor] = await getAverageColorFromImageBlob(imageBlob);
                            if (!err) {
                                outputMetadataFileJson.averageColor = averageColor;
                            }
                        }

                        if (metadataToBuild.tags && !outputMetadataFileJson.tags) {
                            const imageCompressionOptions = {
                                maxSizeMB: 0.25,
                                maxWidthOrHeight: 500,
                                useWebWorker: true
                            };

                            const imageFile = file;
                            let compressedFile;
                            try {
                                compressedFile = await imageCompression(imageFile, imageCompressionOptions);
                            } catch (err) {
                                // TODO: Improve handling of this error (eg: Error may occur if the image is too wide but not too tall, eg: 2000x2 px)
                                console.error('Issue in processing file:', file.name, err);
                                compressedFile = imageFile;
                            }

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

                            outputMetadataFileJson.tags = arrTags;
                            outputMetadataFileJson.tagsRaw = json.data;
                        }
                    }
                }
            }

            if (!dequal(metadataFileJson, outputMetadataFileJson)) {
                const writableStream = await trackTimeAsync(
                    'buildIndex_createWritable',
                    () => handleForMetadataFile.createWritable()
                );

                await trackTimeAsync(
                    'buildIndex_write',
                    () => writableStream.write(JSON.stringify(outputMetadataFileJson, null, 4))
                );

                setTimeout(async function () {
                    await trackTimeAsync(
                        'buildIndex_closeStream',
                        () => writableStream.close()
                    );

                    filesMetadataEnsured++;
                    statusUpdateCallback({
                        pass: 'Creating/Updating Metadata Files',
                        passTitle: JSON.stringify(metadataToBuild),
                        passProgress: {
                            score: filesMetadataEnsured,
                            target: filesMetadataToBeUpdated
                        }
                    });
                });
            } else {
                filesMetadataEnsured++;
                statusUpdateCallback({
                    pass: 'Creating/Updating Metadata Files',
                    passTitle: JSON.stringify(metadataToBuild),
                    passProgress: {
                        score: filesMetadataEnsured,
                        target: filesMetadataToBeUpdated
                    }
                });
            }
        }
        return [null];
    } catch (e) {
        return [e];
    }
};

const BuildIndex = function ({ handleForFolder }) {
    const [progressStatus, setProgressStatus] = useState(null);

    const buildIndexOptions = [
        {
            value: 'Build Index (Quick)',
            onClick: async function () {
                setProgressStatus(null);

                // eslint-disable-next-line no-unused-vars
                const [err] = await buildIndex({
                    handleForFolder,
                    skipWhereMetadataFileAlreadyExists: true,
                    metadataToBuild: {
                        type: true,
                        lastModified: true,
                        size: true,
                        dimensions: true,
                        averageColor: true
                    },
                    statusUpdateCallback: function (status) {
                        const {
                            pass,
                            passProgress
                        } = status;
                        setProgressStatus({
                            pass,
                            passProgress
                        });
                    }
                });
            }
        },
        {
            value: 'Build Index (Full)',
            onClick: async function () {
                setProgressStatus(null);

                // eslint-disable-next-line no-unused-vars
                const [err] = await buildIndex({
                    handleForFolder,
                    skipWhereMetadataFileAlreadyExists: false,
                    metadataToBuild: {
                        type: true,
                        lastModified: true,
                        size: true,
                        dimensions: true,
                        averageColor: true,
                        tags: true
                    },
                    statusUpdateCallback: function (status) {
                        const {
                            pass,
                            passProgress
                        } = status;
                        setProgressStatus({
                            pass,
                            passProgress
                        });
                    }
                });
            }
        }
    ];

    return (
        <div style={{ display: 'flex' }}>
            <SplitButton
                defaultSelectedIndex={0}
                options={buildIndexOptions}
            />
            {
                progressStatus &&
                <Fragment>
                    <div style={{ marginLeft: 15 }}>
                        <div>
                            <span style={{ fontWeight: 'bold' }}>Current pass:</span>
                            <span> </span>
                            <span title={progressStatus.passTitle}>{progressStatus.pass}</span>
                        </div>
                        <div>
                            <span style={{ fontWeight: 'bold' }}>Progress:</span>
                            <span> </span>
                            {(() => {
                                const { passProgress } = progressStatus;
                                const { score, target } = passProgress;
                                if (target) {
                                    const percentage = parseInt(Math.round(10000 * (score / target))) / 100;
                                    return `${score} / ${target} (${percentage}%)`;
                                } else {
                                    return `${score}`;
                                }
                            })()}
                        </div>
                    </div>
                </Fragment>
            }
        </div>
    );
};
BuildIndex.propTypes = {
    handleForFolder: PropTypes.object.isRequired
};

export { BuildIndex };
